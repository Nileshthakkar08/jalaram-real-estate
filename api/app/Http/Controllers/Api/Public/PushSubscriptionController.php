<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Visitors opt in to "new property" browser notifications. */
class PushSubscriptionController extends Controller
{
    public function publicKey(): JsonResponse
    {
        $key = config('services.webpush.public_key');

        return response()->json(['data' => ['enabled' => filled($key) && filled(config('services.webpush.private_key')), 'public_key' => $key]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'url', 'max:2048'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'contentEncoding' => ['nullable', Rule::in(['aesgcm', 'aes128gcm'])],
        ]);

        if (! PushSubscription::isAllowedEndpoint($data['endpoint'])) {
            return response()->json(['message' => 'Unsupported push service.', 'errors' => ['endpoint' => ['Unsupported push service.']]], 422);
        }

        $subscription = PushSubscription::updateOrCreate(
            ['endpoint_hash' => PushSubscription::hashEndpoint($data['endpoint'])],
            [
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['contentEncoding'] ?? 'aes128gcm',
                'user_agent' => substr((string) $request->userAgent(), 0, 255) ?: null,
            ],
        );

        return response()->json(['data' => ['subscribed' => true]], $subscription->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:2048']]);
        PushSubscription::where('endpoint_hash', PushSubscription::hashEndpoint($data['endpoint']))->delete();

        return response()->json(['data' => ['subscribed' => false]]);
    }
}
