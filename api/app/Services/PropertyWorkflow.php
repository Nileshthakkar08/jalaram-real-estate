<?php

namespace App\Services;

use App\Exceptions\InvalidTransitionException;
use App\Jobs\NotifySubscribersOfNewListing;
use App\Models\Property;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Listing status state machine. Controllers never write `status` directly.
 *
 * Owner:     draft|rejected → pending (submit); published ↔ unavailable; → closed (withdraw);
 *            editing a live listing sends it back to pending for re-review.
 * Moderator: pending → published|rejected; published → suspended|unavailable|closed|expired;
 *            suspended|unavailable|expired|closed → published; any live state → closed.
 */
class PropertyWorkflow
{
    private const MODERATOR_TRANSITIONS = [
        'pending' => ['published', 'rejected'],
        'published' => ['suspended', 'unavailable', 'closed', 'expired'],
        'suspended' => ['published', 'closed'],
        'unavailable' => ['published', 'closed'],
        'expired' => ['published', 'closed'],
        'closed' => ['published'],
    ];

    /** Edits to these states put the listing back into the review queue. */
    private const REREVIEW_ON_EDIT = ['published', 'unavailable', 'expired'];

    public function __construct(private AuditLogger $audit) {}

    public function ownerCanEdit(Property $property): bool
    {
        return ! in_array($property->status, ['closed', 'suspended'], true);
    }

    /** Called after an owner saves changes. Returns true when the listing was sent back for review. */
    public function afterOwnerEdit(Property $property): bool
    {
        if (! in_array($property->status, self::REREVIEW_ON_EDIT, true)) {
            return false;
        }

        $old = $property->status;
        $property->forceFill(['status' => 'pending', 'submitted_at' => now()])->save();
        $this->audit->log('property.resubmitted_after_edit', $property, ['status' => $old], ['status' => 'pending']);

        return true;
    }

    public function submit(Property $property): Property
    {
        if (! in_array($property->status, ['draft', 'rejected'], true)) {
            throw new InvalidTransitionException("A {$property->status} listing cannot be submitted for review.");
        }

        $missing = [];
        if ($property->images()->count() === 0) {
            $missing['images'] = ['Add at least one photo before submitting.'];
        }
        if (mb_strlen(trim((string) $property->description)) < 30) {
            $missing['description'] = ['Write a description of at least 30 characters before submitting.'];
        }
        if ($missing) {
            throw ValidationException::withMessages($missing);
        }

        return $this->transition($property, 'pending', 'property.submitted', [
            'submitted_at' => now(),
            'rejection_reason' => null,
        ]);
    }

    public function setAvailability(Property $property, bool $available): Property
    {
        if ($available && $property->status === 'unavailable') {
            if ($property->expires_at && $property->expires_at->isPast()) {
                return $this->transition($property, 'expired', 'property.expired');
            }

            return $this->transition($property, 'published', 'property.marked_available');
        }
        if (! $available && $property->status === 'published') {
            return $this->transition($property, 'unavailable', 'property.marked_unavailable');
        }

        throw new InvalidTransitionException('Availability can only be changed on a published or unavailable listing.');
    }

    public function ownerClose(Property $property, ?string $reason = null): Property
    {
        if (! in_array($property->status, ['pending', 'published', 'unavailable', 'expired'], true)) {
            throw new InvalidTransitionException("A {$property->status} listing cannot be withdrawn.");
        }

        return $this->transition($property, 'closed', 'property.withdrawn_by_owner', [], $reason);
    }

    public function approve(Property $property, ?string $note = null): Property
    {
        if ($property->status !== 'pending') {
            throw new InvalidTransitionException('Only listings pending review can be approved.');
        }

        return $this->publish($property, 'property.approved', $note);
    }

    public function reject(Property $property, string $reason): Property
    {
        if ($property->status !== 'pending') {
            throw new InvalidTransitionException('Only listings pending review can be rejected.');
        }

        return $this->transition($property, 'rejected', 'property.rejected', [
            'rejection_reason' => $reason,
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
        ], $reason);
    }

    public function moderatorSetStatus(Property $property, string $status, ?string $reason = null): Property
    {
        $allowed = self::MODERATOR_TRANSITIONS[$property->status] ?? [];
        if (! in_array($status, $allowed, true)) {
            throw new InvalidTransitionException("Cannot change a {$property->status} listing to {$status}.");
        }
        if ($status === 'suspended' && blank($reason)) {
            throw ValidationException::withMessages(['reason' => ['A reason is required to suspend a listing.']]);
        }
        if ($status === 'rejected') {
            return $this->reject($property, (string) $reason);
        }
        if ($status === 'published') {
            return $this->publish($property, 'property.republished', $reason);
        }

        return $this->transition($property, $status, "property.{$status}", [
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
        ], $reason);
    }

    /** Scheduled: move published listings past their expiry date to `expired`. */
    public function expireDue(): int
    {
        $count = 0;
        Property::query()
            ->where('status', 'published')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->each(function (Property $property) use (&$count) {
                $this->transition($property, 'expired', 'property.expired');
                $count++;
            });

        return $count;
    }

    private function publish(Property $property, string $action, ?string $note): Property
    {
        $days = (int) Setting::get('listing_validity_days', '90');
        $firstPublication = $property->published_at === null;

        $property = $this->transition($property, 'published', $action, [
            'published_at' => $property->published_at ?? now(),
            'expires_at' => $days > 0 ? now()->addDays($days) : null,
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
            'rejection_reason' => null,
        ], $note);

        // Tell opted-in visitors about genuinely new listings only (not re-approvals after edits).
        if ($firstPublication) {
            NotifySubscribersOfNewListing::dispatch($property->id)->afterCommit();
        }

        return $property;
    }

    private function transition(Property $property, string $to, string $action, array $extra = [], ?string $reason = null): Property
    {
        return DB::transaction(function () use ($property, $to, $action, $extra, $reason) {
            $from = $property->status;
            $property->forceFill(['status' => $to] + $extra)->save();
            $this->audit->log($action, $property, ['status' => $from], ['status' => $to], $reason);

            return $property;
        });
    }
}
