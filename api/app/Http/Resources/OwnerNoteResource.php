<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OwnerNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'property_id' => $this->property_id,
            'lead_id' => $this->lead_id,
            'deal_id' => $this->deal_id,
            'type' => $this->type,
            'body' => $this->body,
            'user' => $this->whenLoaded('user', fn () => $this->user?->only(['id', 'name'])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
