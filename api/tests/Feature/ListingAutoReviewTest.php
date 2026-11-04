<?php

namespace Tests\Feature;

use App\Jobs\NotifySubscribersOfNewListing;
use App\Models\AuditLog;
use App\Models\Locality;
use App\Models\Property;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ListingAutoReviewTest extends TestCase
{
    private const DESCRIPTION = 'Well-kept 2 BHK apartment on the fourth floor with a modular kitchen, covered parking and a lift. Close to schools and the main road.';

    /** A draft that passes every automatic check unless overridden. */
    private function draft(User $owner, array $attributes = [], int $photos = 3): Property
    {
        $property = Property::factory()->create($attributes + [
            'owner_id' => $owner->id,
            'description' => self::DESCRIPTION,
            'price' => 5000000,
            'area_sqft' => 1200,
            'bedrooms' => 2,
        ]);
        for ($i = 0; $i < $photos; $i++) {
            $property->images()->create(['disk' => 'public', 'path' => "https://example.test/{$i}.jpg", 'mime_type' => 'image/jpeg', 'size_bytes' => 1, 'sort_order' => $i]);
        }

        return $property;
    }

    private function submit(User $owner, Property $property)
    {
        return $this->as($owner)->postJson("/api/v1/owner/properties/{$property->id}/submit")->assertOk();
    }

    public function test_a_listing_that_passes_every_check_is_published_automatically(): void
    {
        Queue::fake();
        $owner = $this->owner();
        $property = $this->draft($owner);

        $this->submit($owner, $property)->assertJsonPath('data.status', 'published');

        $property->refresh();
        $this->assertSame('published', $property->status);
        $this->assertNull($property->review_flags);
        $this->assertNull($property->reviewed_by); // no person reviewed it
        $this->assertNotNull($property->expires_at);
        $this->assertTrue(AuditLog::where('action', 'property.auto_approved')->where('auditable_id', $property->id)->exists());
        Queue::assertPushed(NotifySubscribersOfNewListing::class);
        $this->getJson("/api/v1/properties/{$property->slug}")->assertOk();
    }

    public function test_doubtful_listings_wait_for_a_person_with_the_reasons_shown_to_staff_only(): void
    {
        $owner = $this->owner();
        $property = $this->draft($owner, [
            'listing_purpose' => 'rent',
            'price' => 2800000, // a sale price entered as monthly rent
            'description' => self::DESCRIPTION.' Call 98250 12345 or mail me at owner@example.com.',
            'locality_id' => Locality::factory()->create(['is_active' => false, 'name' => 'Ghuma Gam']),
        ], photos: 2);

        $this->submit($owner, $property)->assertJsonPath('data.status', 'pending')->assertJsonMissingPath('data.review_flags');

        $flags = implode("\n", $property->refresh()->review_flags);
        $this->assertStringContainsString('Only 2 photo(s)', $flags);
        $this->assertStringContainsString('phone number', $flags);
        $this->assertStringContainsString('email address', $flags);
        $this->assertStringContainsString('"Ghuma Gam"', $flags);
        $this->assertStringContainsString('Rent of ₹2,800,000/month looks unusual', $flags);

        $this->as($this->admin())->getJson("/api/v1/admin/properties/{$property->id}")
            ->assertOk()->assertJsonCount(5, 'data.review_flags');
    }

    public function test_size_price_and_duplicate_checks(): void
    {
        $owner = $this->owner();
        $tiny = $this->draft($owner, ['bedrooms' => 3, 'area_sqft' => 300, 'price' => 1500000]);
        $this->submit($owner, $tiny)->assertJsonPath('data.status', 'pending');
        $this->assertStringContainsString('3 BHK in only 300 sq ft', implode(' ', $tiny->refresh()->review_flags));

        $cheap = $this->draft($owner, ['price' => 200000, 'area_sqft' => 1200]); // ₹167 per sq ft
        $this->submit($owner, $cheap);
        $this->assertStringContainsString('per sq ft', implode(' ', $cheap->refresh()->review_flags));

        $original = $this->draft($this->owner(), ['status' => 'published', 'published_at' => now()]);
        $copy = $this->draft($owner, ['locality_id' => $original->locality_id, 'area_sqft' => 1210]);
        $this->submit($owner, $copy)->assertJsonPath('data.status', 'pending');
        $this->assertStringContainsString($original->reference_code, implode(' ', $copy->refresh()->review_flags));
    }

    public function test_off_mode_leaves_everything_for_a_person_and_trusted_mode_needs_an_earlier_approval(): void
    {
        $owner = $this->owner();
        $admin = $this->admin();

        Setting::create(['key' => 'auto_approve_listings', 'value' => 'off']);
        $first = $this->draft($owner);
        $this->submit($owner, $first)->assertJsonPath('data.status', 'pending');
        $this->assertNull($first->refresh()->review_flags); // nothing wrong, just not automatic

        Setting::where('key', 'auto_approve_listings')->update(['value' => 'trusted']);
        Cache::forget('settings.all');
        $second = $this->draft($owner);
        $this->submit($owner, $second)->assertJsonPath('data.status', 'pending');
        $this->assertStringContainsString('First listing from this owner', implode(' ', $second->refresh()->review_flags));

        // Once a person has approved one of their listings, the owner's next good listing goes live by itself.
        $this->as($admin)->postJson("/api/v1/admin/properties/{$first->id}/approve")->assertOk();
        $third = $this->draft($owner);
        $this->submit($owner, $third)->assertJsonPath('data.status', 'published');
    }

    public function test_owner_edits_to_a_live_listing_are_rechecked(): void
    {
        $owner = $this->owner();
        $property = $this->draft($owner);
        $this->submit($owner, $property)->assertJsonPath('data.status', 'published');
        $url = "/api/v1/owner/properties/{$property->id}";
        $payload = fn (array $changes) => $changes + [
            'title' => $property->title, 'description' => self::DESCRIPTION, 'listing_purpose' => 'sale', 'property_type' => 'apartment',
            'locality_id' => $property->locality_id, 'public_address' => $property->public_address, 'price' => 5000000,
            'area_sqft' => 1200, 'bedrooms' => 2,
        ];

        // A harmless edit goes straight back live.
        $this->as($owner)->putJson($url, $payload(['price' => 5200000]))
            ->assertOk()->assertJsonPath('data.status', 'published')->assertJsonPath('meta.resubmitted_for_review', false);

        // Adding a phone number sends it to a person.
        $this->as($owner)->putJson($url, $payload(['description' => self::DESCRIPTION.' WhatsApp 9825012345.']))
            ->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('meta.resubmitted_for_review', true);

        // Removing it again while still pending clears the flag and publishes.
        $this->as($owner)->putJson($url, $payload([]))->assertOk()->assertJsonPath('data.status', 'published');
    }

    public function test_a_video_can_stand_in_for_photos_but_the_listing_waits_for_a_person(): void
    {
        $owner = $this->owner();
        $noMedia = $this->draft($owner, photos: 0);
        $this->as($owner)->postJson("/api/v1/owner/properties/{$noMedia->id}/submit")
            ->assertStatus(422)->assertJsonValidationErrors('images');

        $videoOnly = $this->draft($owner, ['video_disk' => 'public', 'video_path' => 'videos/tour.mp4', 'video_mime' => 'video/mp4', 'video_size_bytes' => 1000], photos: 0);
        $this->submit($owner, $videoOnly)->assertJsonPath('data.status', 'pending');
        $this->assertStringContainsString('Only 0 photo(s)', implode(' ', $videoOnly->refresh()->review_flags));
    }

    public function test_settings_accept_only_known_modes(): void
    {
        $admin = $this->admin();
        $this->as($admin)->putJson('/api/v1/admin/settings', ['settings' => ['auto_approve_listings' => 'always']])
            ->assertStatus(422);
        $this->as($admin)->putJson('/api/v1/admin/settings', ['settings' => ['auto_approve_listings' => 'trusted']])
            ->assertOk();
        $this->assertSame('trusted', Setting::get('auto_approve_listings'));
    }
}
