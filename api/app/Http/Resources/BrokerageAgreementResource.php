<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrokerageAgreementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'deal_id' => $this->deal_id,
            'party' => $this->party,
            'party_name' => $this->party_name,
            'party_phone' => $this->party_phone,
            'estimated_amount' => $this->estimated_amount,
            'agreed_amount' => $this->agreed_amount,
            'is_override' => $this->is_override,
            'override_reason' => $this->override_reason,
            'due_date' => $this->due_date?->toDateString(),
            'invoice_number' => $this->invoice_number,
            'invoice_date' => $this->invoice_date?->toDateString(),
            'invoiced_amount' => $this->invoiced_amount,
            'amount_received' => $this->amount_received,
            'amount_refunded' => $this->amount_refunded,
            'amount_waived' => $this->amount_waived,
            'outstanding_amount' => $this->outstanding_amount,
            'status' => $this->status,
            'agreed_at' => $this->agreed_at?->toIso8601String(),
            'agreed_by' => $this->whenLoaded('agreedBy', fn () => $this->agreedBy?->only(['id', 'name'])),
            'cancelled_reason' => $this->cancelled_reason,
            'notes' => $this->notes,
            'payments' => BrokeragePaymentResource::collection($this->whenLoaded('payments')),
        ];
    }
}
