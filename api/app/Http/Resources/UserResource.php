<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'permissions' => $this->effectivePermissions(),
            'granted_permissions' => $this->permissions ?? [],
            'is_active' => $this->is_active,
            'email_verified' => $this->email_verified_at !== null,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'properties_count' => $this->whenCounted('properties'),
            'assigned_leads_count' => $this->whenCounted('assignedLeads'),
        ];
    }
}
