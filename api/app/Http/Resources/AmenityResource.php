<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AmenityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'is_active' => $this->when($request->user()?->isAdmin(), $this->is_active),
            'sort_order' => $this->when($request->user()?->isAdmin(), $this->sort_order),
            'properties_count' => $this->whenCounted('properties'),
        ];
    }
}
