<?php

namespace Database\Factories;

use App\Models\BrokerageRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BrokerageRule> */
class BrokerageRuleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Sale — percentage of final price',
            'transaction_type' => 'sale',
            'method' => 'percentage',
            'percentage' => '1.0000',
            'percentage_basis' => 'final_sale_price',
            'payer' => 'buyer',
            'effective_from' => now()->subYear()->toDateString(),
            'is_active' => true,
        ];
    }

    public function rentFixed(string $amount = '10000'): static
    {
        return $this->state(fn () => [
            'name' => 'Rent — fixed', 'transaction_type' => 'rent', 'method' => 'fixed', 'fixed_amount' => $amount,
            'percentage' => null, 'percentage_basis' => null, 'payer' => 'tenant',
        ]);
    }
}
