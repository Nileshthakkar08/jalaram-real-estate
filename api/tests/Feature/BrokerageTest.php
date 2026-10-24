<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BrokerageAgreement;
use App\Models\BrokerageRule;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Locality;
use App\Models\Property;
use App\Models\User;
use Tests\TestCase;

class BrokerageTest extends TestCase
{
    private User $finance;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();
        $this->finance = $this->teamMember(['finance.manage', 'leads.view_all', 'leads.assign']);
        $this->agent = $this->teamMember();
    }

    private function openDeal(Property $property, array $data = []): Deal
    {
        $lead = Lead::factory()->create(['assigned_to' => $this->agent->id, 'status' => 'contacted', 'property_id' => $property->id]);
        $id = $this->as($this->agent)->postJson('/api/v1/team/deals', ['lead_id' => $lead->id, 'property_id' => $property->id] + $data)
            ->assertCreated()->json('data.id');

        return Deal::findOrFail($id);
    }

    public function test_rental_fixed_brokerage_is_separate_from_monthly_rent(): void
    {
        $this->rentRuleFixed('10000', 'tenant');
        $property = $this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000, 'security_deposit' => 36000]);
        $deal = $this->openDeal($property, ['final_price' => 12000]);

        $this->assertSame('10000.00', $deal->estimated_brokerage);
        $this->assertSame('36000.00', $deal->security_deposit);
        $agreement = $deal->agreements()->sole();
        $this->assertSame('tenant', $agreement->party);
        $this->assertSame('estimated', $agreement->status);
        $this->assertNull($agreement->agreed_amount);

        // Nothing is agreed, invoiced or collected merely because a deal exists.
        $report = $this->as($this->finance)->getJson('/api/v1/admin/reports/finance')->assertForbidden();
        $totals = $this->as($this->finance)->getJson('/api/v1/team/brokerage/summary')->assertOk()->json('data.totals');
        $this->assertSame('10000.00', $totals['potential']);
        $this->assertSame('0.00', $totals['agreed']);
        $this->assertSame('0.00', $totals['collected']);
        $this->assertSame('0.00', $totals['outstanding']);
    }

    public function test_sale_percentage_rule_recalculates_estimates_but_never_agreed_amounts(): void
    {
        $this->saleRulePercent('1', 'buyer');
        $property = $this->publishedProperty(['price' => 5000000]);
        $deal = $this->openDeal($property);

        $this->assertSame('50000.00', $deal->estimated_brokerage); // 1% of asking (final not yet known)
        $this->assertStringContainsString('asking price is used', $deal->brokerage_basis['explanation']);

        $this->as($this->agent)->putJson("/api/v1/team/deals/{$deal->id}", ['final_price' => 4800000])->assertOk()
            ->assertJsonPath('data.estimated_brokerage', '48000.00');
        $agreement = $deal->agreements()->sole();
        $this->assertSame('48000.00', $agreement->estimated_amount);

        // Agree at a negotiated amount: override needs a reason.
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 40000])
            ->assertStatus(422)->assertJsonValidationErrors(['override_reason']);
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 40000, 'override_reason' => 'Repeat client discount'])
            ->assertOk()->assertJsonPath('data.is_override', true)->assertJsonPath('data.status', 'agreed');

        // Price changes again: estimate moves, agreed stays.
        $this->as($this->agent)->putJson("/api/v1/team/deals/{$deal->id}", ['final_price' => 5000000])->assertOk();
        $agreement->refresh();
        $this->assertSame('50000.00', $agreement->estimated_amount);
        $this->assertSame('40000.00', $agreement->agreed_amount);

        // Changing an agreed amount later needs finance permission and a reason.
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 45000, 'reason' => 'x'])->assertForbidden();
        $this->as($this->finance)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 45000])->assertStatus(422);
        $this->as($this->finance)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 45000, 'reason' => 'Buyer agreed to revised fee'])->assertOk();
        $this->assertTrue(AuditLog::where('action', 'brokerage.agreement_updated')->where('reason', 'Buyer agreed to revised fee')->exists());
    }

    public function test_split_rule_creates_one_agreement_per_party(): void
    {
        BrokerageRule::create([
            'name' => 'Rent split', 'transaction_type' => 'rent', 'method' => 'percentage', 'percentage' => 100,
            'percentage_basis' => 'monthly_rent', 'payer' => 'split', 'split_shares' => ['owner' => 50, 'tenant' => 50],
            'effective_from' => now()->subMonth(),
        ]);
        $deal = $this->openDeal($this->publishedProperty(['listing_purpose' => 'rent', 'price' => 20001]), ['final_price' => 20001]);

        $amounts = $deal->agreements()->pluck('estimated_amount', 'party')->all();
        $this->assertEqualsCanonicalizing(['owner', 'tenant'], array_keys($amounts));
        $this->assertSame(2000100, array_sum(array_map(fn ($a) => (int) round($a * 100), $amounts)));
    }

    public function test_most_specific_active_rule_wins(): void
    {
        $loc = Locality::factory()->create();
        $this->saleRulePercent('1');
        BrokerageRule::factory()->create(['percentage' => '2', 'locality_id' => $loc->id, 'name' => 'Locality rule']);
        BrokerageRule::factory()->create(['percentage' => '5', 'locality_id' => $loc->id, 'is_active' => false]);
        BrokerageRule::factory()->create(['percentage' => '7', 'effective_from' => now()->addMonth()]);

        $deal = $this->openDeal($this->publishedProperty(['price' => 1000000, 'locality_id' => $loc->id]));
        $this->assertSame('20000.00', $deal->estimated_brokerage);
    }

    public function test_closing_requires_final_price_and_agreed_brokerage_and_never_marks_paid(): void
    {
        $this->rentRuleFixed('10000');
        $property = $this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000]);
        $deal = $this->openDeal($property);
        $url = "/api/v1/team/deals/{$deal->id}/status";

        $this->as($this->agent)->postJson($url, ['status' => 'closed_won'])->assertStatus(409); // must pass agreement_pending
        $this->as($this->agent)->postJson($url, ['status' => 'agreement_pending'])->assertOk();
        $this->as($this->agent)->postJson($url, ['status' => 'closed_won'])->assertStatus(422)->assertJsonValidationErrors(['final_price', 'agreements']);

        $this->as($this->agent)->putJson("/api/v1/team/deals/{$deal->id}", ['final_price' => 12000])->assertOk();
        $agreement = $deal->agreements()->sole();
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 10000])->assertOk();
        $this->as($this->agent)->postJson($url, ['status' => 'closed_won'])->assertOk();

        $this->assertSame('closed', $property->fresh()->status);
        $this->assertSame('won', $deal->lead->fresh()->status);
        $agreement->refresh();
        $this->assertSame('agreed', $agreement->status);
        $this->assertSame('10000.00', $agreement->outstanding_amount);
        $this->assertSame('0.00', $agreement->amount_received);
    }

    public function test_partial_payments_refunds_waivers_and_voids_keep_balances_correct(): void
    {
        $this->rentRuleFixed('10000');
        $deal = $this->openDeal($this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000]), ['final_price' => 12000]);
        $agreement = $deal->agreements()->sole();
        $pay = fn (array $d) => $this->as($this->finance)->postJson("/api/v1/team/agreements/{$agreement->id}/payments", $d + ['payment_date' => today()->toDateString()]);

        $pay(['type' => 'payment', 'amount' => 1000, 'method' => 'cash'])->assertStatus(409); // not agreed yet
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 10000])->assertOk();

        // Agents cannot record money.
        $this->as($this->agent)->postJson("/api/v1/team/agreements/{$agreement->id}/payments", ['type' => 'payment', 'amount' => 100, 'method' => 'cash', 'payment_date' => today()->toDateString()])->assertForbidden();

        $first = $pay(['type' => 'payment', 'amount' => '4000.50', 'method' => 'upi', 'reference_number' => 'UPI1'])->assertCreated();
        $this->assertSame(['partially_paid', '5999.50'], [$agreement->fresh()->status, $agreement->fresh()->outstanding_amount]);

        $pay(['type' => 'payment', 'amount' => 7000, 'method' => 'cash'])->assertStatus(422); // exceeds outstanding
        $pay(['type' => 'payment', 'amount' => 100, 'method' => 'cash', 'payment_date' => today()->addDay()->toDateString()])->assertStatus(422);
        $pay(['type' => 'waiver', 'amount' => 999.50])->assertStatus(422)->assertJsonValidationErrors(['notes']);
        $pay(['type' => 'waiver', 'amount' => '999.50', 'notes' => 'Goodwill rounding'])->assertCreated();
        $pay(['type' => 'payment', 'amount' => 5000, 'method' => 'bank_transfer'])->assertCreated();

        $agreement->refresh();
        $this->assertSame('paid', $agreement->status);
        $this->assertSame('0.00', $agreement->outstanding_amount);
        $this->assertSame('9000.50', $agreement->amount_received);
        $this->assertSame('999.50', $agreement->amount_waived);

        $pay(['type' => 'refund', 'amount' => 10000, 'method' => 'cash', 'notes' => 'too much'])->assertStatus(422);
        $pay(['type' => 'refund', 'amount' => 500, 'method' => 'cash', 'notes' => 'Partial refund agreed'])->assertCreated();
        $this->assertSame(['partially_paid', '500.00'], [$agreement->fresh()->status, $agreement->fresh()->outstanding_amount]);

        // Void the first payment (entered in error): balance goes back up; entry stays in the ledger.
        $this->as($this->finance)->postJson("/api/v1/team/payments/{$first->json('data.id')}/void", [])->assertStatus(422);
        $this->as($this->finance)->postJson("/api/v1/team/payments/{$first->json('data.id')}/void", ['reason' => 'Duplicate entry'])->assertOk();
        $agreement->refresh();
        $this->assertSame('4500.50', $agreement->outstanding_amount);
        $this->assertSame(4, $agreement->payments()->count());

        $totals = $this->as($this->finance)->getJson('/api/v1/team/brokerage/summary')->json('data.totals');
        $this->assertSame('5000.00', $totals['received']);
        $this->assertSame('500.00', $totals['refunded']);
        $this->assertSame('4500.00', $totals['collected']);
        $this->assertSame('999.50', $totals['waived']);
        $this->assertSame('10000.00', $totals['agreed']);
        $this->assertSame(4, AuditLog::where('action', 'like', 'brokerage.%_recorded')->count());
    }

    public function test_fully_refunded_and_lost_deal_handling(): void
    {
        $this->rentRuleFixed('10000');
        $deal = $this->openDeal($this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000]), ['final_price' => 12000]);
        $agreement = $deal->agreements()->sole();
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 10000])->assertOk();
        $this->as($this->finance)->postJson("/api/v1/team/agreements/{$agreement->id}/payments", ['type' => 'payment', 'amount' => 2000, 'method' => 'cash', 'payment_date' => today()->toDateString()])->assertCreated();

        $this->as($this->agent)->postJson("/api/v1/team/deals/{$deal->id}/status", ['status' => 'closed_lost'])->assertStatus(422);
        $this->as($this->agent)->postJson("/api/v1/team/deals/{$deal->id}/status", ['status' => 'closed_lost', 'reason' => 'Tenant backed out'])->assertOk();
        $this->assertNotSame('cancelled', $agreement->fresh()->status); // token received stays visible for refund

        $this->as($this->finance)->postJson("/api/v1/team/agreements/{$agreement->id}/payments", ['type' => 'refund', 'amount' => 2000, 'method' => 'cash', 'notes' => 'Token returned', 'payment_date' => today()->toDateString()])->assertCreated();
        $this->assertSame('refunded', $agreement->fresh()->status);

        $totals = $this->as($this->finance)->getJson('/api/v1/team/brokerage/summary')->json('data.totals');
        $this->assertSame('0.00', $totals['collected']);
        $this->assertSame('0.00', $totals['agreed']); // lost deals are excluded from agreed brokerage
    }

    public function test_deal_visibility_is_scoped_to_assignee_unless_finance(): void
    {
        $this->rentRuleFixed();
        $deal = $this->openDeal($this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000]));
        $stranger = $this->teamMember(['leads.view_all']);

        $this->as($stranger)->getJson("/api/v1/team/deals/{$deal->id}")->assertForbidden();
        $this->assertSame([], $this->as($stranger)->getJson('/api/v1/team/deals')->json('data'));
        $this->as($this->finance)->getJson("/api/v1/team/deals/{$deal->id}")->assertOk()->assertJsonPath('can.manage_finance', true);
        $this->as($this->agent)->getJson("/api/v1/team/deals/{$deal->id}")->assertOk()->assertJsonPath('can.manage_finance', false);
    }

    public function test_reports_group_by_team_member_locality_and_type(): void
    {
        $this->rentRuleFixed('10000');
        $deal = $this->openDeal($this->publishedProperty(['listing_purpose' => 'rent', 'price' => 12000]), ['final_price' => 12000]);
        $agreement = $deal->agreements()->sole();
        $this->as($this->agent)->patchJson("/api/v1/team/agreements/{$agreement->id}", ['agreed_amount' => 10000])->assertOk();
        $this->as($this->finance)->postJson("/api/v1/team/agreements/{$agreement->id}/payments", ['type' => 'payment', 'amount' => 6000, 'method' => 'upi', 'payment_date' => today()->toDateString()])->assertCreated();
        $this->as($this->agent)->postJson("/api/v1/team/deals/{$deal->id}/status", ['status' => 'agreement_pending']);
        $this->as($this->agent)->postJson("/api/v1/team/deals/{$deal->id}/status", ['status' => 'closed_won'])->assertOk();

        $report = $this->as($this->admin())->getJson('/api/v1/admin/reports/finance')->assertOk()->json('data');
        $this->assertSame('4000.00', $report['totals']['outstanding']);
        $this->assertSame('rent', $report['by_transaction_type'][0]['key']);
        $this->assertSame('6000.00', $report['by_transaction_type'][0]['collected']);
        $this->assertSame($this->agent->name, $report['by_team_member'][0]['label']);
        $this->assertSame('6000.00', collect($report['by_month'])->firstWhere('month', now()->format('Y-m'))['collected']);
    }
}
