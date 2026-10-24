<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'site_visit', 'negotiation', 'won', 'lost', 'cancelled'];

    public const OPEN_STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'site_visit', 'negotiation'];

    public const INTERESTS = ['buy', 'rent', 'sell', 'general'];

    public const SOURCES = ['website', 'phone', 'whatsapp', 'walk_in', 'referral', 'social', 'other'];

    protected $fillable = [
        'reference_code', 'name', 'phone', 'phone_normalized', 'email', 'property_id', 'interest', 'source', 'source_page',
        'utm_source', 'utm_medium', 'utm_campaign', 'budget_min', 'budget_max', 'preferred_locality_id', 'preferred_bhk',
        'message', 'requirements', 'preferred_visit_date', 'preferred_visit_slot', 'status', 'closed_reason',
        'assigned_to', 'assigned_at', 'next_follow_up_at', 'last_contacted_at', 'contact_attempts',
        'consent_contact', 'consent_marketing', 'ip_address',
    ];

    protected $casts = [
        'budget_min' => 'decimal:2',
        'budget_max' => 'decimal:2',
        'preferred_bhk' => 'integer',
        'preferred_visit_date' => 'date',
        'assigned_at' => 'datetime',
        'next_follow_up_at' => 'datetime',
        'last_contacted_at' => 'datetime',
        'contact_attempts' => 'integer',
        'consent_contact' => 'boolean',
        'consent_marketing' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (Lead $lead) {
            $lead->phone_normalized = static::normalizePhone($lead->phone);
        });

        static::created(function (Lead $lead) {
            $lead->forceFill(['reference_code' => sprintf('LD-%06d', $lead->id)])->saveQuietly();
        });
    }

    /** Last 10 digits — Indian mobile numbers with or without +91 / 0 prefixes compare equal. */
    public static function normalizePhone(?string $phone): string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);

        return substr($digits, -10);
    }

    /** Leads a user may see: admins and `leads.view_all` see everything; others see their own plus the unassigned inbox. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasPermission('leads.view_all')) {
            return $query;
        }

        return $query->where(fn (Builder $q) => $q->where('assigned_to', $user->id)->orWhereNull('assigned_to'));
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class)->withTrashed();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withTrashed();
    }

    public function preferredLocality(): BelongsTo
    {
        return $this->belongsTo(Locality::class, 'preferred_locality_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(LeadActivity::class)->latest('id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(FollowUp::class)->orderBy('due_at');
    }

    public function siteVisits(): HasMany
    {
        return $this->hasMany(SiteVisit::class)->latest('id');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class)->latest('id');
    }
}
