<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Property;
use Tests\TestCase;

class ModerationTest extends TestCase
{
    public function test_admin_approves_and_listing_becomes_public(): void
    {
        $property = Property::factory()->create(['status' => 'pending']);
        $this->getJson("/api/v1/properties/{$property->slug}")->assertNotFound();

        $this->as($this->admin())->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertOk()->assertJsonPath('data.status', 'published');
        $this->getJson("/api/v1/properties/{$property->fresh()->slug}")->assertOk();
        $this->assertNotNull($property->fresh()->expires_at);
        $this->assertTrue(AuditLog::where('action', 'property.approved')->exists());
    }

    public function test_rejection_requires_reason_which_owner_can_see(): void
    {
        $owner = $this->owner();
        $property = Property::factory()->create(['status' => 'pending', 'owner_id' => $owner->id]);
        $admin = $this->admin();

        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/reject", [])->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/reject", ['reason' => 'Photos are blurry'])->assertOk();
        $this->as($owner)->getJson("/api/v1/owner/properties/{$property->id}")
            ->assertJsonPath('data.status', 'rejected')->assertJsonPath('data.rejection_reason', 'Photos are blurry');
    }

    public function test_suspension_requires_reason_and_invalid_transitions_conflict(): void
    {
        $property = $this->publishedProperty();
        $admin = $this->admin();
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/status", ['status' => 'suspended'])->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/status", ['status' => 'suspended', 'reason' => 'Complaint'])->assertOk();
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertStatus(409);
        $this->as($admin)->postJson("/api/v1/admin/properties/{$property->id}/status", ['status' => 'published'])->assertOk();
    }

    public function test_only_moderators_can_moderate(): void
    {
        $property = Property::factory()->create(['status' => 'pending']);
        $this->as($this->teamMember())->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertForbidden();
        $this->as($this->teamMember(['properties.moderate']))->postJson("/api/v1/admin/properties/{$property->id}/approve")->assertOk();
        $this->as($this->teamMember(['properties.moderate']))->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_expiry_command_expires_due_listings(): void
    {
        $due = $this->publishedProperty(['expires_at' => now()->subMinute()]);
        $fresh = $this->publishedProperty();
        $this->artisan('listings:expire')->assertSuccessful();
        $this->assertSame('expired', $due->fresh()->status);
        $this->assertSame('published', $fresh->fresh()->status);
    }
}
