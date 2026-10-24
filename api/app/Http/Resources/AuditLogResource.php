<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'auditable_type' => $this->auditable_type,
            'auditable_id' => $this->auditable_id,
            'old_values' => $this->old_values,
            'new_values' => $this->new_values,
            'reason' => $this->reason,
            'ip_address' => $this->ip_address,
            'user' => $this->whenLoaded('user', fn () => $this->user?->only(['id', 'name', 'role'])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
