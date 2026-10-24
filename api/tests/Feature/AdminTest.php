<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BrokerageRule;
use App\Models\Locality;
use App\Models\Property;
use App\Models\User;
use Tests\TestCase;

class AdminTest extends TestCase
{
    public function test_admin_manages_staff_roles_and_permissions_with_audit(): void
    {
        $admin = $this->admin();
        $res = $this->as($admin)->postJson('/api/v1/admin/users', [
            'name' => 'New Agent', 'email' => 'agent@example.com', 'role' => 'team_member', 'permissions' => ['leads.assign', 'bogus'],
            'password' => 'longpass123',
        ])->assertStatus(422);

        $id = $this->as($admin)->postJson('/api/v1/admin/users', [
            'name' => 'New Agent', 'email' => 'agent@example.com', 'role' => 'team_member', 'permissions' => ['leads.assign'],
            'password' => 'longpass123',
        ])->assertCreated()->json('data.id');

        $this->as($admin)->putJson("/api/v1/admin/users/{$id}", ['permissions' => ['finance.manage'], 'reason' => 'Promoted'])->assertOk()
            ->assertJsonPath('data.permissions', ['finance.manage']);
        $this->as($admin)->putJson("/api/v1/admin/users/{$id}", ['is_active' => false])->assertOk();
        $this->assertFalse(User::find($id)->is_active);
        $this->assertSame(2, AuditLog::where('action', 'user.updated')->count());

        $this->as($admin)->putJson("/api/v1/admin/users/{$admin->id}", ['role' => 'team_member'])->assertStatus(422);
        $this->as($this->teamMember(['leads.assign', 'finance.manage', 'leads.view_all', 'properties.moderate']))
            ->putJson("/api/v1/admin/users/{$id}", ['role' => 'admin'])->assertForbidden();
    }

    public function test_brokerage_rule_validation_and_audited_changes(): void
    {
        $admin = $this->admin();
        $base = ['name' => 'Rent rule', 'transaction_type' => 'rent', 'method' => 'percentage', 'payer' => 'tenant', 'effective_from' => today()->toDateString()];

        $this->as($admin)->postJson('/api/v1/admin/brokerage-rules', $base)->assertStatus(422)->assertJsonValidationErrors(['percentage', 'percentage_basis']);
        $this->as($admin)->postJson('/api/v1/admin/brokerage-rules', $base + ['percentage' => 100, 'percentage_basis' => 'final_sale_price'])->assertStatus(422);
        $this->as($admin)->postJson('/api/v1/admin/brokerage-rules', ['payer' => 'buyer'] + $base + ['percentage' => 100, 'percentage_basis' => 'monthly_rent'])->assertStatus(422);
        $this->as($admin)->postJson('/api/v1/admin/brokerage-rules', ['payer' => 'split', 'split_shares' => ['owner' => 50, 'tenant' => 40]] + $base + ['percentage' => 100, 'percentage_basis' => 'monthly_rent'])
            ->assertStatus(422)->assertJsonValidationErrors(['split_shares']);

        $id = $this->as($admin)->postJson('/api/v1/admin/brokerage-rules', $base + ['percentage' => 100, 'percentage_basis' => 'monthly_rent'])->assertCreated()->json('data.id');
        $this->as($admin)->putJson("/api/v1/admin/brokerage-rules/{$id}", $base + ['method' => 'fixed', 'fixed_amount' => 8000])->assertStatus(422)->assertJsonValidationErrors(['change_reason']);
        $this->as($admin)->putJson("/api/v1/admin/brokerage-rules/{$id}", ['method' => 'fixed', 'fixed_amount' => 8000, 'change_reason' => 'New policy'] + $base)->assertOk();

        $rule = BrokerageRule::find($id);
        $this->assertNull($rule->percentage);
        $this->assertSame('8000.00', $rule->fixed_amount);
        $this->assertTrue(AuditLog::where('action', 'brokerage_rule.updated')->where('reason', 'New policy')->exists());

        $this->as($admin)->postJson('/api/v1/admin/brokerage-rules/preview', ['transaction_type' => 'rent', 'asking_price' => 15000])->assertOk()
            ->assertJsonPath('data.total', '8000.00');
        $this->as($this->teamMember(['finance.manage']))->postJson('/api/v1/admin/brokerage-rules', $base)->assertForbidden();
    }

    public function test_localities_amenities_and_settings(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/admin/localities', ['name' => 'Iscon', 'is_active' => true])->assertCreated()->assertJsonPath('data.slug', 'iscon')->json('data.id');
        Property::factory()->create(['locality_id' => $id]);
        $this->as($admin)->deleteJson("/api/v1/admin/localities/{$id}")->assertStatus(409);
        $this->as($admin)->putJson("/api/v1/admin/localities/{$id}", ['name' => 'Iscon', 'is_active' => false])->assertOk();
        $this->assertNull(collect($this->getJson('/api/v1/localities')->json('data'))->firstWhere('slug', 'iscon'));

        $this->as($admin)->postJson('/api/v1/admin/amenities', ['name' => 'Jogging Track'])->assertCreated();

        $this->getJson('/api/v1/settings/public')->assertOk()->assertExactJson(['data' => []]);
        $this->as($admin)->putJson('/api/v1/admin/settings', ['settings' => ['business_whatsapp' => '+91 98']])->assertStatus(422);
        $this->as($admin)->putJson('/api/v1/admin/settings', ['settings' => ['business_phone' => '+91 79 0000 0000', 'lead_notification_email' => 'ops@example.com']])->assertOk();
        $public = $this->getJson('/api/v1/settings/public')->json('data');
        $this->assertSame('+91 79 0000 0000', $public['business_phone']);
        $this->assertArrayNotHasKey('lead_notification_email', $public);

        $logs = $this->as($admin)->getJson('/api/v1/admin/audit-logs?action=settings')->assertOk()->json('data');
        $this->assertCount(1, $logs);
    }

    public function test_dashboards_respond_for_each_role(): void
    {
        $this->as($this->admin())->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonStructure(['data' => ['properties', 'leads', 'deals', 'brokerage']]);
        $this->as($this->teamMember())->getJson('/api/v1/team/dashboard?from=2026-01-01&to=2026-12-31')->assertOk()
            ->assertJsonStructure(['data' => ['leads' => ['unassigned', 'assigned_to_me'], 'follow_ups', 'site_visits', 'deals', 'brokerage']])
            ->assertJsonPath('data.brokerage.scope', 'own_deals');
        $this->as($this->teamMember())->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }
}
