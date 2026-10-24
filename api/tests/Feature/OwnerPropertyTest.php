<?php

namespace Tests\Feature;

use App\Models\Amenity;
use App\Models\Lead;
use App\Models\Locality;
use App\Models\Property;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OwnerPropertyTest extends TestCase
{
    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'Sunny 2 BHK near Vastrapur Lake',
            'description' => 'A bright, well-ventilated home close to schools and the lake, with covered parking.',
            'listing_purpose' => 'rent',
            'property_type' => 'apartment',
            'locality_id' => Locality::factory()->create()->id,
            'public_address' => 'Near Vastrapur Lake',
            'private_address' => 'B-402, Example Residency',
            'price' => 18000,
            'security_deposit' => 50000,
            'area_sqft' => 1100,
            'bedrooms' => 2,
            'bathrooms' => 2,
            'furnishing' => 'semi_furnished',
            'amenity_ids' => [Amenity::create(['name' => 'Lift', 'slug' => 'lift'])->id],
        ];
    }

    private function jpeg(int $w = 800, int $h = 600): UploadedFile
    {
        return UploadedFile::fake()->image('photo.jpg', $w, $h);
    }

    public function test_owner_creates_draft_and_cannot_set_status_or_featured(): void
    {
        $owner = $this->owner();
        $res = $this->as($owner)->postJson('/api/v1/owner/properties', $this->payload(['status' => 'published', 'is_featured' => true, 'owner_id' => 999]))
            ->assertCreated()->assertJsonPath('data.status', 'draft');

        $property = Property::findOrFail($res->json('data.id'));
        $this->assertSame($owner->id, $property->owner_id);
        $this->assertFalse($property->is_featured);
        $this->assertSame(1, $property->amenities()->count());
        $this->assertMatchesRegularExpression('/^JRE-\d{6}$/', $property->reference_code);
    }

    public function test_owners_are_isolated_from_each_other(): void
    {
        $mine = Property::factory()->create(['owner_id' => $this->owner()->id]);
        $intruder = $this->owner();

        $this->as($intruder)->getJson("/api/v1/owner/properties/{$mine->id}")->assertForbidden();
        $this->as($intruder)->putJson("/api/v1/owner/properties/{$mine->id}", $this->payload())->assertForbidden();
        $this->as($intruder)->deleteJson("/api/v1/owner/properties/{$mine->id}")->assertForbidden();
        $this->as($intruder)->postJson("/api/v1/owner/properties/{$mine->id}/submit")->assertForbidden();
        $this->as($intruder)->postJson("/api/v1/owner/properties/{$mine->id}/images", ['images' => [$this->jpeg()]])->assertForbidden();
        $this->assertSame([], $this->as($intruder)->getJson('/api/v1/owner/properties')->json('data'));
    }

    public function test_owners_cannot_reach_team_admin_or_lead_data(): void
    {
        $owner = $this->owner();
        $property = $this->publishedProperty(['owner_id' => $owner->id]);
        Lead::factory()->create(['property_id' => $property->id]);

        $this->as($owner)->getJson('/api/v1/team/leads')->assertForbidden();
        $this->as($owner)->getJson('/api/v1/team/deals')->assertForbidden();
        $this->as($owner)->getJson('/api/v1/admin/properties')->assertForbidden();
        $this->as($owner)->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertForbidden();
        $this->as($owner)->getJson('/api/v1/team/brokerage/summary')->assertForbidden();

        $dashboard = $this->as($owner)->getJson('/api/v1/owner/dashboard')->assertOk()->getContent();
        $this->assertStringNotContainsString('lead', strtolower($dashboard));
    }

    public function test_image_upload_validation_ordering_deletion_and_limit(): void
    {
        Storage::fake('public');
        $owner = $this->owner();
        $property = Property::factory()->create(['owner_id' => $owner->id]);
        $url = "/api/v1/owner/properties/{$property->id}/images";

        // Wrong type, fake image content, oversized file.
        $this->as($owner)->postJson($url, ['images' => [UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')]])->assertStatus(422);
        $this->as($owner)->postJson($url, ['images' => [UploadedFile::fake()->createWithContent('evil.jpg', '<?php echo 1; ?>')]])->assertStatus(422);
        $this->as($owner)->postJson($url, ['images' => [UploadedFile::fake()->image('big.jpg')->size(6000)]])->assertStatus(422);
        $this->assertSame(0, $property->images()->count());

        $res = $this->as($owner)->postJson($url, ['images' => [$this->jpeg(), UploadedFile::fake()->image('b.png', 900, 700), $this->jpeg(3000, 2000)]])->assertCreated();
        $images = $property->images()->get();
        $this->assertCount(3, $images);
        foreach ($images as $image) {
            Storage::disk('public')->assertExists($image->path);
            $this->assertMatchesRegularExpression('#^properties/\d+/[0-9a-f-]{36}\.(jpg|png)$#', $image->path);
        }
        $this->assertSame(2000, $images[2]->width); // downscaled

        $ids = array_column($res->json('data'), 'id');
        $this->as($owner)->putJson("{$url}/order", ['image_ids' => array_reverse($ids)])->assertOk();
        $this->assertSame(array_reverse($ids), $property->images()->pluck('id')->all());
        $this->as($owner)->putJson("{$url}/order", ['image_ids' => [$ids[0]]])->assertStatus(422);

        $first = $images[0];
        $this->as($owner)->deleteJson("{$url}/{$first->id}")->assertOk();
        Storage::disk('public')->assertMissing($first->path);

        // 2 remain; 9 more would exceed 10 → nothing stored (all-or-nothing).
        $this->as($owner)->postJson($url, ['images' => array_map(fn () => $this->jpeg(), range(1, 9))])->assertStatus(422);
        $this->assertSame(2, $property->images()->count());
        $this->assertCount(2, Storage::disk('public')->allFiles("properties/{$property->id}"));
    }

    public function test_submission_requires_photos_and_live_edits_return_to_review(): void
    {
        Storage::fake('public');
        $owner = $this->owner();
        $property = Property::factory()->create(['owner_id' => $owner->id, 'description' => str_repeat('Nice home. ', 5)]);

        $this->as($owner)->postJson("/api/v1/owner/properties/{$property->id}/submit")->assertStatus(422)->assertJsonValidationErrors(['images']);
        $this->as($owner)->postJson("/api/v1/owner/properties/{$property->id}/images", ['images' => [$this->jpeg()]])->assertCreated();
        $this->as($owner)->postJson("/api/v1/owner/properties/{$property->id}/submit")->assertOk()->assertJsonPath('data.status', 'pending');
        $this->as($owner)->postJson("/api/v1/owner/properties/{$property->id}/submit")->assertStatus(409);

        $property->update(['status' => 'published', 'published_at' => now()]);
        $this->as($owner)->putJson("/api/v1/owner/properties/{$property->id}", $this->payload(['locality_id' => $property->locality_id]))
            ->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('meta.resubmitted_for_review', true);
    }

    public function test_availability_toggle_close_and_delete_rules(): void
    {
        $owner = $this->owner();
        $property = $this->publishedProperty(['owner_id' => $owner->id]);
        $base = "/api/v1/owner/properties/{$property->id}";

        $this->as($owner)->postJson("{$base}/availability", ['available' => false])->assertOk()->assertJsonPath('data.status', 'unavailable');
        $this->getJson('/api/v1/properties')->assertJsonCount(0, 'data');
        $this->as($owner)->postJson("{$base}/availability", ['available' => true])->assertOk()->assertJsonPath('data.status', 'published');
        $this->as($owner)->deleteJson($base)->assertForbidden(); // only draft/rejected can be deleted
        $this->as($owner)->postJson("{$base}/close")->assertOk()->assertJsonPath('data.status', 'closed');
        $this->as($owner)->putJson($base, $this->payload())->assertStatus(409);
    }
}
