<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadActivity extends Model
{
    public const TYPES = [
        'created', 'note', 'call', 'whatsapp', 'email', 'sms', 'meeting', 'status_change', 'assignment',
        'follow_up', 'site_visit', 'owner_coordination', 'requirement', 'negotiation', 'deal',
    ];

    /** Types a team member may log manually. */
    public const MANUAL_TYPES = ['note', 'call', 'whatsapp', 'email', 'sms', 'meeting', 'requirement', 'negotiation'];

    public const CONTACT_TYPES = ['call', 'whatsapp', 'email', 'sms', 'meeting'];

    public const OUTCOMES = ['connected', 'no_answer', 'busy', 'switched_off', 'wrong_number', 'call_back_later', 'not_interested'];

    protected $fillable = ['lead_id', 'user_id', 'type', 'outcome', 'body', 'meta'];

    protected $casts = ['meta' => 'array'];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
