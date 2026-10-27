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
        // Public enquiry forms: short burst limit plus a daily cap per IP.
        RateLimiter::for('enquiries', fn (Request $request) => [
            Limit::perMinute(5)->by('enq-min:'.$request->ip()),
            Limit::perDay(30)->by('enq-day:'.$request->ip()),
        ]);
        RateLimiter::for('push', fn (Request $request) => Limit::perMinute(10)->by('push:'.$request->ip()));
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by('auth:'.$request->ip()));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(20)->by('upl:'.($request->user()?->id ?? $request->ip())));
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(240)->by($request->user()?->id ?? $request->ip()));
    }
}
