<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PushSubscription extends Model
{
    /**
     * Only these push services may receive requests from our server. Accepting arbitrary
     * endpoints would let anyone make the server call internal URLs (SSRF).
     */
    public const ALLOWED_HOST_SUFFIXES = [
        'fcm.googleapis.com',
        'android.googleapis.com',
        'push.services.mozilla.com',
        'push.apple.com',
        'notify.windows.com',
    ];

    protected $fillable = ['endpoint', 'endpoint_hash', 'public_key', 'auth_token', 'content_encoding', 'user_agent', 'last_notified_at'];

    protected $casts = ['last_notified_at' => 'datetime'];

    public static function hashEndpoint(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }

    public static function isAllowedEndpoint(string $endpoint): bool
    {
        $parts = parse_url($endpoint);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            return false;
        }
        $host = strtolower($parts['host']);

        foreach (self::ALLOWED_HOST_SUFFIXES as $suffix) {
            if ($host === $suffix || str_ends_with($host, '.'.$suffix)) {
                return true;
            }
        }

        return false;
    }
}
