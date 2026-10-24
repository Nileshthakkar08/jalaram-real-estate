<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Deal extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUSES = ['negotiation', 'agreement_pending', 'closed_won', 'closed_lost', 'cancelled'];

    public const OPEN_STATUSES = ['negotiation', 'agreement_pending'];

    protected $fillable = [
        'reference_code', 'property_id', 'lead_id', 'owner_id', 'assigned_to', 'created_by', 'transaction_type', 'status',
        'customer_name', 'customer_phone', 'asking_price', 'final_price', 'security_deposit', 'lease_start_date',
        'lease_term_months', 'brokerage_rule_id', 'brokerage_basis', 'estimated_brokerage', 'negotiation_notes',
        'closed_reason', 'agreement_date', 'closed_at',
    ];

    protected $casts = [
        'asking_price' => 'decimal:2',
        'final_price' => 'decimal:2',
        'security_deposit' => 'decimal:2',
        'estimated_brokerage' => 'decimal:2',
        'brokerage_basis' => 'array',
        'lease_start_date' => 'date',
        'lease_term_months' => 'integer',
        'agreement_date' => 'date',
        'closed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::created(function (Deal $deal) {
            $deal->forceFill(['reference_code' => sprintf('DL-%06d', $deal->id)])->saveQuietly();
        });
    }

    /** Team members see their own deals; admins and finance managers see all. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasPermission('finance.manage')) {
            return $query;
        }

        return $query->where('assigned_to', $user->id);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class)->withTrashed();
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class)->withTrashed();
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id')->withTrashed();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withTrashed();
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(BrokerageRule::class, 'brokerage_rule_id')->withTrashed();
    }

    public function agreements(): HasMany
    {
        return $this->hasMany(BrokerageAgreement::class)->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(BrokeragePayment::class)->orderByDesc('payment_date')->orderByDesc('id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(DealDocument::class)->latest('id');
    }
}
