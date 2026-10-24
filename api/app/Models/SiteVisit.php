<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteVisit extends Model
{
    public const STATUSES = ['requested', 'scheduled', 'completed', 'cancelled', 'no_show'];

    public const SLOTS = ['morning', 'afternoon', 'evening'];

    protected $fillable = [
        'lead_id', 'property_id', 'status', 'requested_date', 'requested_slot', 'scheduled_at', 'assigned_to',
        'owner_confirmed', 'notes', 'customer_feedback', 'created_by',
    ];

    protected $casts = ['requested_date' => 'date', 'scheduled_at' => 'datetime', 'owner_confirmed' => 'boolean'];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class)->withTrashed();
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class)->withTrashed();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withTrashed();
    }
}
