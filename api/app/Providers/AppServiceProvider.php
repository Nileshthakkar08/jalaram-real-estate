<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Public enquiry forms. Mobile networks put many phones behind one IP, so the IP limits are
        // generous and the tight limit is per phone number (which also stops repeat spam).
        RateLimiter::for('enquiries', function (Request $request) {
            $phone = preg_replace('/\D/', '', (string) $request->input('phone'));

            return array_filter([
                Limit::perMinute(10)->by('enq-min:'.$request->ip()),
                Limit::perDay(150)->by('enq-day:'.$request->ip()),
                strlen($phone) >= 10 ? Limit::perDay(5)->by('enq-phone:'.substr($phone, -10)) : null,
            ]);
        });
        RateLimiter::for('push', fn (Request $request) => Limit::perMinute(10)->by('push:'.$request->ip()));
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by('auth:'.$request->ip()));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(20)->by('upl:'.($request->user()?->id ?? $request->ip())));
        // A 100 MB video is 25 pieces of 4 MB; allow a couple of retries on top.
        RateLimiter::for('video-chunks', fn (Request $request) => Limit::perMinute(40)->by('vid:'.($request->user()?->id ?? $request->ip())));
        RateLimiter::for('api', function (Request $request) {
            // The website's own server renders pages for every visitor from a few addresses; it
            // proves itself with a shared key so a traffic spike is not mistaken for abuse.
            $key = (string) config('services.internal_api.key');
            if ($key !== '' && hash_equals($key, (string) $request->header('X-Internal-Key'))) {
                return Limit::none();
            }

            return Limit::perMinute(240)->by($request->user()?->id ?? $request->ip());
        });
    }
}
