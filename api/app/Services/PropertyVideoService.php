<?php

namespace App\Services;

use App\Models\Property;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * One walkthrough video per listing, uploaded in chunks.
 *
 * Requests reach the API through Netlify's proxy, which rejects bodies over ~6 MB, so the browser
 * sends the file in CHUNK_BYTES pieces, in order. Pieces are kept on the private local disk and
 * joined when the last one arrives. The joined file's type is detected from its first bytes
 * (MP4/MOV "ftyp" box or WebM EBML header), never from its name or the client's MIME type, and it
 * is stored under a random name like the photos.
 */
class PropertyVideoService
{
    public const CHUNK_BYTES = 4 * 1024 * 1024;

    public const MAX_BYTES = 100 * 1024 * 1024;

    public const MAX_CHUNKS = 25; // ceil(MAX_BYTES / CHUNK_BYTES)

    /** Unfinished uploads older than this are removed by `videos:prune-uploads`. */
    public const STALE_AFTER_HOURS = 24;

    public function __construct(private AuditLogger $audit) {}

    public static function disk(): string
    {
        return PropertyImageService::disk();
    }

    public static function chunkDirectory(Property $property, string $uploadId): string
    {
        return "video-uploads/{$property->id}/{$uploadId}";
    }

    /**
     * Stores one piece. Returns true once the last piece has arrived and the video is saved.
     *
     * @param  array{upload_id:string,index:int,total:int,size:int}  $meta
     */
    public function storeChunk(Property $property, array $meta, UploadedFile $chunk): bool
    {
        $local = Storage::disk('local');
        $dir = self::chunkDirectory($property, $meta['upload_id']);
        $index = $meta['index'];
        $total = $meta['total'];

        if ($total !== (int) ceil($meta['size'] / self::CHUNK_BYTES)) {
            $this->fail('The video upload is inconsistent. Please try again.');
        }
        $expected = $index < $total - 1 ? self::CHUNK_BYTES : $meta['size'] - self::CHUNK_BYTES * ($total - 1);
        if ($chunk->getSize() !== $expected) {
            $this->fail('Part of the video was cut off in transit. Please try again.');
        }

        if ($index === 0) {
            // A new upload replaces any unfinished one for this listing, so at most one is on disk.
            $local->deleteDirectory("video-uploads/{$property->id}");
            $local->put("{$dir}/meta.json", json_encode(['size' => $meta['size'], 'total' => $total]));
        } else {
            $saved = json_decode((string) $local->get("{$dir}/meta.json"), true);
            $received = count($local->files($dir)) - 1;
            // Pieces arrive in order; re-sending the latest one (a retry) is allowed.
            if (! $saved || $saved !== ['size' => $meta['size'], 'total' => $total] || ! in_array($index, [$received, $received - 1], true)) {
                $this->fail('The video upload was interrupted. Please choose the video again.');
            }
        }

        $local->putFileAs($dir, $chunk, sprintf('%05d.part', $index));

        if ($index < $total - 1) {
            return false;
        }

        try {
            $this->assemble($property, $dir, $meta['size'], $total);
        } finally {
            $local->deleteDirectory($dir);
        }

        return true;
    }

    public function delete(Property $property): void
    {
        if (! $property->video_path) {
            return;
        }
        $old = ['disk' => $property->video_disk, 'path' => $property->video_path];
        DB::transaction(function () use ($property) {
            $property->forceFill(['video_disk' => null, 'video_path' => null, 'video_mime' => null, 'video_size_bytes' => null])->save();
            $this->audit->log('property.video_deleted', $property);
        });
        Storage::disk($old['disk'])->delete($old['path']);
    }

    private function assemble(Property $property, string $dir, int $size, int $total): void
    {
        $local = Storage::disk('local');
        $joined = $local->path("{$dir}/video.tmp");
        $out = fopen($joined, 'wb');
        for ($i = 0; $i < $total; $i++) {
            $part = $local->path(sprintf('%s/%05d.part', $dir, $i));
            $in = is_file($part) ? fopen($part, 'rb') : false;
            if ($in === false) {
                fclose($out);
                $this->fail('The video upload was interrupted. Please choose the video again.');
            }
            stream_copy_to_stream($in, $out);
            fclose($in);
        }
        fclose($out);

        if (filesize($joined) !== $size) {
            $this->fail('The video upload is incomplete. Please try again.');
        }
        [$mime, $ext] = $this->detectType($joined);

        $disk = self::disk();
        $path = "properties/{$property->id}/videos/".Str::uuid()->toString().".{$ext}";
        $stream = fopen($joined, 'rb');
        Storage::disk($disk)->writeStream($path, $stream, ['visibility' => 'public']);
        if (is_resource($stream)) {
            fclose($stream);
        }

        $old = null;
        try {
            DB::transaction(function () use ($property, $disk, $path, $mime, $size, &$old) {
                $locked = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
                $old = $locked->video_path ? ['disk' => $locked->video_disk, 'path' => $locked->video_path] : null;
                $property->forceFill(['video_disk' => $disk, 'video_path' => $path, 'video_mime' => $mime, 'video_size_bytes' => $size])->save();
                $this->audit->log('property.video_uploaded', $property, [], ['size_bytes' => $size, 'mime' => $mime]);
            });
        } catch (\Throwable $e) {
            Storage::disk($disk)->delete($path);
            throw $e;
        }

        if ($old) {
            Storage::disk($old['disk'])->delete($old['path']);
        }
    }

    /** @return array{0:string,1:string} mime type and extension, from the file's first bytes */
    private function detectType(string $file): array
    {
        $head = (string) file_get_contents($file, false, null, 0, 12);

        if (substr($head, 0, 4) === "\x1A\x45\xDF\xA3") {
            return ['video/webm', 'webm'];
        }
        if (strlen($head) === 12 && substr($head, 4, 4) === 'ftyp') {
            $brand = substr($head, 8, 4);
            // Audio-only and still-image variants of the same container are not videos.
            if (in_array($brand, ['M4A ', 'M4B ', 'M4P ', 'heic', 'heix', 'mif1', 'msf1', 'avif'], true)) {
                $this->fail('This file is not a video. Upload an MP4, MOV or WebM video.');
            }

            return $brand === 'qt  ' ? ['video/quicktime', 'mov'] : ['video/mp4', 'mp4'];
        }

        $this->fail('This file is not a supported video. Upload an MP4, MOV or WebM video.');
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['video' => [$message]]);
    }
}
