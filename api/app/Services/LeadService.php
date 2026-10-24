<?php

namespace App\Services;

use App\Exceptions\InvalidTransitionException;
use App\Models\FollowUp;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\SiteVisit;
use App\Models\User;
use App\Notifications\LeadAssignedNotification;
use App\Notifications\NewLeadNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class LeadService
{
    /** Manual transitions. `won` is only reachable by closing a deal (DealWorkflow). */
    public const TRANSITIONS = [
        'new' => ['assigned', 'contacted', 'lost', 'cancelled'],
        'assigned' => ['contacted', 'lost', 'cancelled'],
        'contacted' => ['qualified', 'site_visit', 'negotiation', 'lost', 'cancelled'],
        'qualified' => ['site_visit', 'negotiation', 'lost', 'cancelled'],
        'site_visit' => ['qualified', 'negotiation', 'lost', 'cancelled'],
        'negotiation' => ['site_visit', 'lost', 'cancelled'],
        'won' => [],
        'lost' => ['contacted'],
        'cancelled' => ['contacted'],
    ];

    /** Pipeline order used for automatic forward-only progression. */
    private const STAGE = ['new' => 0, 'assigned' => 1, 'contacted' => 2, 'qualified' => 3, 'site_visit' => 4, 'negotiation' => 5];

    /** An open lead from the same phone for the same property within this window is treated as a repeat. */
    private const DUPLICATE_WINDOW_DAYS = 30;

    public function __construct(private AuditLogger $audit) {}

    /**
     * Save a public enquiry or site-visit request. Returns [lead, isDuplicate].
     *
     * @return array{0: Lead, 1: bool}
     */
    public function intake(array $data, ?array $visitRequest = null): array
    {
        return DB::transaction(function () use ($data, $visitRequest) {
            $existing = $this->findOpenDuplicate($data);

            if ($existing) {
                $existing->activities()->create([
                    'type' => 'note',
                    'body' => 'Repeat '.($visitRequest ? 'site-visit request' : 'enquiry').' from the website.'
                        .(filled($data['message'] ?? null) ? "\n\n".$data['message'] : ''),
                    'meta' => ['source_page' => $data['source_page'] ?? null],
                ]);
                if ($visitRequest) {
                    $existing->forceFill([
                        'preferred_visit_date' => $visitRequest['preferred_date'],
                        'preferred_visit_slot' => $visitRequest['preferred_slot'] ?? null,
                    ])->save();
                    $this->createVisitRequest($existing, $visitRequest);
                }

                return [$existing, true];
            }

            $lead = Lead::create($data + [
                'status' => 'new',
                'preferred_visit_date' => $visitRequest['preferred_date'] ?? null,
                'preferred_visit_slot' => $visitRequest['preferred_slot'] ?? null,
            ]);
            $lead->activities()->create([
                'type' => 'created',
                'body' => $visitRequest ? 'Site-visit request received from the website.' : 'Enquiry received from the website.',
                'meta' => ['source' => $lead->source, 'source_page' => $lead->source_page],
            ]);

            if ($visitRequest) {
                $this->createVisitRequest($lead, $visitRequest);
            }

            DB::afterCommit(fn () => Notification::send(
                User::query()->staff()->get(),
                new NewLeadNotification($lead, $visitRequest ? 'site_visit_request' : 'enquiry'),
            ));

            return [$lead, false];
        });
    }

    /** Manual lead entered by the team (phone call, walk-in, referral...). */
    public function createManual(array $data, User $actor): Lead
    {
        return DB::transaction(function () use ($data, $actor) {
            $assignee = $data['assigned_to'] ?? null;
            unset($data['assigned_to']);

            $lead = Lead::create($data + ['status' => 'new', 'consent_contact' => true]);
            $lead->activities()->create([
                'user_id' => $actor->id,
                'type' => 'created',
                'body' => "Lead entered manually (source: {$lead->source}).",
            ]);

            if ($assignee) {
                $this->assign($lead, User::findOrFail($assignee), $actor);
            }

            return $lead;
        });
    }

    public function assign(Lead $lead, User $assignee, User $actor): Lead
    {
        if (! $assignee->isStaff() || ! $assignee->is_active) {
            throw ValidationException::withMessages(['user_id' => ['Leads can only be assigned to active team members.']]);
        }

        return DB::transaction(function () use ($lead, $assignee, $actor) {
            $previous = $lead->assigned_to;
            $lead->forceFill([
                'assigned_to' => $assignee->id,
                'assigned_at' => now(),
                'status' => $lead->status === 'new' ? 'assigned' : $lead->status,
            ])->save();

            // Pending follow-ups move with the lead.
            $lead->followUps()->where('status', 'pending')->update(['assigned_to' => $assignee->id]);

            $previousName = $previous ? User::withTrashed()->find($previous)?->name : null;
            $lead->activities()->create([
                'user_id' => $actor->id,
                'type' => 'assignment',
                'body' => $previousName
                    ? "Reassigned from {$previousName} to {$assignee->name}."
                    : "Assigned to {$assignee->name}.",
                'meta' => ['from' => $previous, 'to' => $assignee->id],
            ]);
            $this->audit->log('lead.assigned', $lead, ['assigned_to' => $previous], ['assigned_to' => $assignee->id]);

            if ($assignee->id !== $actor->id) {
                DB::afterCommit(fn () => $assignee->notify(new LeadAssignedNotification($lead)));
            }

            return $lead;
        });
    }

    public function changeStatus(Lead $lead, string $status, User $actor, ?string $reason = null): Lead
    {
        $allowed = self::TRANSITIONS[$lead->status] ?? [];
        if (! in_array($status, $allowed, true)) {
            $hint = $status === 'won' ? ' A lead is marked won by closing its deal.' : '';
            throw new InvalidTransitionException("Cannot move a lead from {$lead->status} to {$status}.{$hint}");
        }
        if (in_array($status, ['lost', 'cancelled'], true) && blank($reason)) {
            throw ValidationException::withMessages(['reason' => ["Give a reason when marking a lead {$status}."]]);
        }

        return DB::transaction(function () use ($lead, $status, $actor, $reason) {
            $from = $lead->status;
            $lead->forceFill([
                'status' => $status,
                'closed_reason' => in_array($status, ['lost', 'cancelled'], true) ? $reason : null,
            ])->save();

            if (in_array($status, ['lost', 'cancelled'], true)) {
                $lead->followUps()->where('status', 'pending')->update(['status' => 'cancelled']);
                $this->syncNextFollowUp($lead);
            }

            $this->recordStatusChange($lead, $from, $status, $actor, $reason);

            return $lead;
        });
    }

    /** Forward-only progression triggered by other actions (contact made, visit scheduled, deal opened...). */
    public function advanceTo(Lead $lead, string $status, ?User $actor = null, ?string $note = null): void
    {
        if (! isset(self::STAGE[$lead->status], self::STAGE[$status]) || self::STAGE[$lead->status] >= self::STAGE[$status]) {
            return;
        }
        $from = $lead->status;
        $lead->forceFill(['status' => $status])->save();
        $this->recordStatusChange($lead, $from, $status, $actor, $note);
    }

    /** System-driven terminal change when the lead's deal closes won. */
    public function markWon(Lead $lead, ?User $actor, string $note): void
    {
        $from = $lead->status;
        $lead->forceFill(['status' => 'won', 'closed_reason' => null])->save();
        $lead->followUps()->where('status', 'pending')->update(['status' => 'cancelled']);
        $this->syncNextFollowUp($lead);
        $this->recordStatusChange($lead, $from, 'won', $actor, $note);
    }

    public function logActivity(Lead $lead, User $actor, string $type, ?string $outcome, ?string $body): LeadActivity
    {
        return DB::transaction(function () use ($lead, $actor, $type, $outcome, $body) {
            $activity = $lead->activities()->create([
                'user_id' => $actor->id,
                'type' => $type,
                'outcome' => $outcome,
                'body' => $body,
            ]);

            if (in_array($type, LeadActivity::CONTACT_TYPES, true)) {
                $updates = ['contact_attempts' => $lead->contact_attempts + 1];
                $reached = $outcome === null || in_array($outcome, ['connected', 'call_back_later', 'not_interested'], true);
                if ($reached) {
                    $updates['last_contacted_at'] = now();
                }
                $lead->forceFill($updates)->save();

                if ($reached) {
                    $this->advanceTo($lead, 'contacted', $actor);
                }
            }

            if ($type === 'requirement' && filled($body)) {
                $lead->forceFill(['requirements' => trim(($lead->requirements ? $lead->requirements."\n" : '').$body)])->save();
            }

            return $activity;
        });
    }

    public function scheduleFollowUp(Lead $lead, User $actor, array $data): FollowUp
    {
        if (! $lead->isOpen()) {
            throw new InvalidTransitionException('Follow-ups can only be scheduled on open leads.');
        }

        return DB::transaction(function () use ($lead, $actor, $data) {
            $followUp = $lead->followUps()->create([
                'assigned_to' => $data['assigned_to'] ?? $lead->assigned_to ?? $actor->id,
                'created_by' => $actor->id,
                'due_at' => $data['due_at'],
                'channel' => $data['channel'] ?? 'call',
                'notes' => $data['notes'] ?? null,
                'status' => 'pending',
            ]);
            $lead->activities()->create([
                'user_id' => $actor->id,
                'type' => 'follow_up',
                'body' => "Follow-up ({$followUp->channel}) scheduled for ".$followUp->due_at->format('d M Y, h:i A').'.'
                    .($followUp->notes ? "\n".$followUp->notes : ''),
            ]);
            $this->syncNextFollowUp($lead);

            return $followUp;
        });
    }

    public function updateFollowUp(FollowUp $followUp, User $actor, string $action, array $data): FollowUp
    {
        if ($followUp->status !== 'pending') {
            throw new InvalidTransitionException("This follow-up is already {$followUp->status}.");
        }

        return DB::transaction(function () use ($followUp, $actor, $action, $data) {
            $lead = $followUp->lead;
            $outcome = filled($data['outcome'] ?? null) ? "\n".$data['outcome'] : '';
            $body = match ($action) {
                'complete' => 'Follow-up completed.'.$outcome,
                'cancel' => 'Follow-up cancelled.'.$outcome,
                'reschedule' => 'Follow-up rescheduled from '.$followUp->due_at->format('d M Y, h:i A').' to '
                    .Carbon::parse($data['due_at'])->format('d M Y, h:i A').'.',
            };

            $followUp->forceFill(match ($action) {
                'complete' => ['status' => 'done', 'completed_at' => now(), 'completed_by' => $actor->id, 'outcome' => $data['outcome'] ?? null],
                'cancel' => ['status' => 'cancelled', 'completed_at' => now(), 'completed_by' => $actor->id, 'outcome' => $data['outcome'] ?? null],
                'reschedule' => ['due_at' => $data['due_at']],
            })->save();

            $lead->activities()->create(['user_id' => $actor->id, 'type' => 'follow_up', 'body' => $body]);
            $this->syncNextFollowUp($lead);

            return $followUp;
        });
    }

    public function syncNextFollowUp(Lead $lead): void
    {
        $next = $lead->followUps()->where('status', 'pending')->min('due_at');
        $lead->forceFill(['next_follow_up_at' => $next])->save();
    }

    private function recordStatusChange(Lead $lead, string $from, string $to, ?User $actor, ?string $reason): void
    {
        $lead->activities()->create([
            'user_id' => $actor?->id,
            'type' => 'status_change',
            'body' => 'Status changed from '.str_replace('_', ' ', $from).' to '.str_replace('_', ' ', $to).'.'
                .($reason ? "\n".$reason : ''),
            'meta' => ['from' => $from, 'to' => $to],
        ]);
        $this->audit->log('lead.status_changed', $lead, ['status' => $from], ['status' => $to], $reason);
    }

    private function findOpenDuplicate(array $data): ?Lead
    {
        return Lead::query()
            ->where('phone_normalized', Lead::normalizePhone($data['phone']))
            ->whereIn('status', Lead::OPEN_STATUSES)
            ->where('created_at', '>=', now()->subDays(self::DUPLICATE_WINDOW_DAYS))
            ->when(
                $data['property_id'] ?? null,
                fn ($q, $propertyId) => $q->where('property_id', $propertyId),
                fn ($q) => $q->whereNull('property_id')->where('interest', $data['interest'] ?? 'general'),
            )
            ->lockForUpdate()
            ->latest('id')
            ->first();
    }

    private function createVisitRequest(Lead $lead, array $visitRequest): SiteVisit
    {
        $visit = $lead->siteVisits()->create([
            'property_id' => $lead->property_id,
            'status' => 'requested',
            'requested_date' => $visitRequest['preferred_date'],
            'requested_slot' => $visitRequest['preferred_slot'] ?? null,
        ]);
        $lead->activities()->create([
            'type' => 'site_visit',
            'body' => 'Customer requested a site visit on '.$visit->requested_date->format('d M Y')
                .($visit->requested_slot ? " ({$visit->requested_slot})" : '').'.',
        ]);

        return $visit;
    }
}
