<?php

namespace Database\Factories;

use App\Models\Locality;
use App\Models\Property;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Property> */
class PropertyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'owner_id' => User::factory(),
            'locality_id' => Locality::factory(),
            'title' => fake()->randomElement(['Spacious', 'Bright', 'Well-maintained', 'Corner']).' '.fake()->numberBetween(1, 4).' BHK Apartment',
            'description' => fake()->paragraph(4),
            'listing_purpose' => 'sale',
            'property_type' => 'apartment',
            'public_address' => 'Near '.fake()->streetName(),
            'private_address' => fake()->buildingNumber().', '.fake()->streetAddress(),
            'price' => 5000000,
            'area_sqft' => 1200,
            'bedrooms' => 2,
            'bathrooms' => 2,
            'furnishing' => 'semi_furnished',
            'status' => 'draft',
        ];
    }

    public function rent(int $monthly = 12000): static
    {
        return $this->state(fn () => ['listing_purpose' => 'rent', 'price' => $monthly, 'security_deposit' => $monthly * 2]);
    }

    public function published(): static
    {
        return $this->state(fn () => ['status' => 'published', 'published_at' => now(), 'expires_at' => now()->addDays(90)]);
    }
}
