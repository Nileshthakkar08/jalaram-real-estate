<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SiteVisitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lead_id' => $this->lead_id,
            'lead' => $this->whenLoaded('lead', fn () => $this->lead?->only(['id', 'reference_code', 'name', 'phone'])),
            'property' => $this->whenLoaded('property', fn () => $this->property ? [
                'id' => $this->property->id,
                'title' => $this->property->title,
                'reference_code' => $this->property->reference_code,
                'public_address' => $this->property->public_address,
                'private_address' => $this->property->private_address,
            ] : null),
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee?->only(['id', 'name'])),
            'assigned_to' => $this->assigned_to,
            'status' => $this->status,
            'requested_date' => $this->requested_date?->toDateString(),
            'requested_slot' => $this->requested_slot,
            'scheduled_at' => $this->scheduled_at?->toIso8601String(),
            'owner_confirmed' => $this->owner_confirmed,
            'notes' => $this->notes,
            'customer_feedback' => $this->customer_feedback,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
