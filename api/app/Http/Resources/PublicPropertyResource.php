<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The ONLY representation of a property served to the public. It deliberately omits the owner,
 * private address, pincode, owner contact fields, moderation notes and all internal data.
 */
class PublicPropertyResource extends JsonResource
{
    public bool $detailed = false;

    public function detailed(): static
    {
        $this->detailed = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $images = $this->whenLoaded('images');

        $base = [
            'id' => $this->id,
            'reference_code' => $this->reference_code,
            'slug' => $this->slug,
            'title' => $this->title,
            'listing_purpose' => $this->listing_purpose,
            'property_type' => $this->property_type,
            'price' => $this->price,
            'price_negotiable' => $this->price_negotiable,
            'area_sqft' => $this->area_sqft,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'furnishing' => $this->furnishing,
            'public_address' => $this->public_address,
            'is_featured' => $this->is_featured,
            'locality' => $this->whenLoaded('locality', fn () => [
                'name' => $this->locality->name,
                'slug' => $this->locality->slug,
            ]),
            'cover_image' => $this->relationLoaded('images') && $this->images->isNotEmpty()
                ? new PropertyImageResource($this->images->first())
                : null,
            'published_at' => $this->published_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if (! $this->detailed) {
            return $base;
        }

        return $base + [
            'description' => $this->description,
            'security_deposit' => $this->security_deposit,
            'maintenance_charges' => $this->maintenance_charges,
            'balconies' => $this->balconies,
            'floor_number' => $this->floor_number,
            'total_floors' => $this->total_floors,
            'facing' => $this->facing,
            'property_age_years' => $this->property_age_years,
            'available_from' => $this->available_from?->toDateString(),
            'images' => PropertyImageResource::collection($images),
            'amenities' => $this->whenLoaded('amenities', fn () => $this->amenities->map->only(['name', 'slug'])),
        ];
    }
}
