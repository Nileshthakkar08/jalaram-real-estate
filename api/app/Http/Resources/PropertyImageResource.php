<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PropertyImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url(),
            'width' => $this->width,
            'height' => $this->height,
            'sort_order' => $this->sort_order,
            'alt' => $this->alt_text,
        ];
    }
}
