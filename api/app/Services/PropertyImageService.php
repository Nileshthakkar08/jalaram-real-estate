<?php

namespace App\Services;

use App\Models\Property;
use App\Models\PropertyImage;
use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Stores property photos safely:
 *  - type is detected from file contents (getimagesize), never from the name or client MIME;
 *  - images are decoded and re-encoded with GD, which strips EXIF/GPS metadata (owners' home
 *    locations) and anything appended to the file;
 *  - filenames are random; the whole batch is all-or-nothing.
 */
class PropertyImageService
{
    private const ALLOWED = [
        IMAGETYPE_JPEG => ['image/jpeg', 'jpg'],
        IMAGETYPE_PNG => ['image/png', 'png'],
        IMAGETYPE_WEBP => ['image/webp', 'webp'],
    ];

    private const MAX_PIXELS = 30_000_000;

    private const MAX_EDGE = 2000;

    public function __construct(private AuditLogger $audit) {}

    public static function disk(): string
    {
        return config('filesystems.property_image_disk', 'public');
    }

    /** @param UploadedFile[] $files */
    public function store(Property $property, array $files): array
    {
        $disk = self::disk();
        $written = [];

        try {
            return DB::transaction(function () use ($property, $files, $disk, &$written) {
                // Lock the listing row so concurrent uploads cannot exceed the limit.
                Property::query()->whereKey($property->id)->lockForUpdate()->first();
                $existing = $property->images()->count();

                if ($existing + count($files) > Property::MAX_IMAGES) {
                    throw ValidationException::withMessages([
                        'images' => ['A listing can have at most '.Property::MAX_IMAGES." photos. It already has {$existing}."],
                    ]);
                }

                $nextOrder = (int) $property->images()->max('sort_order') + ($existing > 0 ? 1 : 0);
                $created = [];

                foreach ($files as $index => $file) {
                    [$bytes, $mime, $ext, $width, $height] = $this->sanitize($file, "images.{$index}");
                    $path = "properties/{$property->id}/".Str::uuid()->toString().".{$ext}";
                    Storage::disk($disk)->put($path, $bytes, ['visibility' => 'public']);
                    $written[] = $path;

                    $created[] = $property->images()->create([
                        'disk' => $disk,
                        'path' => $path,
                        'mime_type' => $mime,
                        'size_bytes' => strlen($bytes),
                        'width' => $width,
                        'height' => $height,
                        'sort_order' => $nextOrder++,
                        'alt_text' => Str::limit($property->title, 190, ''),
                    ]);
                }

                $this->audit->log('property.images_uploaded', $property, [], ['count' => count($created)]);

                return $created;
            });
        } catch (Throwable $e) {
            foreach ($written as $path) {
                Storage::disk($disk)->delete($path);
            }
            throw $e;
        }
    }

    public function delete(PropertyImage $image): void
    {
        DB::transaction(function () use ($image) {
            $property = $image->property;
            $image->delete();
            $this->normalizeOrder($property);
            $this->audit->log('property.image_deleted', $property, ['image_id' => $image->id]);
        });

        if (! str_starts_with($image->path, 'http')) {
            Storage::disk($image->disk)->delete($image->path);
        }
    }

    /** @param int[] $orderedIds every image id of the property, in the desired order */
    public function reorder(Property $property, array $orderedIds): void
    {
        $current = $property->images()->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $requested = collect($orderedIds)->map(fn ($id) => (int) $id);

        if ($requested->sort()->values()->all() !== $current) {
            throw ValidationException::withMessages(['image_ids' => ['Provide every photo of this listing exactly once.']]);
        }

        DB::transaction(function () use ($property, $requested) {
            foreach ($requested->values() as $position => $id) {
                PropertyImage::query()->where('property_id', $property->id)->whereKey($id)->update(['sort_order' => $position]);
            }
        });
    }

    private function normalizeOrder(Property $property): void
    {
        foreach ($property->images()->get() as $position => $image) {
            if ($image->sort_order !== $position) {
                $image->forceFill(['sort_order' => $position])->save();
            }
        }
    }

    /** @return array{0:string,1:string,2:string,3:int,4:int} bytes, mime, extension, width, height */
    private function sanitize(UploadedFile $file, string $field): array
    {
        $fail = fn (string $message) => throw ValidationException::withMessages([$field => [$message]]);

        $info = @getimagesize($file->getRealPath());
        if ($info === false || ! isset(self::ALLOWED[$info[2]])) {
            $fail('"'.$file->getClientOriginalName().'" is not a valid JPEG, PNG or WebP image.');
        }

        [$width, $height, $type] = $info;
        if ($width < 300 || $height < 200) {
            $fail('"'.$file->getClientOriginalName().'" is too small. Use photos at least 300×200 pixels.');
        }
        if ($width * $height > self::MAX_PIXELS) {
            $fail('"'.$file->getClientOriginalName().'" has too many pixels. Resize it below 30 megapixels.');
        }

        $previousLimit = ini_get('memory_limit');
        ini_set('memory_limit', '512M');

        try {
            $image = match ($type) {
                IMAGETYPE_JPEG => @imagecreatefromjpeg($file->getRealPath()),
                IMAGETYPE_PNG => @imagecreatefrompng($file->getRealPath()),
                IMAGETYPE_WEBP => @imagecreatefromwebp($file->getRealPath()),
            };
            if (! $image instanceof GdImage) {
                $fail('"'.$file->getClientOriginalName().'" could not be read. The file may be corrupted.');
            }

            if ($type === IMAGETYPE_JPEG) {
                $image = $this->applyExifOrientation($image, $file->getRealPath());
            }
            $image = $this->downscale($image);

            ob_start();
            match ($type) {
                IMAGETYPE_JPEG => imagejpeg($image, null, 82),
                IMAGETYPE_PNG => imagepng($image, null, 7),
                IMAGETYPE_WEBP => imagewebp($image, null, 82),
            };
            $bytes = (string) ob_get_clean();
            $result = [$bytes, self::ALLOWED[$type][0], self::ALLOWED[$type][1], imagesx($image), imagesy($image)];
            imagedestroy($image);

            return $result;
        } finally {
            ini_set('memory_limit', $previousLimit);
        }
    }

    private function downscale(GdImage $image): GdImage
    {
        $w = imagesx($image);
        $h = imagesy($image);
        if (max($w, $h) <= self::MAX_EDGE) {
            return $image;
        }

        $scale = self::MAX_EDGE / max($w, $h);
        $resized = imagescale($image, (int) round($w * $scale), (int) round($h * $scale), IMG_BICUBIC);
        imagedestroy($image);

        return $resized;
    }

    /** Re-encoding drops EXIF, so bake the camera's rotation into the pixels first. */
    private function applyExifOrientation(GdImage $image, string $path): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }
        $orientation = (int) (@exif_read_data($path)['Orientation'] ?? 1);

        return match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };
    }
}
