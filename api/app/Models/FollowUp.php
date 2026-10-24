<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUp extends Model
{
    public const CHANNELS = ['call', 'whatsapp', 'email', 'meeting', 'other'];

    protected $fillable = [
        'lead_id', 'assigned_to', 'created_by', 'due_at', 'channel', 'notes', 'status',
        'completed_at', 'completed_by', 'outcome',
    ];

    protected $casts = ['due_at' => 'datetime', 'completed_at' => 'datetime'];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withTrashed();
    }
}
