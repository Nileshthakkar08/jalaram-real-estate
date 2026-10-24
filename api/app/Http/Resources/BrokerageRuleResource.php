<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrokerageRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'transaction_type' => $this->transaction_type,
            'method' => $this->method,
            'fixed_amount' => $this->fixed_amount,
            'percentage' => $this->percentage,
            'percentage_basis' => $this->percentage_basis,
            'min_amount' => $this->min_amount,
            'max_amount' => $this->max_amount,
            'payer' => $this->payer,
            'split_shares' => $this->split_shares,
            'property_type' => $this->property_type,
            'locality_id' => $this->locality_id,
            'locality' => $this->whenLoaded('locality', fn () => $this->locality?->only(['id', 'name'])),
            'effective_from' => $this->effective_from?->toDateString(),
            'effective_to' => $this->effective_to?->toDateString(),
            'is_active' => $this->is_active,
            'priority' => $this->priority,
            'notes' => $this->notes,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
