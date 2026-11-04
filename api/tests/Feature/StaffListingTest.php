<?php

namespace Tests\Feature;

use App\Models\Locality;
use App\Models\Property;
use Tests\TestCase;

class StaffListingTest extends TestCase
{
    public function test_staff_add_a_listing_as_a_draft_and_publish_it_directly(): void
    {
        $admin = $this->admin();
        $res = $this->as($admin)->postJson('/api/v1/admin/properties', [
            'title' => '2 BHK in Evnandan Supreme', 'description' => 'Well-kept 2 BHK apartment with covered parking, close to the main road and schools.',
            'listing_purpose' => 'sale', 'property_type' => 'apartment', 'locality_id' => Locality::factory()->create()->id,
            'public_address' => 'Vastral, Ahmedabad', 'price' => 2800000, 'area_sqft' => 1305, 'area_unit' => 'sqyd', 'bedrooms' => 2,
            'owner_contact_name' => 'Ramesh', 'owner_contact_phone' => '9825012345', 'moderation_note' => 'Owner called the office.',
        ])->assertCreated()->assertJsonPath('data.status', 'draft');
        $property = Property::findOrFail($res->json('data.id'));
        $this->assertSame($admin->id, $property->owner_id);
        $this->assertSame('Owner called the office.', $property->moderation_note);

        // Not publishable without a photo or video.
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertStatus(422)->assertJsonValidationErrors('images');

        $property->images()->create(['disk' => 'public', 'path' => 'https://example.test/a.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 1, 'sort_order' => 0]);
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertOk()->assertJsonPath('data.status', 'published');
        $this->assertSame($admin->id, $property->refresh()->reviewed_by);
        $this->assertNotNull($property->submitted_at);
        $this->getJson("/api/v1/properties/{$property->slug}")->assertOk();
    }

    public function test_staff_can_publish_an_owners_draft_or_rejected_listing_but_owners_cannot_use_the_admin_routes(): void
    {
        $owner = $this->owner();
        $draft = Property::factory()->create(['owner_id' => $owner->id, 'status' => 'draft', 'description' => str_repeat('Nice flat. ', 5)]);
        $draft->images()->create(['disk' => 'public', 'path' => 'https://example.test/a.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 1, 'sort_order' => 0]);
        $rejected = Property::factory()->create(['owner_id' => $owner->id, 'status' => 'rejected', 'video_disk' => 'public', 'video_path' => 'videos/a.mp4', 'description' => str_repeat('Nice flat. ', 5)]);

        $this->as($owner)->postJson("/api/v1/admin/properties/{$draft->id}/approve")->assertForbidden();
        $this->as($owner)->postJson('/api/v1/admin/properties', [])->assertForbidden();

        $staff = $this->teamMember(['properties.moderate']);
        $this->as($staff)->postJson("/api/v1/admin/properties/{$draft->id}/approve")->assertOk()->assertJsonPath('data.status', 'published');
        $this->as($staff)->postJson("/api/v1/admin/properties/{$rejected->id}/approve")->assertOk()->assertJsonPath('data.status', 'published');
        $this->assertNull($rejected->refresh()->rejection_reason);

        // Live listings are not "approved" again.
        $this->as($staff)->postJson("/api/v1/admin/properties/{$draft->id}/approve")->assertStatus(409);
    }
}
