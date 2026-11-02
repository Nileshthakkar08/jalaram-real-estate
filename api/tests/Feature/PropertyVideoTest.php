<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\User;
use App\Services\PropertyVideoService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class PropertyVideoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
    }

    /** An MP4-looking file: "ftyp" box with an mp4 brand, padded to the requested size. */
    private function mp4(int $bytes, string $brand = 'isom'): string
    {
        $head = "\x00\x00\x00\x18ftyp{$brand}";

        return $head.str_repeat("\x00", $bytes - strlen($head));
    }

    /** Sends the file in pieces the way the browser does; returns the last response. */
    private function upload(User $user, string $base, string $bytes, ?string $uploadId = null): TestResponse
    {
        $uploadId ??= (string) Str::uuid();
        $pieces = str_split($bytes, PropertyVideoService::CHUNK_BYTES);
        $response = null;
        foreach ($pieces as $index => $piece) {
            $response = $this->as($user)->post("{$base}/video/chunks", [
                'upload_id' => $uploadId, 'index' => $index, 'total' => count($pieces), 'size' => strlen($bytes),
                'chunk' => UploadedFile::fake()->createWithContent('chunk', $piece),
            ], ['Accept' => 'application/json']);
            if ($response->status() !== 202) {
                break;
            }
        }

        return $response;
    }

    public function test_owner_uploads_a_video_in_pieces_and_a_live_listing_goes_back_to_review(): void
    {
        $owner = $this->owner();
        $property = $this->publishedProperty(['owner_id' => $owner->id]);
        $size = PropertyVideoService::CHUNK_BYTES + 1000;

        $res = $this->upload($owner, "/api/v1/owner/properties/{$property->id}", $this->mp4($size))
            ->assertCreated()
            ->assertJsonPath('data.video.mime', 'video/mp4')
            ->assertJsonPath('data.video.size_bytes', $size)
            ->assertJsonPath('meta.resubmitted_for_review', true);

        $property->refresh();
        $this->assertSame('pending', $property->status);
        $this->assertStringEndsWith('.mp4', $property->video_path);
        Storage::disk('public')->assertExists($property->video_path);
        $this->assertSame($size, Storage::disk('public')->size($property->video_path));
        $this->assertStringContainsString($property->video_path, $res->json('data.video.url'));
        $this->assertSame([], Storage::disk('local')->allFiles('video-uploads')); // pieces cleaned up
    }

    public function test_staff_upload_shows_on_the_public_listing_and_replacing_or_deleting_removes_the_file(): void
    {
        $staff = $this->teamMember(['properties.moderate']);
        $property = $this->publishedProperty();
        $base = "/api/v1/admin/properties/{$property->id}";

        $this->upload($staff, $base, $this->mp4(5000, 'qt  '))->assertCreated()->assertJsonPath('data.video.mime', 'video/quicktime');
        $first = $property->refresh()->video_path;
        $this->assertStringEndsWith('.mov', $first);
        $this->assertSame('published', $property->status); // staff edits are not re-reviewed

        $this->getJson("/api/v1/properties/{$property->slug}")
            ->assertOk()->assertJsonPath('data.video.mime', 'video/quicktime');
        $this->getJson('/api/v1/properties')->assertOk()->assertJsonPath('data.0.has_video', true);

        $this->upload($staff, $base, $this->mp4(6000))->assertCreated();
        Storage::disk('public')->assertMissing($first);
        $second = $property->refresh()->video_path;

        $this->as($staff)->deleteJson("{$base}/video")->assertOk()->assertJsonPath('data.video', null);
        Storage::disk('public')->assertMissing($second);
        $this->assertNull($property->refresh()->video_path);
        $this->getJson("/api/v1/properties/{$property->slug}")->assertJsonPath('data.video', null);
    }

    public function test_non_videos_inconsistent_pieces_and_other_owners_are_rejected(): void
    {
        $owner = $this->owner();
        $property = Property::factory()->create(['owner_id' => $owner->id]);
        $base = "/api/v1/owner/properties/{$property->id}";

        // Content decides the type, not the name: a script, a photo and an audio-only MP4 are refused.
        $this->upload($owner, $base, '<?php echo "hi"; ?>'.str_repeat(' ', 500))->assertStatus(422)->assertJsonValidationErrors('video');
        $this->upload($owner, $base, $this->mp4(800, 'heic'))->assertStatus(422);
        $this->upload($owner, $base, $this->mp4(800, 'M4A '))->assertStatus(422);
        $this->assertNull($property->refresh()->video_path);
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame([], Storage::disk('local')->allFiles('video-uploads'));

        $piece = fn (int $index, int $total, int $size, int $bytes) => [
            'upload_id' => '0b6f3a7e-4c1d-4f55-9b1e-2f6a8d3c9e10', 'index' => $index, 'total' => $total, 'size' => $size,
            'chunk' => UploadedFile::fake()->createWithContent('chunk', str_repeat('a', $bytes)),
        ];
        $chunkUrl = "{$base}/video/chunks";
        $big = PropertyVideoService::CHUNK_BYTES * 2;

        // Piece count that does not match the size, a short middle piece, and a piece out of order.
        $this->as($owner)->postJson($chunkUrl, $piece(0, 1, $big, 10))->assertStatus(422);
        $this->as($owner)->postJson($chunkUrl, $piece(0, 2, $big, 10))->assertStatus(422);
        $this->as($owner)->postJson($chunkUrl, $piece(1, 2, $big, PropertyVideoService::CHUNK_BYTES))->assertStatus(422);
        // Over the 100 MB limit.
        $this->as($owner)->postJson($chunkUrl, $piece(0, 26, PropertyVideoService::MAX_BYTES + 1, 10))->assertStatus(422);

        $this->upload($this->owner(), $base, $this->mp4(800))->assertForbidden();
    }

    public function test_unfinished_uploads_are_pruned(): void
    {
        $local = Storage::disk('local');
        $local->put('video-uploads/7/old/00000.part', 'x');
        $local->put('video-uploads/8/new/00000.part', 'x');
        touch($local->path('video-uploads/7/old/00000.part'), now()->subDays(2)->getTimestamp());

        $this->artisan('videos:prune-uploads')->assertSuccessful();

        $this->assertFalse($local->exists('video-uploads/7'));
        $local->assertExists('video-uploads/8/new/00000.part');
    }
}
