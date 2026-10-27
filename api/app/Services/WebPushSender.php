<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Collection;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Psr\Log\LoggerInterface;

/** Thin wrapper around minishlink/web-push so delivery can be faked in tests. */
class WebPushSender
{
    public function isConfigured(): bool
    {
        return filled(config('services.webpush.public_key')) && filled(config('services.webpush.private_key'));
    }

    /**
     * @param  Collection<int, PushSubscription>  $subscriptions
     * @return array<int, array{success: bool, expired: bool, reason: string}> keyed by subscription id
     */
    public function send(Collection $subscriptions, string $payload): array
    {
        $webPush = new WebPush(['VAPID' => [
            'subject' => config('services.webpush.subject'),
            'publicKey' => config('services.webpush.public_key'),
            'privateKey' => config('services.webpush.private_key'),
        ]], ['TTL' => 86400, 'urgency' => 'normal'], logger: app(LoggerInterface::class));
        // With a logger, library notices (e.g. "install GMP/BCMath") are logged instead of
        // raised via trigger_error(), which Laravel would turn into a fatal exception.

        $idsByEndpoint = [];
        foreach ($subscriptions as $sub) {
            $idsByEndpoint[$sub->endpoint] = $sub->id;
            $webPush->queueNotification(Subscription::create([
                'endpoint' => $sub->endpoint,
                'publicKey' => $sub->public_key,
                'authToken' => $sub->auth_token,
                'contentEncoding' => $sub->content_encoding,
            ]), $payload);
        }

        $results = [];
        foreach ($webPush->flush() as $report) {
            $id = $idsByEndpoint[$report->getEndpoint()] ?? null;
            if ($id !== null) {
                $results[$id] = ['success' => $report->isSuccess(), 'expired' => $report->isSubscriptionExpired(), 'reason' => $report->getReason()];
            }
        }

        return $results;
    }
}
