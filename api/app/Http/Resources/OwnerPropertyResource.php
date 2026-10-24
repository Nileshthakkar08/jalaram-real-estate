<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A property as its owner (or staff) sees it. Internal moderation notes are staff-only. */
class OwnerPropertyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isStaff = (bool) $request->user()?->isStaff();

        return [
            'id' => $this->id,
            'reference_code' => $this->reference_code,
            'slug' => $this->slug,
            'title' => $this->title,
            'description' => $this->description,
            'listing_purpose' => $this->listing_purpose,
            'property_type' => $this->property_type,
            'locality_id' => $this->locality_id,
            'locality' => $this->whenLoaded('locality', fn () => ['id' => $this->locality->id, 'name' => $this->locality->name, 'slug' => $this->locality->slug]),
            'public_address' => $this->public_address,
            'private_address' => $this->private_address,
            'pincode' => $this->pincode,
            'price' => $this->price,
            'security_deposit' => $this->security_deposit,
            'maintenance_charges' => $this->maintenance_charges,
            'price_negotiable' => $this->price_negotiable,
            'area_sqft' => $this->area_sqft,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'balconies' => $this->balconies,
            'floor_number' => $this->floor_number,
            'total_floors' => $this->total_floors,
            'furnishing' => $this->furnishing,
            'facing' => $this->facing,
            'property_age_years' => $this->property_age_years,
            'available_from' => $this->available_from?->toDateString(),
            'owner_contact_name' => $this->owner_contact_name,
            'owner_contact_phone' => $this->owner_contact_phone,
            'owner_contact_email' => $this->owner_contact_email,
            'status' => $this->status,
            'rejection_reason' => $this->rejection_reason,
            'is_featured' => $this->is_featured,
            'is_public' => $this->isPubliclyVisible(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'images' => PropertyImageResource::collection($this->whenLoaded('images')),
            'cover_image' => $this->relationLoaded('images') && $this->images->isNotEmpty() ? new PropertyImageResource($this->images->first()) : null,
            'amenity_ids' => $this->whenLoaded('amenities', fn () => $this->amenities->pluck('id')),
            'amenities' => $this->whenLoaded('amenities', fn () => $this->amenities->map->only(['id', 'name', 'slug'])),

            // Staff-only fields
            'moderation_note' => $this->when($isStaff, $this->moderation_note),
            'owner' => $this->when($isStaff && $this->relationLoaded('owner'), fn () => [
                'id' => $this->owner->id, 'name' => $this->owner->name, 'email' => $this->owner->email,
                'phone' => $this->owner->phone, 'is_active' => $this->owner->is_active,
            ]),
            'coordination_contact' => $this->when($isStaff && $this->relationLoaded('owner'), fn () => $this->coordinationContact()),
            'reviewer' => $this->when($isStaff && $this->relationLoaded('reviewer'), fn () => $this->reviewer?->only(['id', 'name'])),
            'leads_count' => $this->when($isStaff, fn () => $this->leads_count ?? null),
            'deals_count' => $this->when($isStaff, fn () => $this->deals_count ?? null),
        ];
    }
}
