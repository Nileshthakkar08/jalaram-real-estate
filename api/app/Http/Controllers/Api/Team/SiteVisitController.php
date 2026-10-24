<?php

namespace App\Http\Controllers\Api\Team;

use App\Exceptions\InvalidTransitionException;
use App\Http\Controllers\Controller;
use App\Http\Resources\SiteVisitResource;
use App\Models\Lead;
use App\Models\Property;
use App\Models\SiteVisit;
use App\Services\LeadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SiteVisitController extends Controller
{
    private const TRANSITIONS = [
        'requested' => ['scheduled', 'cancelled'],
        'scheduled' => ['completed', 'cancelled', 'no_show'],
        'completed' => [],
        'cancelled' => ['scheduled'],
        'no_show' => ['scheduled'],
    ];

    public function __construct(private LeadService $leads) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::in(SiteVisit::STATUSES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'mine' => ['nullable', 'boolean'],
        ]);
        $user = $request->user();

        $visits = SiteVisit::query()->with(['lead', 'property', 'assignee'])
            ->whereHas('lead', fn ($q) => $q->visibleTo($user))
            ->when($request->boolean('mine'), fn ($q) => $q->where('assigned_to', $user->id))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('scheduled_at', '>=', Carbon::parse($v)->startOfDay())->orWhere('requested_date', '>=', $v)))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('scheduled_at', '<=', Carbon::parse($v)->endOfDay())->orWhere('requested_date', '<=', $v)))
            ->orderByRaw("FIELD(status, 'requested', 'scheduled', 'completed', 'no_show', 'cancelled')")
            ->orderByRaw('COALESCE(scheduled_at, requested_date)')
            ->paginate(30)->withQueryString();

        return SiteVisitResource::collection($visits);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lead_id' => ['required', 'integer', 'exists:leads,id'],
            'property_id' => ['required', 'integer', 'exists:properties,id'],
            'scheduled_at' => ['required', 'date', 'after:now'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'owner_confirmed' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $lead = Lead::findOrFail($data['lead_id']);
        $this->authorize('work', $lead);
        if (! $lead->isOpen()) {
            throw new InvalidTransitionException('Visits can only be scheduled for open leads.');
        }
        $property = Property::findOrFail($data['property_id']);
        if (! in_array($property->status, ['published', 'unavailable', 'pending'], true)) {
            throw new InvalidTransitionException("Visits cannot be scheduled for a {$property->status} listing.");
        }

        $visit = DB::transaction(function () use ($data, $lead, $property, $request) {
            $visit = $lead->siteVisits()->create([
                'property_id' => $property->id,
                'status' => 'scheduled',
                'scheduled_at' => $data['scheduled_at'],
                'assigned_to' => $data['assigned_to'] ?? $lead->assigned_to ?? $request->user()->id,
                'owner_confirmed' => (bool) ($data['owner_confirmed'] ?? false),
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);
            $this->logVisit($lead, $request, "Site visit scheduled at {$property->title} on ".$visit->scheduled_at->format('d M Y, h:i A').'.');
            $this->leads->advanceTo($lead, 'site_visit', $request->user());

            return $visit;
        });

        return (new SiteVisitResource($visit->load(['lead', 'property', 'assignee'])))->response()->setStatusCode(201);
    }

    public function update(Request $request, SiteVisit $siteVisit): SiteVisitResource
    {
        $lead = $siteVisit->lead;
        $this->authorize('work', $lead);
        $data = $request->validate([
            'status' => ['nullable', Rule::in(SiteVisit::STATUSES)],
            'scheduled_at' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'owner_confirmed' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'customer_feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($siteVisit, $data, $lead, $request) {
            $status = $data['status'] ?? $siteVisit->status;
            if ($status !== $siteVisit->status && ! in_array($status, self::TRANSITIONS[$siteVisit->status], true)) {
                throw new InvalidTransitionException("Cannot change a {$siteVisit->status} visit to {$status}.");
            }
            $scheduledAt = $data['scheduled_at'] ?? $siteVisit->scheduled_at;
            if ($status === 'scheduled' && ! $scheduledAt) {
                abort(422, 'Choose a date and time to schedule the visit.');
            }

            $from = $siteVisit->status;
            $oldTime = $siteVisit->scheduled_at;
            $siteVisit->fill(collect($data)->except('status')->all() + ['status' => $status])->save();

            $messages = [];
            if ($from !== $status) {
                $messages[] = 'Site visit '.str_replace('_', ' ', $status).'.';
            } elseif ($siteVisit->wasChanged('scheduled_at') && $oldTime) {
                $messages[] = 'Site visit rescheduled to '.$siteVisit->scheduled_at->format('d M Y, h:i A').'.';
            }
            if ($siteVisit->wasChanged('owner_confirmed') && $siteVisit->owner_confirmed) {
                $messages[] = 'Owner confirmed the visit.';
            }
            if (filled($data['customer_feedback'] ?? null) && $siteVisit->wasChanged('customer_feedback')) {
                $messages[] = 'Customer feedback: '.$data['customer_feedback'];
            }
            if ($messages) {
                $this->logVisit($lead, $request, implode("\n", $messages));
            }
            if ($status === 'scheduled') {
                $this->leads->advanceTo($lead, 'site_visit', $request->user());
            }
        });

        return new SiteVisitResource($siteVisit->load(['lead', 'property', 'assignee']));
    }

    private function logVisit(Lead $lead, Request $request, string $body): void
    {
        $lead->activities()->create(['user_id' => $request->user()->id, 'type' => 'site_visit', 'body' => $body]);
    }
}
