<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = ['key', 'value', 'is_public'];

    protected $casts = ['is_public' => 'boolean'];

    /** Keys the admin settings page manages, with their public flag. */
    public const DEFINITIONS = [
        'business_phone' => true,
        'business_whatsapp' => true,
        'business_email' => true,
        'business_address' => true,
        'business_hours' => true,
        'social_instagram' => true,
        'social_facebook' => true,
        'rera_registration' => true,
        'listing_validity_days' => false,
        'lead_notification_email' => false,
    ];

    public static function get(string $key, ?string $default = null): ?string
    {
        $all = Cache::rememberForever('settings.all', fn () => static::query()->pluck('value', 'key')->all());

        $value = $all[$key] ?? null;

        return ($value === null || $value === '') ? $default : $value;
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget('settings.all'));
        static::deleted(fn () => Cache::forget('settings.all'));
    }
}
