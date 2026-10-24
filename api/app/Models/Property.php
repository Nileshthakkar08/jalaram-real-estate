<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Property extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUSES = ['draft', 'pending', 'published', 'rejected', 'unavailable', 'expired', 'closed', 'suspended'];

    public const TYPES = ['apartment', 'independent_house', 'villa', 'plot'];

    public const PURPOSES = ['sale', 'rent'];

    public const FURNISHING = ['unfurnished', 'semi_furnished', 'fully_furnished'];

    public const FACING = ['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west'];

    public const MAX_IMAGES = 10;

    /** Fields an owner may edit. Status and moderation fields are deliberately excluded. */
    public const OWNER_EDITABLE = [
        'title', 'description', 'listing_purpose', 'property_type', 'locality_id', 'public_address', 'private_address',
        'pincode', 'price', 'security_deposit', 'maintenance_charges', 'price_negotiable', 'area_sqft', 'bedrooms',
        'bathrooms', 'balconies', 'floor_number', 'total_floors', 'furnishing', 'facing', 'property_age_years',
        'available_from', 'owner_contact_name', 'owner_contact_phone', 'owner_contact_email',
    ];

    protected $fillable = [
        ...self::OWNER_EDITABLE,
        'owner_id', 'reference_code', 'slug', 'status', 'rejection_reason', 'moderation_note', 'is_featured',
        'submitted_at', 'published_at', 'expires_at', 'reviewed_at', 'reviewed_by',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'security_deposit' => 'decimal:2',
        'maintenance_charges' => 'decimal:2',
        'price_negotiable' => 'boolean',
        'is_featured' => 'boolean',
        'area_sqft' => 'integer',
        'bedrooms' => 'integer',
        'bathrooms' => 'integer',
        'balconies' => 'integer',
        'floor_number' => 'integer',
        'total_floors' => 'integer',
        'property_age_years' => 'integer',
        'available_from' => 'date',
        'submitted_at' => 'datetime',
        'published_at' => 'datetime',
        'expires_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Property $property) {
            $property->slug ??= Str::slug(Str::limit($property->title, 80, '')).'-'.Str::lower(Str::random(6));
        });

        static::created(function (Property $property) {
            $property->forceFill([
                'reference_code' => sprintf('JRE-%06d', $property->id),
                'slug' => Str::slug(Str::limit($property->title, 80, '')).'-'.$property->id,
            ])->saveQuietly();
        });
    }

    /** The single definition of "may appear on the public website". */
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->where('properties.status', 'published')
            ->where(fn (Builder $q) => $q->whereNull('properties.expires_at')->orWhere('properties.expires_at', '>', now()))
            ->whereHas('owner', fn (Builder $q) => $q->where('is_active', true));
    }

    public function isPubliclyVisible(): bool
    {
        return $this->status === 'published'
            && ! $this->trashed()
            && ($this->expires_at === null || $this->expires_at->isFuture())
            && (bool) $this->owner?->is_active;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id')->withTrashed();
    }

    public function locality(): BelongsTo
    {
        return $this->belongsTo(Locality::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by')->withTrashed();
    }

    public function images(): HasMany
    {
        return $this->hasMany(PropertyImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function amenities(): BelongsToMany
    {
        return $this->belongsToMany(Amenity::class)->orderBy('sort_order')->orderBy('name');
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class);
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class);
    }

    public function ownerNotes(): HasMany
    {
        return $this->hasMany(OwnerCoordinationNote::class)->latest();
    }

    /** Coordination contact for the team: explicit contact fields, falling back to the owner's account. */
    public function coordinationContact(): array
    {
        return [
            'name' => $this->owner_contact_name ?: $this->owner?->name,
            'phone' => $this->owner_contact_phone ?: $this->owner?->phone,
            'email' => $this->owner_contact_email ?: $this->owner?->email,
        ];
    }
}
