<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\PushSubscription;
use App\Services\WebPushSender;
use Illuminate\Support\Collection;
use Tests\TestCase;

class FakeWebPushSender extends WebPushSender
{
    public array $calls = [];

    public array $expireIds = [];

    public function isConfigured(): bool
    {
        return true;
    }

    public function send(Collection $subscriptions, string $payload): array
    {
        $this->calls[] = ['ids' => $subscriptions->pluck('id')->all(), 'payload' => json_decode($payload, true)];

        return $subscriptions->mapWithKeys(fn ($s) => [$s->id => [
            'success' => ! in_array($s->id, $this->expireIds, true),
            'expired' => in_array($s->id, $this->expireIds, true),
            'reason' => '',
        ]])->all();
    }
}

class PushNotificationTest extends TestCase
{
    private function subscribe(string $endpoint = 'https://fcm.googleapis.com/fcm/send/abc123')
    {
        return $this->postJson('/api/v1/push/subscriptions', [
            'endpoint' => $endpoint,
            'keys' => ['p256dh' => 'BPublicKeyValue', 'auth' => 'AuthSecret'],
            'contentEncoding' => 'aes128gcm',
        ]);
    }

    public function test_public_key_reports_whether_push_is_configured(): void
    {
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        $this->getJson('/api/v1/push/public-key')->assertOk()->assertJsonPath('data.enabled', false);

        config(['services.webpush.public_key' => 'pub', 'services.webpush.private_key' => 'priv']);
        $this->getJson('/api/v1/push/public-key')->assertOk()->assertJsonPath('data.enabled', true)->assertJsonPath('data.public_key', 'pub');
    }

    public function test_subscribe_is_idempotent_and_unsubscribe_removes_it(): void
    {
        $this->subscribe()->assertCreated();
        $this->subscribe()->assertOk();
        $this->assertSame(1, PushSubscription::count());

        $this->deleteJson('/api/v1/push/subscriptions', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123'])->assertOk();
        $this->assertSame(0, PushSubscription::count());
    }

    public function test_only_real_push_services_are_accepted(): void
    {
        foreach ([
            'http://fcm.googleapis.com/fcm/send/x',          // not https
            'https://169.254.169.254/latest/meta-data',       // internal address (SSRF)
            'https://evil.example/fcm.googleapis.com',        // allowlisted name only in the path
            'https://fcm.googleapis.com.evil.example/send/x', // lookalike host
        ] as $endpoint) {
            $this->subscribe($endpoint)->assertStatus(422);
        }
        foreach ([
            'https://updates.push.services.mozilla.com/wpush/v2/x',
            'https://web.push.apple.com/QAbc',
            'https://wns2-par02p.notify.windows.com/w/?token=x',
        ] as $endpoint) {
            $this->subscribe($endpoint)->assertCreated();
        }
        $this->postJson('/api/v1/push/subscriptions', ['endpoint' => 'https://fcm.googleapis.com/x'])->assertStatus(422);
    }

    public function test_first_publication_notifies_subscribers_once_with_public_data_only(): void
    {
        $fake = new FakeWebPushSender;
        $this->app->instance(WebPushSender::class, $fake);
        $this->subscribe('https://fcm.googleapis.com/fcm/send/one')->assertCreated();
        $this->subscribe('https://fcm.googleapis.com/fcm/send/two')->assertCreated();
        $expiring = PushSubscription::latest('id')->first();
        $fake->expireIds = [$expiring->id];

        $property = Property::factory()->create([
            'status' => 'pending', 'listing_purpose' => 'rent', 'price' => 28000,
            'title' => '3 BHK Flat for Rent near DPS School', 'private_address' => 'D-202 Secret Heights',
            'owner_contact_phone' => '9999999999',
        ]);
        $admin = $this->admin();
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertOk();

        $this->assertCount(1, $fake->calls);
        $payload = $fake->calls[0]['payload'];
        $this->assertStringContainsString('New rental in', $payload['title']);
        $this->assertStringContainsString('₹28,000/mo', $payload['body']);
        $this->assertSame('/property/'.$property->fresh()->slug, $payload['url']);
        $this->assertStringNotContainsString('Secret Heights', json_encode($payload));
        $this->assertStringNotContainsString('9999999999', json_encode($payload));

        // Expired subscription removed; the other marked as notified.
        $this->assertNull(PushSubscription::find($expiring->id));
        $this->assertNotNull(PushSubscription::first()->last_notified_at);

        // Suspend and re-publish: not a new listing, so no second notification.
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/status", ['status' => 'suspended', 'reason' => 'Check'])->assertOk();
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/status", ['status' => 'published'])->assertOk();
        $this->assertCount(1, $fake->calls);
    }

    public function test_nothing_is_sent_when_push_is_not_configured(): void
    {
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        $this->subscribe()->assertCreated();
        $property = Property::factory()->create(['status' => 'pending']);

        // Real sender, no keys: approving must still succeed and must not throw.
        $this->as($this->admin())->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertOk();
        $this->assertNull(PushSubscription::first()->last_notified_at);
    }
}
