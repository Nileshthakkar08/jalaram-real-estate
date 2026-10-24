<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\Locality;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** The acceptance workflow from the project brief, driven entirely through the HTTP API. */
class EndToEndWorkflowTest extends TestCase
{
    public function test_complete_brokerage_workflow(): void
    {
        Notification::fake();
        Storage::fake('public');
        $spa = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/'];

        $locality = Locality::factory()->create(['name' => 'Prahlad Nagar', 'slug' => 'prahlad-nagar']);
        $admin = $this->admin();
        $agent = $this->teamMember();
        $finance = $this->teamMember(['finance.manage', 'leads.view_all', 'leads.assign']);
        $this->as($admin)->postJson('/api/v1/admin/brokerage-rules', [
            'name' => 'Rent — fixed one-time', 'transaction_type' => 'rent', 'method' => 'fixed', 'fixed_amount' => 10000,
            'payer' => 'split', 'split_shares' => ['owner' => 50, 'tenant' => 50], 'effective_from' => today()->subDay()->toDateString(),
        ])->assertCreated();
        $this->app['auth']->forgetGuards();
        auth()->guard('web')->logout();

        // 1. Owner registers and submits a property.
        $this->withHeaders($spa)->postJson('/api/v1/auth/register', [
            'name' => 'Hetal Owner', 'email' => 'hetal@example.com', 'phone' => '9825011111',
            'password' => 'ownerpass1', 'password_confirmation' => 'ownerpass1',
        ])->assertCreated();
        $owner = User::where('email', 'hetal@example.com')->firstOrFail();
        $this->flushHeaders();
        $this->flushSession();

        $propertyId = $this->as($owner)->postJson('/api/v1/owner/properties', [
            'title' => '2 BHK furnished flat in Prahlad Nagar', 'listing_purpose' => 'rent', 'property_type' => 'apartment',
            'description' => 'Fully furnished two bedroom flat with covered parking, close to the garden.',
            'locality_id' => $locality->id, 'public_address' => 'Near Prahlad Nagar Garden', 'private_address' => 'C-701 Private Heights',
            'price' => 12000, 'security_deposit' => 36000, 'area_sqft' => 1100, 'bedrooms' => 2, 'bathrooms' => 2,
        ])->assertCreated()->json('data.id');
        $this->as($owner)->postJson("/api/v1/owner/properties/{$propertyId}/images", ['images' => [UploadedFile::fake()->image('a.jpg', 1200, 800)]])->assertCreated();
        $this->as($owner)->postJson("/api/v1/owner/properties/{$propertyId}/submit")->assertOk()->assertJsonPath('data.status', 'pending');
        $this->getJson('/api/v1/properties?purpose=rent')->assertJsonCount(0, 'data');

        // 2. Admin approves.
        $this->as($admin)->postJson("/api/v1/admin/properties/{$propertyId}/approve")->assertOk();

        // 3. Property appears in public search.
        $this->app['auth']->forgetGuards();
        auth()->guard('web')->logout();
        $listing = $this->getJson('/api/v1/properties?purpose=rent&locality=prahlad-nagar')->assertJsonCount(1, 'data')->json('data.0');

        // 4. Customer enquires and requests a visit.
        $this->postJson('/api/v1/site-visit-requests', [
            'name' => 'Customer Kavya', 'phone' => '9898989898', 'property_id' => $listing['id'], 'consent_contact' => true,
            'preferred_date' => today()->addDays(2)->toDateString(), 'preferred_slot' => 'evening', 'message' => 'Moving next month',
        ])->assertCreated();
        $lead = Lead::firstOrFail();

        // 5. Lead appears in the team inbox (unassigned).
        $this->as($agent)->getJson('/api/v1/team/leads?assigned=unassigned')->assertJsonPath('data.0.id', $lead->id);

        // 6. Team member is assigned and contacts the customer.
        $this->as($finance)->postJson("/api/v1/team/leads/{$lead->id}/assign", ['user_id' => $agent->id])->assertOk();
        $this->as($agent)->postJson("/api/v1/team/leads/{$lead->id}/activities", ['type' => 'call', 'outcome' => 'connected', 'body' => 'Confirmed requirement'])->assertCreated();

        // 7. Team coordinates with the owner (private contact visible to team only).
        $detail = $this->as($agent)->getJson("/api/v1/team/leads/{$lead->id}")->assertOk();
        $this->assertSame('9825011111', $detail->json('owner_contact.phone'));
        $this->as($agent)->postJson("/api/v1/team/properties/{$propertyId}/owner-notes", ['type' => 'viewing_availability', 'body' => 'Owner free Saturday 5pm', 'lead_id' => $lead->id])->assertCreated();

        // 8. Site visit scheduled and recorded.
        $visitId = $detail->json('site_visits.0.id');
        $this->as($agent)->patchJson("/api/v1/team/site-visits/{$visitId}", ['status' => 'scheduled', 'scheduled_at' => now()->addDays(2)->setTime(17, 0)->toDateTimeString(), 'owner_confirmed' => true])->assertOk();
        $this->as($agent)->patchJson("/api/v1/team/site-visits/{$visitId}", ['status' => 'completed', 'customer_feedback' => 'Liked the flat'])->assertOk();

        // 9. Negotiation recorded.
        $dealId = $this->as($agent)->postJson('/api/v1/team/deals', ['lead_id' => $lead->id, 'property_id' => $propertyId, 'negotiation_notes' => 'Customer offered 11,500'])
            ->assertCreated()->json('data.id');
        $this->assertSame('negotiation', $lead->fresh()->status);
        $this->as($agent)->putJson("/api/v1/team/deals/{$dealId}", ['final_price' => 12000, 'security_deposit' => 36000])->assertOk();

        // 11. Agreed brokerage recorded per responsible party.
        $deal = $this->as($agent)->getJson("/api/v1/team/deals/{$dealId}")->json('data');
        $this->assertSame('10000.00', $deal['estimated_brokerage']);
        foreach ($deal['agreements'] as $agreement) {
            $this->assertSame('5000.00', $agreement['estimated_amount']);
            $this->as($agent)->patchJson("/api/v1/team/agreements/{$agreement['id']}", ['agreed_amount' => 5000, 'due_date' => today()->addWeek()->toDateString()])->assertOk();
        }

        // 10. Deal closed.
        $this->as($agent)->postJson("/api/v1/team/deals/{$dealId}/status", ['status' => 'agreement_pending'])->assertOk();
        $this->as($agent)->postJson("/api/v1/team/deals/{$dealId}/status", ['status' => 'closed_won'])->assertOk();
        $this->assertSame('won', $lead->fresh()->status);

        // 12–13. Invoice references and partial + full payments.
        [$ownerAgreement, $tenantAgreement] = collect($deal['agreements'])->sortBy('party')->values()->all();
        $this->as($finance)->patchJson("/api/v1/team/agreements/{$tenantAgreement['id']}", ['invoice_number' => 'JRE/INV/001', 'invoice_date' => today()->toDateString(), 'invoiced_amount' => 5000])->assertOk();
        $this->as($finance)->postJson("/api/v1/team/agreements/{$tenantAgreement['id']}/payments", ['type' => 'payment', 'amount' => 2000, 'method' => 'upi', 'payment_date' => today()->toDateString()])->assertCreated()
            ->assertJsonPath('agreement.status', 'partially_paid')->assertJsonPath('agreement.outstanding_amount', '3000.00');
        $this->as($finance)->postJson("/api/v1/team/agreements/{$tenantAgreement['id']}/payments", ['type' => 'payment', 'amount' => 3000, 'method' => 'cash', 'payment_date' => today()->toDateString()])->assertCreated()
            ->assertJsonPath('agreement.status', 'paid')->assertJsonPath('agreement.outstanding_amount', '0.00');

        // 14. Finance shows collected separately from expected and outstanding.
        $totals = $this->as($admin)->getJson('/api/v1/admin/reports/finance')->assertOk()->json('data.totals');
        $this->assertSame('10000.00', $totals['agreed']);
        $this->assertSame('5000.00', $totals['invoiced']);
        $this->assertSame('5000.00', $totals['collected']);
        $this->assertSame('5000.00', $totals['outstanding']);
        $this->assertSame('0.00', $totals['potential']); // deal closed → no longer pipeline

        // 15. Public pages never expose owner, customer or financial data.
        $this->app['auth']->forgetGuards();
        auth()->guard('web')->logout();
        $this->getJson("/api/v1/properties/{$listing['slug']}")->assertNotFound(); // closed after the deal
        $publicPayloads = $this->getJson('/api/v1/properties')->getContent()
            .$this->getJson('/api/v1/localities')->getContent()
            .$this->getJson('/api/v1/settings/public')->getContent()
            .$this->getJson('/api/v1/sitemap')->getContent();
        foreach (['9825011111', 'Private Heights', '9898989898', 'Kavya', '5000.00', 'JRE/INV/001'] as $secret) {
            $this->assertStringNotContainsString($secret, $publicPayloads);
        }
        foreach (['/api/v1/team/leads', '/api/v1/team/deals', '/api/v1/admin/reports/finance', "/api/v1/team/deals/{$dealId}"] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->as($owner)->getJson("/api/v1/team/deals/{$dealId}")->assertForbidden();
    }
}
