<?php

namespace Tests\Feature;

use App\Models\Locality;
use App\Models\Property;
use Tests\TestCase;

class LandListingTest extends TestCase
{
    private function payload(array $changes = []): array
    {
        return $changes + [
            'title' => 'Agricultural land near Sanand highway', 'description' => 'Open land with road access.',
            'listing_purpose' => 'sale', 'property_type' => 'plot', 'land_type' => 'agricultural',
            'locality_id' => Locality::factory()->create()->id, 'public_address' => 'Near Sanand highway',
            'price' => 90000000, 'area_sqft' => 435600, 'area_unit' => 'acre',
            // House-only fields an owner may have filled before switching the type to land.
            'bedrooms' => 3, 'bathrooms' => 2, 'floor_number' => 4, 'furnishing' => 'fully_furnished',
        ];
    }

    public function test_land_keeps_its_type_and_unit_and_drops_building_fields(): void
    {
        $owner = $this->owner();

        $id = $this->as($owner)->postJson('/api/v1/owner/properties', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.land_type', 'agricultural')
            ->assertJsonPath('data.area_unit', 'acre')
            ->assertJsonPath('data.area_sqft', 435600)
            ->assertJsonPath('data.bedrooms', null)
            ->assertJsonPath('data.furnishing', null)
            ->json('data.id');

        $property = Property::findOrFail($id);
        $this->assertNull($property->bathrooms);
        $this->assertNull($property->floor_number);

        // Switching to a building clears the land type; the unit defaults to sq ft.
        $this->as($owner)->putJson("/api/v1/owner/properties/{$id}", $this->payload([
            'property_type' => 'independent_house', 'area_sqft' => 1800, 'area_unit' => null, 'bedrooms' => 3,
        ]))->assertOk()->assertJsonPath('data.land_type', null)->assertJsonPath('data.area_unit', 'sqft')->assertJsonPath('data.bedrooms', 3);
    }

    public function test_large_farmland_fits_but_unknown_values_are_rejected(): void
    {
        $owner = $this->owner();
        $this->as($owner)->postJson('/api/v1/owner/properties', $this->payload(['area_sqft' => 87120000])) // 2,000 acres
            ->assertCreated();
        $this->as($owner)->postJson('/api/v1/owner/properties', $this->payload(['area_sqft' => 100000001]))
            ->assertStatus(422)->assertJsonValidationErrors('area_sqft');
        $this->as($owner)->postJson('/api/v1/owner/properties', $this->payload(['land_type' => 'forest', 'area_unit' => 'bigha']))
            ->assertStatus(422)->assertJsonValidationErrors(['land_type', 'area_unit']);
    }
}
