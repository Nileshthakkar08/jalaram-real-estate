<?php

namespace Tests;

use App\Models\BrokerageRule;
use App\Models\Lead;
use App\Models\Locality;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function owner(array $attributes = []): User
    {
        return User::factory()->create($attributes);
    }

    protected function teamMember(array $permissions = []): User
    {
        return User::factory()->teamMember($permissions)->create();
    }

    protected function admin(): User
    {
        return User::factory()->admin()->create();
    }

    protected function as(User $user): static
    {
        // Sanctum's request guard caches the resolved user; reset so tests can switch users.
        $this->app['auth']->forgetGuards();
        $this->actingAs($user, 'web');

        return $this;
    }

    protected function publishedProperty(array $attributes = []): Property
    {
        $property = Property::factory()->published()->create($attributes + ['locality_id' => Locality::factory()]);
        $property->images()->create(['disk' => 'public', 'path' => 'https://example.test/a.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 1, 'sort_order' => 0]);

        return $property->fresh();
    }

    /** A lead created the way the website creates them. */
    protected function websiteLead(?Property $property = null, array $attributes = []): Lead
    {
        $this->postJson('/api/v1/enquiries', $attributes + [
            'name' => 'Asha Patel',
            'phone' => '98' . random_int(10000000, 99999999),
            'interest' => 'general',
            'property_id' => $property?->id,
            'consent_contact' => true,
        ])->assertSuccessful();

        return Lead::query()->latest('id')->firstOrFail();
    }

    protected function rentRuleFixed(string $amount = '10000', string $payer = 'tenant'): BrokerageRule
    {
        return BrokerageRule::factory()->rentFixed($amount)->create(['payer' => $payer]);
    }

    protected function saleRulePercent(string $percent = '1', string $payer = 'buyer'): BrokerageRule
    {
        return BrokerageRule::factory()->create(['percentage' => $percent, 'payer' => $payer]);
    }
}
