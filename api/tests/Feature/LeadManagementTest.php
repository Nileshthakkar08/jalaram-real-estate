<?php

namespace Tests\Feature;

use App\Models\FollowUp;
use App\Models\Lead;
use App\Notifications\LeadAssignedNotification;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class LeadManagementTest extends TestCase
{
    public function test_team_member_sees_own_and_unassigned_leads_only(): void
    {
        $me = $this->teamMember();
        $other = $this->teamMember();
        $unassigned = Lead::factory()->create();
        $mine = Lead::factory()->create(['assigned_to' => $me->id, 'status' => 'assigned']);
        $theirs = Lead::factory()->create(['assigned_to' => $other->id, 'status' => 'assigned']);

        $ids = array_column($this->as($me)->getJson('/api/v1/team/leads')->assertOk()->json('data'), 'id');
        $this->assertEqualsCanonicalizing([$unassigned->id, $mine->id], $ids);
        $this->as($me)->getJson("/api/v1/team/leads/{$theirs->id}")->assertForbidden();
        $this->as($me)->postJson("/api/v1/team/leads/{$theirs->id}/activities", ['type' => 'note', 'body' => 'x'])->assertForbidden();

        $ids = array_column($this->as($this->teamMember(['leads.view_all']))->getJson('/api/v1/team/leads')->json('data'), 'id');
        $this->assertCount(3, $ids);
    }

    public function test_claiming_assigning_and_reassigning(): void
    {
        Notification::fake();
        $me = $this->teamMember();
        $colleague = $this->teamMember();
        $lead = $this->websiteLead();

        // Plain team member: may claim for self, not assign to others.
        $this->as($me)->postJson("/api/v1/team/leads/{$lead->id}/assign", ['user_id' => $colleague->id])->assertForbidden();
        $this->as($me)->postJson("/api/v1/team/leads/{$lead->id}/assign", ['user_id' => $me->id])->assertOk()->assertJsonPath('data.status', 'assigned');

        // Manager reassigns; pending follow-ups move with the lead; owner/customer cannot be assignee.
        $manager = $this->teamMember(['leads.assign', 'leads.view_all']);
        $this->as($me)->postJson("/api/v1/team/leads/{$lead->id}/follow-ups", ['due_at' => now()->addDay()->toDateTimeString()])->assertCreated();
        $this->as($manager)->postJson("/api/v1/team/leads/{$lead->id}/assign", ['user_id' => $this->owner()->id])->assertStatus(422);
        $this->as($manager)->postJson("/api/v1/team/leads/{$lead->id}/assign", ['user_id' => $colleague->id])->assertOk();

        $this->assertSame($colleague->id, $lead->fresh()->assigned_to);
        $this->assertSame($colleague->id, FollowUp::first()->assigned_to);
        Notification::assertSentTo($colleague, LeadAssignedNotification::class);
        $this->assertSame(2, $lead->activities()->where('type', 'assignment')->count());
    }

    public function test_call_logging_status_transitions_and_reasons(): void
    {
        $me = $this->teamMember();
        $lead = Lead::factory()->create(['assigned_to' => $me->id, 'status' => 'assigned']);
        $url = "/api/v1/team/leads/{$lead->id}";

        $this->as($me)->postJson("{$url}/activities", ['type' => 'call', 'outcome' => 'no_answer'])->assertCreated();
        $this->assertSame('assigned', $lead->fresh()->status);
        $this->assertSame(1, $lead->fresh()->contact_attempts);

        $this->as($me)->postJson("{$url}/activities", ['type' => 'call', 'outcome' => 'connected', 'body' => 'Wants 2 BHK'])->assertCreated();
        $lead->refresh();
        $this->assertSame('contacted', $lead->status);
        $this->assertSame(2, $lead->contact_attempts);
        $this->assertNotNull($lead->last_contacted_at);

        $this->as($me)->postJson("{$url}/activities", ['type' => 'requirement', 'body' => 'Budget 60L, east facing'])->assertCreated();
        $this->assertStringContainsString('east facing', $lead->fresh()->requirements);

        $this->as($me)->postJson("{$url}/status", ['status' => 'won'])->assertStatus(409);
        $this->as($me)->postJson("{$url}/status", ['status' => 'new'])->assertStatus(409);
        $this->as($me)->postJson("{$url}/status", ['status' => 'qualified'])->assertOk();
        $this->as($me)->postJson("{$url}/status", ['status' => 'lost'])->assertStatus(422);
        $this->as($me)->postJson("{$url}/status", ['status' => 'lost', 'reason' => 'Bought elsewhere'])->assertOk();
        $this->assertSame('Bought elsewhere', $lead->fresh()->closed_reason);
        $this->as($me)->postJson("{$url}/status", ['status' => 'contacted'])->assertOk(); // reopen
    }

    public function test_follow_ups_due_today_overdue_and_completion(): void
    {
        $me = $this->teamMember();
        $lead = Lead::factory()->create(['assigned_to' => $me->id, 'status' => 'contacted']);

        $this->as($me)->postJson("/api/v1/team/leads/{$lead->id}/follow-ups", ['due_at' => now()->subHour()->toDateTimeString()])->assertStatus(422);
        $res = $this->as($me)->postJson("/api/v1/team/leads/{$lead->id}/follow-ups", ['due_at' => now()->addHours(2)->toDateTimeString(), 'channel' => 'whatsapp'])->assertCreated();
        $this->assertNotNull($lead->fresh()->next_follow_up_at);

        $overdue = FollowUp::create(['lead_id' => $lead->id, 'assigned_to' => $me->id, 'due_at' => now()->subDays(2), 'status' => 'pending']);

        $this->assertSame([$overdue->id], array_column($this->as($me)->getJson('/api/v1/team/follow-ups?when=overdue')->json('data'), 'id'));
        $dash = $this->as($me)->getJson('/api/v1/team/dashboard')->assertOk();
        $this->assertSame(1, $dash->json('data.follow_ups.overdue'));

        $this->as($me)->patchJson("/api/v1/team/follow-ups/{$overdue->id}", ['action' => 'complete', 'outcome' => 'Spoke to customer'])->assertOk();
        $this->as($me)->patchJson("/api/v1/team/follow-ups/{$overdue->id}", ['action' => 'complete'])->assertStatus(409);
        $this->as($me)->patchJson("/api/v1/team/follow-ups/{$res->json('data.id')}", ['action' => 'reschedule', 'due_at' => now()->addDays(3)->toDateTimeString()])->assertOk();
        $this->assertTrue($lead->fresh()->next_follow_up_at->isAfter(now()->addDays(2)));
    }

    public function test_site_visit_scheduling_and_owner_coordination_notes(): void
    {
        $me = $this->teamMember();
        $property = $this->publishedProperty(['owner_contact_phone' => '9333333333']);
        $lead = Lead::factory()->create(['assigned_to' => $me->id, 'status' => 'contacted', 'property_id' => $property->id]);

        $show = $this->as($me)->getJson("/api/v1/team/leads/{$lead->id}")->assertOk();
        $this->assertSame('9333333333', $show->json('owner_contact.phone'));

        $this->as($me)->postJson("/api/v1/team/properties/{$property->id}/owner-notes", [
            'type' => 'viewing_availability', 'body' => 'Owner available weekends after 4pm', 'lead_id' => $lead->id,
        ])->assertCreated();
        $this->assertTrue($lead->activities()->where('type', 'owner_coordination')->exists());

        $visit = $this->as($me)->postJson('/api/v1/team/site-visits', [
            'lead_id' => $lead->id, 'property_id' => $property->id, 'scheduled_at' => now()->addDays(2)->toDateTimeString(),
        ])->assertCreated();
        $this->assertSame('site_visit', $lead->fresh()->status);

        $id = $visit->json('data.id');
        $this->as($me)->patchJson("/api/v1/team/site-visits/{$id}", ['status' => 'requested'])->assertStatus(409);
        $this->as($me)->patchJson("/api/v1/team/site-visits/{$id}", ['owner_confirmed' => true])->assertOk();
        $this->as($me)->patchJson("/api/v1/team/site-visits/{$id}", ['status' => 'completed', 'customer_feedback' => 'Liked it'])->assertOk()
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_manual_lead_entry_and_customer_grouping(): void
    {
        $me = $this->teamMember();
        $this->as($me)->postJson('/api/v1/team/leads', ['name' => 'Walk In', 'phone' => '9444444444', 'interest' => 'rent', 'source' => 'walk_in', 'assigned_to' => $me->id])
            ->assertCreated()->assertJsonPath('data.status', 'assigned');
        $this->as($me)->postJson('/api/v1/team/leads', ['name' => 'Walk In', 'phone' => '+91 94444 44444', 'interest' => 'buy', 'source' => 'phone'])->assertCreated();

        $customers = $this->as($me)->getJson('/api/v1/team/customers')->assertOk()->json('data');
        $this->assertCount(1, $customers);
        $this->assertSame(2, $customers[0]['enquiries']);
    }
}
