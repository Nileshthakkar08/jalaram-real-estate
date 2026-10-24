<?php

namespace Database\Factories;

use App\Models\Locality;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Locality> */
class LocalityFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->city();

        return ['name' => $name, 'slug' => Str::slug($name), 'city' => 'Ahmedabad', 'is_active' => true];
    }
}
