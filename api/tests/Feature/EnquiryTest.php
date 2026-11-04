<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\Locality;
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

    public function test_requirement_form_stores_budget_bhk_and_area(): void
    {
        $locality = Locality::factory()->create();
        $base = ['interest' => 'buy', 'consent_contact' => true, 'source_page' => '/requirement', 'utm_source' => 'instagram'];

        // Open-ended bands: "Under ₹25 L" has no minimum, "Above ₹2 Cr" has no maximum.
        $this->postJson('/api/v1/enquiries', $base + [
            'name' => 'Asha', 'phone' => '9876500001', 'preferred_bhk' => 2, 'preferred_locality_id' => $locality->id,
            'budget_min' => null, 'budget_max' => 2500000, 'message' => 'Requirement: 2 BHK to buy.',
        ])->assertCreated();
        $this->postJson('/api/v1/enquiries', $base + [
            'name' => 'Ravi', 'phone' => '9876500002', 'budget_min' => 20000000, 'budget_max' => null,
        ])->assertCreated();

        $lead = Lead::where('phone_normalized', '9876500001')->firstOrFail();
        $this->assertSame(2, $lead->preferred_bhk);
        $this->assertSame($locality->id, $lead->preferred_locality_id);
        $this->assertNull($lead->budget_min);
        $this->assertEquals(2500000, $lead->budget_max);
        $this->assertSame('/requirement', $lead->source_page);
        $this->assertSame('instagram', $lead->utm_source);
        $this->assertEquals(20000000, Lead::where('phone_normalized', '9876500002')->value('budget_min'));
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
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/enquiries', ['name' => 'Spam', 'phone' => '98000000'.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'interest' => 'general', 'consent_contact' => true])
                ->assertSuccessful();
        }
        $this->postJson('/api/v1/enquiries', ['name' => 'Spam', 'phone' => '9800000099', 'interest' => 'general', 'consent_contact' => true])
            ->assertStatus(429);
    }

    public function test_one_phone_number_is_limited_even_from_different_addresses(): void
    {
        $send = fn (string $ip) => $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/enquiries', ['name' => 'Asha', 'phone' => '+91 98250 12345', 'interest' => 'general', 'consent_contact' => true]);

        for ($i = 1; $i <= 5; $i++) {
            $send("10.0.0.{$i}")->assertSuccessful();
        }
        $send('10.0.0.99')->assertStatus(429);
        // Other people on the same (shared mobile) address are unaffected.
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
            ->postJson('/api/v1/enquiries', ['name' => 'Ravi', 'phone' => '9909912345', 'interest' => 'general', 'consent_contact' => true])
            ->assertSuccessful();
    }
}
