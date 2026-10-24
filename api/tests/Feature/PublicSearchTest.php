<?php

namespace Tests\Feature;

use App\Models\Locality;
use App\Models\Property;
use Tests\TestCase;

class PublicSearchTest extends TestCase
{
    public function test_only_publicly_eligible_listings_are_returned(): void
    {
        $visible = $this->publishedProperty(['title' => 'Visible flat for sale']);
        foreach (['draft', 'pending', 'rejected', 'unavailable', 'expired', 'closed', 'suspended'] as $status) {
            Property::factory()->create(['status' => $status, 'title' => "Hidden {$status} listing"]);
        }
        $this->publishedProperty(['title' => 'Expired by date listing', 'expires_at' => now()->subDay()]);
        $this->publishedProperty(['title' => 'Inactive owner listing', 'owner_id' => $this->owner(['is_active' => false])->id]);
        $this->publishedProperty(['title' => 'Deleted listing'])->delete();

        $response = $this->getJson('/api/v1/properties')->assertOk();
        $this->assertSame([$visible->id], array_column($response->json('data'), 'id'));
    }

    public function test_filters_sorting_and_pagination(): void
    {
        $bodakdev = Locality::factory()->create(['slug' => 'bodakdev', 'name' => 'Bodakdev']);
        $gota = Locality::factory()->create(['slug' => 'gota', 'name' => 'Gota']);
        $a = $this->publishedProperty(['locality_id' => $bodakdev->id, 'price' => 9000000, 'bedrooms' => 3, 'title' => 'Bodakdev three bed']);
        $b = $this->publishedProperty(['locality_id' => $gota->id, 'price' => 4000000, 'bedrooms' => 2, 'title' => 'Gota two bed home']);
        $c = $this->publishedProperty(['locality_id' => $bodakdev->id, 'price' => 6000000, 'bedrooms' => 2, 'property_type' => 'villa', 'title' => 'Bodakdev villa two']);
        $r = $this->publishedProperty(['listing_purpose' => 'rent', 'price' => 15000, 'locality_id' => $bodakdev->id, 'title' => 'Rental in Bodakdev']);

        $ids = fn ($url) => array_column($this->getJson($url)->assertOk()->json('data'), 'id');

        $this->assertEqualsCanonicalizing([$a->id, $c->id], $ids('/api/v1/properties?purpose=sale&locality=bodakdev'));
        $this->assertEqualsCanonicalizing([$b->id, $c->id], $ids('/api/v1/properties?purpose=sale&bhk=2'));
        $this->assertSame([$c->id], $ids('/api/v1/properties?type=villa'));
        $this->assertSame([$b->id, $c->id, $a->id], $ids('/api/v1/properties?purpose=sale&sort=price_asc'));
        $this->assertSame([$c->id], $ids('/api/v1/properties?purpose=sale&min_price=5000000&max_price=7000000'));
        $this->assertSame([$r->id], $ids('/api/v1/properties?purpose=rent'));
        $this->assertSame([$b->id], $ids('/api/v1/properties?q=Gota'));

        $page = $this->getJson('/api/v1/properties?purpose=sale&per_page=2&page=2&sort=price_asc')->assertOk();
        $this->assertSame(3, $page->json('meta.total'));
        $this->assertSame([$a->id], array_column($page->json('data'), 'id'));

        $this->getJson('/api/v1/properties?sort=evil')->assertStatus(422);
    }

    public function test_detail_page_never_exposes_owner_or_private_data(): void
    {
        $owner = $this->owner(['phone' => '9111111111', 'email' => 'secret-owner@example.com']);
        $property = $this->publishedProperty([
            'owner_id' => $owner->id, 'private_address' => 'Flat 12, Secret Tower', 'owner_contact_phone' => '9222222222',
            'moderation_note' => 'internal only', 'pincode' => '380054',
        ]);

        $body = $this->getJson("/api/v1/properties/{$property->slug}")->assertOk()->getContent();
        foreach (['Secret Tower', '9111111111', '9222222222', 'secret-owner@example.com', 'internal only', '380054', 'owner_id', 'private_address'] as $secret) {
            $this->assertStringNotContainsString($secret, $body);
        }

        $property->update(['status' => 'suspended']);
        $this->getJson("/api/v1/properties/{$property->slug}")->assertNotFound();
    }

    public function test_localities_include_public_listing_counts(): void
    {
        $loc = Locality::factory()->create(['slug' => 'thaltej']);
        $this->publishedProperty(['locality_id' => $loc->id]);
        Property::factory()->create(['locality_id' => $loc->id, 'status' => 'pending']);

        $row = collect($this->getJson('/api/v1/localities')->json('data'))->firstWhere('slug', 'thaltej');
        $this->assertSame(1, $row['listing_count']);
    }
}
