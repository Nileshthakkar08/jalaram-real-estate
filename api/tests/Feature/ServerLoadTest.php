<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Services\PropertyImageService;
use Illuminate\Cache\RateLimiting\Unlimited;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Safeguards that keep a small server responsive during traffic spikes. */
class ServerLoadTest extends TestCase
{
    public function test_identical_searches_are_served_from_the_cache_for_a_minute(): void
    {
        $first = $this->publishedProperty();
        $this->getJson('/api/v1/properties?purpose=sale')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);

        $this->publishedProperty(['listing_purpose' => 'sale']);
        $this->getJson('/api/v1/properties?purpose=sale')->assertJsonPath('meta.total', 1); // cached
        $this->getJson('/api/v1/properties?purpose=sale&sort=newest')->assertJsonPath('meta.total', 2); // different search

        $this->travel(61)->seconds();
        $this->getJson('/api/v1/properties?purpose=sale')->assertJsonPath('meta.total', 2)->assertJsonPath('data.1.id', $first->id);
    }

    public function test_the_website_server_skips_the_api_rate_limit_only_with_the_right_key(): void
    {
        config(['services.internal_api.key' => 'secret-key']);
        $limit = fn (array $headers) => RateLimiter::limiter('api')(Request::create('/api/v1/properties', server: collect($headers)->mapWithKeys(fn ($v, $k) => ['HTTP_'.strtoupper(str_replace('-', '_', $k)) => $v])->all()));

        $this->assertInstanceOf(Unlimited::class, $limit(['X-Internal-Key' => 'secret-key']));
        $this->assertNotInstanceOf(Unlimited::class, $limit(['X-Internal-Key' => 'wrong']));
        $this->assertNotInstanceOf(Unlimited::class, $limit([]));

        config(['services.internal_api.key' => null]); // not configured: nobody skips the limit
        $this->assertNotInstanceOf(Unlimited::class, $limit(['X-Internal-Key' => '']));
    }

    public function test_photo_uploads_wait_for_a_free_processing_slot(): void
    {
        Storage::fake('public');
        config(['filesystems.image_processing_wait' => 0.3]);
        $owner = $this->owner();
        $property = Property::factory()->create(['owner_id' => $owner->id]);
        $upload = fn () => $this->as($owner)->post("/api/v1/owner/properties/{$property->id}/images",
            ['images' => [UploadedFile::fake()->image('room.jpg', 800, 600)]], ['Accept' => 'application/json']);

        $held = [];
        for ($slot = 0; $slot < PropertyImageService::PROCESSING_SLOTS; $slot++) {
            $held[] = tap(Cache::lock("image-processing-slot:{$slot}", 120))->get();
        }
        $upload()->assertStatus(503)->assertJsonPath('message', 'Many photos are being uploaded right now. Please try again in a minute.');
        $this->assertSame(0, $property->images()->count());
        $this->assertSame([], Storage::disk('public')->allFiles());

        $held[0]->release();
        $upload()->assertCreated();
        $this->assertSame(1, $property->images()->count());
    }
}
