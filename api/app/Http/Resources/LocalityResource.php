<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocalityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'city' => $this->city,
            'description' => $this->description,
            'image_url' => $this->image_url,
            'is_active' => $this->when($request->user()?->isAdmin(), $this->is_active),
            'sort_order' => $this->when($request->user()?->isAdmin(), $this->sort_order),
            'listing_count' => $this->whenHas('listing_count', fn () => (int) $this->listing_count),
            'properties_count' => $this->whenCounted('properties'),
        ];
    }
}
