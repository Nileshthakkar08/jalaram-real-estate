<?php

namespace Database\Factories;

use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Lead> */
class LeadFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'phone' => '97'.fake()->unique()->numerify('########'),
            'email' => fake()->safeEmail(),
            'interest' => 'buy',
            'source' => 'website',
            'status' => 'new',
            'consent_contact' => true,
        ];
    }
}
