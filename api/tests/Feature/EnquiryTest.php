<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\Property;
use App\Models\SiteVisit;
use App\Notifications\NewLeadNotification;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EnquiryTest extends TestCase
{
    public function test_property_enquiry_creates_a_central_lead_and_notifies_staff_not_owner(): void
    {
        Notification::fake();
        $staff = $this->teamMember();
        $property = $this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000]);

        $this->postJson('/api/v1/enquiries', [
            'name' => '<b>Meera</b>', 'phone' => '+91 98250 00001', 'email' => 'meera@example.com', 'interest' => 'general',
            'property_id' => $property->id, 'message' => 'Is it available?', 'consent_contact' => true, 'source_page' => '/property/x',
            'status' => 'won', 'assigned_to' => $staff->id,
        ])->assertCreated()->assertJsonPath('data.duplicate', false);

        $lead = Lead::firstOrFail();
        $this->assertSame('Meera', $lead->name);
        $this->assertSame('rent', $lead->interest); // derived from the listing, not trusted from input
        $this->assertSame('new', $lead->status);    // mass-assignment of status ignored
        $this->assertNull($lead->assigned_to);
        $this->assertSame('9825000001', $lead->phone_normalized);
        $this->assertSame('created', $lead->activities()->first()->type);
        Notification::assertSentTo($staff, NewLeadNotification::class);
        Notification::assertNotSentTo($property->owner, NewLeadNotification::class);
    }

    public function test_validation_consent_honeypot_and_unavailable_property(): void
    {
        $this->postJson('/api/v1/enquiries', ['name' => 'X', 'phone' => '123', 'interest' => 'buy'])
            ->assertStatus(422)->assertJsonValidationErrors(['name', 'phone', 'consent_contact']);

        $this->postJson('/api/v1/enquiries', ['name' => 'Bot', 'phone' => '9876543210', 'interest' => 'buy', 'consent_contact' => true, 'website' => 'http://spam'])
            ->assertStatus(422)->assertJsonValidationErrors(['website']);

        $draft = Property::factory()->create();
        $this->postJson('/api/v1/enquiries', ['name' => 'Real', 'phone' => '9876543210', 'interest' => 'buy', 'consent_contact' => true, 'property_id' => $draft->id])
            ->assertStatus(422)->assertJsonValidationErrors(['property_id']);

        $this->assertSame(0, Lead::count());
    }

    public function test_repeat_enquiries_are_merged_instead_of_duplicated(): void
    {
        $property = $this->publishedProperty();
        $payload = ['name' => 'Kiran', 'phone' => '9876543210', 'interest' => 'buy', 'property_id' => $property->id, 'consent_contact' => true];

        $this->postJson('/api/v1/enquiries', $payload)->assertCreated();
        $this->postJson('/api/v1/enquiries', ['phone' => '+91 98765-43210', 'message' => 'Second message'] + $payload)
            ->assertOk()->assertJsonPath('data.duplicate', true);

        $this->assertSame(1, Lead::count());
        $this->assertTrue(Lead::first()->activities()->where('body', 'like', '%Second message%')->exists());

        // A different property is a separate lead.
        $other = $this->publishedProperty();
        $this->postJson('/api/v1/enquiries', ['property_id' => $other->id] + $payload)->assertCreated();
        $this->assertSame(2, Lead::count());
    }

    public function test_site_visit_request_creates_lead_and_requested_visit(): void
    {
        $property = $this->publishedProperty();
        $this->postJson('/api/v1/site-visit-requests', [
            'name' => 'Nisha', 'phone' => '9811111111', 'property_id' => $property->id, 'consent_contact' => true,
            'preferred_date' => now()->addDays(2)->toDateString(), 'preferred_slot' => 'morning',
        ])->assertCreated();

        $visit = SiteVisit::firstOrFail();
        $this->assertSame('requested', $visit->status);
        $this->assertSame($property->id, $visit->property_id);
        $this->assertSame('morning', Lead::first()->preferred_visit_slot);

        $this->postJson('/api/v1/site-visit-requests', [
            'name' => 'Nisha', 'phone' => '9811111111', 'property_id' => $property->id, 'consent_contact' => true,
            'preferred_date' => now()->subDay()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors(['preferred_date']);
    }

    public function test_enquiries_are_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/enquiries', ['name' => 'Spam', 'phone' => '98000000'.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'interest' => 'general', 'consent_contact' => true])
                ->assertSuccessful();
        }
        $this->postJson('/api/v1/enquiries', ['name' => 'Spam', 'phone' => '9800000099', 'interest' => 'general', 'consent_contact' => true])
            ->assertStatus(429);
    }
}
