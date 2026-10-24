<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrokeragePaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brokerage_agreement_id' => $this->brokerage_agreement_id,
            'type' => $this->type,
            'amount' => $this->amount,
            'payment_date' => $this->payment_date?->toDateString(),
            'method' => $this->method,
            'reference_number' => $this->reference_number,
            'receipt_number' => $this->receipt_number,
            'notes' => $this->notes,
            'recorded_by' => $this->whenLoaded('recorder', fn () => $this->recorder?->only(['id', 'name'])),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'void_reason' => $this->void_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
