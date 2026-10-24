<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DealResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_code' => $this->reference_code,
            'status' => $this->status,
            'transaction_type' => $this->transaction_type,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'asking_price' => $this->asking_price,
            'final_price' => $this->final_price,
            'security_deposit' => $this->security_deposit,
            'lease_start_date' => $this->lease_start_date?->toDateString(),
            'lease_term_months' => $this->lease_term_months,
            'estimated_brokerage' => $this->estimated_brokerage,
            'brokerage_basis' => $this->brokerage_basis,
            'rule' => $this->whenLoaded('rule', fn () => $this->rule?->only(['id', 'name', 'method'])),
            'negotiation_notes' => $this->negotiation_notes,
            'closed_reason' => $this->closed_reason,
            'agreement_date' => $this->agreement_date?->toDateString(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'assigned_to' => $this->assigned_to,
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee?->only(['id', 'name'])),
            'lead' => $this->whenLoaded('lead', fn () => $this->lead?->only(['id', 'reference_code', 'name', 'phone', 'status'])),
            'property' => $this->whenLoaded('property', fn () => $this->property ? [
                'id' => $this->property->id,
                'title' => $this->property->title,
                'reference_code' => $this->property->reference_code,
                'status' => $this->property->status,
                'property_type' => $this->property->property_type,
                'locality' => $this->property->locality?->name,
                'coordination_contact' => $this->property->coordinationContact(),
            ] : null),
            'owner' => $this->whenLoaded('owner', fn () => $this->owner?->only(['id', 'name', 'phone', 'email'])),
            'agreements' => BrokerageAgreementResource::collection($this->whenLoaded('agreements')),
            'documents' => DealDocumentResource::collection($this->whenLoaded('documents')),
            'totals' => $this->whenLoaded('agreements', fn () => $this->totals()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function totals(): array
    {
        $active = $this->agreements->where('status', '!=', 'cancelled');
        $sum = fn (string $field) => Money::fromPaise(
            $active->sum(fn ($a) => Money::toPaise($a->{$field} ?? '0'))
        );

        return [
            'agreed' => $sum('agreed_amount'),
            'invoiced' => $sum('invoiced_amount'),
            'received' => $sum('amount_received'),
            'refunded' => $sum('amount_refunded'),
            'waived' => $sum('amount_waived'),
            'outstanding' => $sum('outstanding_amount'),
        ];
    }
}
