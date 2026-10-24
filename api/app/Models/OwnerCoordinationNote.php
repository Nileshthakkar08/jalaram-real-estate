<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OwnerCoordinationNote extends Model
{
    public const TYPES = ['availability', 'confirmed_price', 'viewing_availability', 'negotiation', 'owner_response', 'agreed_terms', 'general'];

    protected $fillable = ['property_id', 'lead_id', 'deal_id', 'user_id', 'type', 'body'];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
