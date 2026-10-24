<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_code' => $this->reference_code,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'interest' => $this->interest,
            'source' => $this->source,
            'source_page' => $this->source_page,
            'utm_source' => $this->utm_source,
            'utm_medium' => $this->utm_medium,
            'utm_campaign' => $this->utm_campaign,
            'budget_min' => $this->budget_min,
            'budget_max' => $this->budget_max,
            'preferred_bhk' => $this->preferred_bhk,
            'preferred_locality' => $this->whenLoaded('preferredLocality', fn () => $this->preferredLocality?->only(['id', 'name'])),
            'preferred_locality_id' => $this->preferred_locality_id,
            'message' => $this->message,
            'requirements' => $this->requirements,
            'preferred_visit_date' => $this->preferred_visit_date?->toDateString(),
            'preferred_visit_slot' => $this->preferred_visit_slot,
            'status' => $this->status,
            'closed_reason' => $this->closed_reason,
            'assigned_to' => $this->assigned_to,
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee?->only(['id', 'name'])),
            'assigned_at' => $this->assigned_at?->toIso8601String(),
            'next_follow_up_at' => $this->next_follow_up_at?->toIso8601String(),
            'last_contacted_at' => $this->last_contacted_at?->toIso8601String(),
            'contact_attempts' => $this->contact_attempts,
            'consent_contact' => $this->consent_contact,
            'consent_marketing' => $this->consent_marketing,
            'property' => $this->whenLoaded('property', fn () => $this->property ? [
                'id' => $this->property->id,
                'title' => $this->property->title,
                'slug' => $this->property->slug,
                'reference_code' => $this->property->reference_code,
                'listing_purpose' => $this->property->listing_purpose,
                'price' => $this->property->price,
                'status' => $this->property->status,
                'public_address' => $this->property->public_address,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
