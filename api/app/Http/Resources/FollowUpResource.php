<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FollowUpResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lead_id' => $this->lead_id,
            'lead' => $this->whenLoaded('lead', fn () => $this->lead?->only(['id', 'reference_code', 'name', 'phone', 'status', 'interest'])),
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee?->only(['id', 'name'])),
            'due_at' => $this->due_at?->toIso8601String(),
            'channel' => $this->channel,
            'notes' => $this->notes,
            'status' => $this->status,
            'outcome' => $this->outcome,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'is_overdue' => $this->status === 'pending' && $this->due_at?->isPast() && ! $this->due_at?->isToday(),
        ];
    }
}
