<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Http\Requests\LeadRequest;
use App\Http\Resources\DealResource;
use App\Http\Resources\FollowUpResource;
use App\Http\Resources\LeadActivityResource;
use App\Http\Resources\LeadResource;
use App\Http\Resources\OwnerNoteResource;
use App\Http\Resources\SiteVisitResource;
use App\Models\FollowUp;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\LeadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class LeadController extends Controller
{
    public function __construct(private LeadService $leads, private AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'status' => ['nullable', 'string'],
            'interest' => ['nullable', Rule::in(Lead::INTERESTS)],
            'source' => ['nullable', Rule::in(Lead::SOURCES)],
            'assigned' => ['nullable', 'string'],
            'q' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'follow_up' => ['nullable', Rule::in(['today', 'overdue'])],
            'property_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['newest', 'oldest', 'follow_up', 'updated'])],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);
        $user = $request->user();

        $query = Lead::query()->visibleTo($user)->with(['property', 'assignee'])
            ->when($f['status'] ?? null, function ($q, $status) {
                $status === 'open' ? $q->whereIn('status', Lead::OPEN_STATUSES) : $q->whereIn('status', explode(',', $status));
            })
            ->when($f['interest'] ?? null, fn ($q, $v) => $q->where('interest', $v))
            ->when($f['source'] ?? null, fn ($q, $v) => $q->where('source', $v))
            ->when($f['property_id'] ?? null, fn ($q, $v) => $q->where('property_id', $v))
            ->when($f['assigned'] ?? null, fn ($q, $v) => match ($v) {
                'me' => $q->where('assigned_to', $user->id),
                'unassigned' => $q->whereNull('assigned_to'),
                default => $q->where('assigned_to', (int) $v),
            })
            ->when($f['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $digits = preg_replace('/\D+/', '', $term);
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('reference_code', 'like', $like)
                    ->when(strlen($digits) >= 4, fn ($w) => $w->orWhere('phone_normalized', 'like', "%{$digits}%")));
            })
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', Carbon::parse($v)->startOfDay()))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<=', Carbon::parse($v)->endOfDay()))
            ->when(($f['follow_up'] ?? null) === 'today', fn ($q) => $q->whereBetween('next_follow_up_at', [today(), today()->endOfDay()]))
            ->when(($f['follow_up'] ?? null) === 'overdue', fn ($q) => $q->where('next_follow_up_at', '<', today()));

        match ($f['sort'] ?? 'newest') {
            'oldest' => $query->oldest('id'),
            'follow_up' => $query->orderByRaw('next_follow_up_at IS NULL')->orderBy('next_follow_up_at'),
            'updated' => $query->latest('updated_at'),
            default => $query->latest('id'),
        };

        return LeadResource::collection($query->paginate($f['per_page'] ?? 20)->withQueryString());
    }

    public function store(LeadRequest $request): JsonResponse
    {
        $data = $request->validated();
        if (! empty($data['assigned_to']) && (int) $data['assigned_to'] !== $request->user()->id && ! $request->user()->hasPermission('leads.assign')) {
            abort(403, 'You can only assign new leads to yourself.');
        }
        $lead = $this->leads->createManual($data, $request->user());

        return (new LeadResource($lead->load(['property', 'assignee'])))->response()->setStatusCode(201);
    }

    public function show(Request $request, Lead $lead): JsonResponse
    {
        $this->authorize('view', $lead);
        $lead->load(['property.owner', 'property.locality', 'assignee', 'preferredLocality', 'activities.user', 'followUps.assignee', 'siteVisits.property', 'siteVisits.assignee', 'deals.assignee']);
        $property = $lead->property;

        return response()->json([
            'data' => new LeadResource($lead),
            'activities' => LeadActivityResource::collection($lead->activities),
            'follow_ups' => FollowUpResource::collection($lead->followUps),
            'site_visits' => SiteVisitResource::collection($lead->siteVisits),
            'deals' => DealResource::collection($lead->deals),
            'owner_contact' => $property ? $property->coordinationContact() + ['private_address' => $property->private_address] : null,
            'owner_notes' => $property ? OwnerNoteResource::collection($property->ownerNotes()->with('user')->limit(50)->get()) : [],
            'other_leads' => Lead::query()->visibleTo($request->user())->where('phone_normalized', $lead->phone_normalized)
                ->whereKeyNot($lead->id)->with('property')->latest('id')->limit(10)->get()
                ->map(fn ($l) => ['id' => $l->id, 'reference_code' => $l->reference_code, 'status' => $l->status, 'property' => $l->property?->title, 'created_at' => $l->created_at?->toIso8601String()]),
            'can' => [
                'work' => $request->user()->can('work', $lead),
                'assign_others' => $request->user()->hasPermission('leads.assign'),
                'transitions' => LeadService::TRANSITIONS[$lead->status] ?? [],
            ],
        ]);
    }

    public function update(LeadRequest $request, Lead $lead): LeadResource
    {
        $this->authorize('work', $lead);
        $original = $lead->getAttributes();
        $lead->fill($request->validated())->save();
        $this->audit->logChanges('lead.updated', $lead, $original);
        if ($lead->wasChanged('requirements')) {
            $lead->activities()->create(['user_id' => $request->user()->id, 'type' => 'requirement', 'body' => 'Requirements updated.']);
        }

        return new LeadResource($lead->load(['property', 'assignee']));
    }

    public function assign(Request $request, Lead $lead): LeadResource
    {
        $this->authorize('view', $lead);
        $data = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        $assignee = User::findOrFail($data['user_id']);
        $this->authorize('assign', [$lead, $assignee]);

        return new LeadResource($this->leads->assign($lead, $assignee, $request->user())->load(['property', 'assignee']));
    }

    public function status(Request $request, Lead $lead): LeadResource
    {
        $this->authorize('work', $lead);
        $data = $request->validate([
            'status' => ['required', Rule::in(Lead::STATUSES)],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        return new LeadResource($this->leads->changeStatus($lead, $data['status'], $request->user(), $data['reason'] ?? null)->load(['property', 'assignee']));
    }

    public function addActivity(Request $request, Lead $lead): JsonResponse
    {
        $this->authorize('work', $lead);
        $data = $request->validate([
            'type' => ['required', Rule::in(LeadActivity::MANUAL_TYPES)],
            'outcome' => ['nullable', Rule::in(LeadActivity::OUTCOMES)],
            'body' => ['required_unless:type,call', 'nullable', 'string', 'max:5000'],
        ]);
        $activity = $this->leads->logActivity($lead, $request->user(), $data['type'], $data['outcome'] ?? null, $data['body'] ?? null);

        return (new LeadActivityResource($activity->load('user')))->response()->setStatusCode(201);
    }

    public function addFollowUp(Request $request, Lead $lead): JsonResponse
    {
        $this->authorize('work', $lead);
        $data = $request->validate([
            'due_at' => ['required', 'date', 'after:now'],
            'channel' => ['nullable', Rule::in(FollowUp::CHANNELS)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);
        if (! empty($data['assigned_to']) && (int) $data['assigned_to'] !== $request->user()->id && ! $request->user()->hasPermission('leads.assign')) {
            abort(403, 'You can only schedule follow-ups for yourself.');
        }

        return (new FollowUpResource($this->leads->scheduleFollowUp($lead, $request->user(), $data)->load('assignee')))
            ->response()->setStatusCode(201);
    }
}
