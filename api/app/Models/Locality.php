<?php

namespace App\Models;

use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Locality extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'slug', 'city', 'description', 'image_url', 'is_active', 'sort_order'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function properties(): HasMany
    {
        return $this->hasMany(Property::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Resolve a locality typed in by hand ("Other"). Reuses an existing one with the same name
     * (case-insensitive); otherwise creates it inactive so it stays out of public filters and
     * area pages until an admin reviews and activates it.
     */
    public static function findOrCreateByName(string $name): self
    {
        $name = trim(preg_replace('/\s+/', ' ', strip_tags($name)));

        $existing = static::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
        if ($existing) {
            return $existing;
        }

        $base = Str::slug($name) ?: 'locality';
        $slug = $base;
        for ($i = 2; static::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        $locality = static::create(['name' => $name, 'slug' => $slug, 'city' => 'Ahmedabad', 'is_active' => false]);
        app(AuditLogger::class)->log('locality.suggested', $locality, [], ['name' => $name, 'slug' => $slug]);

        return $locality;
    }
}
