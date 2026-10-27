<?php

namespace App\Jobs;

use App\Models\Property;
use App\Models\PushSubscription;
use App\Services\WebPushSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/** Sends one browser notification per subscriber when a listing is published for the first time. */
class NotifySubscribersOfNewListing implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $propertyId) {}

    public function handle(WebPushSender $sender): void
    {
        if (! $sender->isConfigured()) {
            return;
        }

        $property = Property::query()->with(['locality', 'images'])->find($this->propertyId);
        if (! $property || ! $property->isPubliclyVisible()) {
            return; // withdrawn or changed before the job ran
        }

        $payload = json_encode(self::payloadFor($property), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $sent = $expired = 0;

        PushSubscription::query()->orderBy('id')->chunkById(200, function ($subscriptions) use ($sender, $payload, &$sent, &$expired) {
            $results = $sender->send($subscriptions, $payload);

            $expiredIds = array_keys(array_filter($results, fn ($r) => $r['expired']));
            $okIds = array_keys(array_filter($results, fn ($r) => $r['success']));
            if ($expiredIds) {
                PushSubscription::whereIn('id', $expiredIds)->delete();
            }
            if ($okIds) {
                PushSubscription::whereIn('id', $okIds)->update(['last_notified_at' => now()]);
            }
            $sent += count($okIds);
            $expired += count($expiredIds);
        });

        Log::info('New-listing push sent', ['property_id' => $property->id, 'delivered' => $sent, 'expired_removed' => $expired]);
    }

    /** Only public listing data — never owner details or the private address. */
    public static function payloadFor(Property $property): array
    {
        $price = (int) round((float) $property->price);
        $amount = $price >= 10000000 ? rtrim(rtrim(number_format($price / 10000000, 2), '0'), '.').' Cr'
            : ($price >= 100000 ? rtrim(rtrim(number_format($price / 100000, 2), '0'), '.').' L' : number_format($price));
        $where = $property->locality?->name ?? 'Ahmedabad';

        return [
            'title' => 'New '.($property->listing_purpose === 'rent' ? 'rental' : 'property for sale').' in '.$where,
            'body' => Str::limit($property->title, 90).' · ₹'.$amount.($property->listing_purpose === 'rent' ? '/mo' : ''),
            'url' => '/property/'.$property->slug,
            'image' => $property->images->first()?->url(),
            'tag' => 'listing-'.$property->id,
        ];
    }
}
