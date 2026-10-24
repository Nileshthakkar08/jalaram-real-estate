<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Http\Requests\DealRequest;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\DealResource;
use App\Models\AuditLog;
use App\Models\BrokerageRule;
use App\Models\BrokeragePayment;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Services\DealWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class DealController extends Controller
{
    public function __construct(private DealWorkflow $deals) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'status' => ['nullable', 'string'],
            'type' => ['nullable', Rule::in(['sale', 'rent'])],
            'assigned_to' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
            'payment' => ['nullable', Rule::in(['outstanding', 'paid'])],
        ]);

        $deals = Deal::query()->visibleTo($request->user())
            ->with(['property.locality', 'assignee', 'lead', 'agreements'])
            ->when($f['status'] ?? null, fn ($q, $v) => $v === 'open' ? $q->whereIn('status', Deal::OPEN_STATUSES) : $q->whereIn('status', explode(',', $v)))
            ->when($f['type'] ?? null, fn ($q, $v) => $q->where('transaction_type', $v))
            ->when($f['assigned_to'] ?? null, fn ($q, $v) => $q->where('assigned_to', $v))
            ->when(($f['payment'] ?? null) === 'outstanding', fn ($q) => $q->whereHas('agreements', fn ($a) => $a->where('status', '!=', 'cancelled')->where('outstanding_amount', '>', 0)))
            ->when(($f['payment'] ?? null) === 'paid', fn ($q) => $q->where('status', 'closed_won')->whereDoesntHave('agreements', fn ($a) => $a->where('status', '!=', 'cancelled')->where('outstanding_amount', '>', 0)))
            ->when($f['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn ($w) => $w->where('reference_code', 'like', $like)->orWhere('customer_name', 'like', $like)
                    ->orWhereHas('property', fn ($p) => $p->where('title', 'like', $like)->orWhere('reference_code', 'like', $like)));
            })
            ->latest('id')
            ->paginate(20)->withQueryString();

        return DealResource::collection($deals);
    }

    public function store(DealRequest $request): JsonResponse
    {
        $data = $request->validated();
        $lead = Lead::findOrFail($data['lead_id']);
        $this->authorize('work', $lead);
        $property = Property::findOrFail($data['property_id']);

        $deal = $this->deals->create($lead, $property, $request->user(), $data);

        return (new DealResource($this->loadDeal($deal)))->response()->setStatusCode(201);
    }

    public function show(Request $request, Deal $deal): JsonResponse
    {
        $this->authorize('view', $deal);
        $deal = $this->loadDeal($deal);

        $agreementIds = $deal->agreements->pluck('id');
        $paymentIds = $deal->agreements->flatMap->payments->pluck('id');
        $audit = AuditLog::query()->with('user')
            ->where(fn ($q) => $q->where(fn ($w) => $w->where('auditable_type', 'Deal')->where('auditable_id', $deal->id))
                ->orWhere(fn ($w) => $w->where('auditable_type', 'BrokerageAgreement')->whereIn('auditable_id', $agreementIds))
                ->orWhere(fn ($w) => $w->where('auditable_type', 'BrokeragePayment')->whereIn('auditable_id', $paymentIds)))
            ->latest('id')->limit(100)->get();

        return response()->json([
            'data' => new DealResource($deal),
            'audit' => AuditLogResource::collection($audit),
            'can' => [
                'manage_finance' => $request->user()->can('manageFinance', Deal::class),
                'transitions' => DealWorkflow::TRANSITIONS[$deal->status] ?? [],
            ],
            'options' => [
                'parties' => BrokerageRule::PARTIES[$deal->transaction_type],
                'payment_methods' => BrokeragePayment::METHODS,
            ],
        ]);
    }

    public function update(DealRequest $request, Deal $deal): DealResource
    {
        $this->authorize('update', $deal);
        $data = $request->validated();
        if (array_key_exists('assigned_to', $data) && (int) $data['assigned_to'] !== (int) $deal->assigned_to) {
            abort_unless($request->user()->hasPermission('leads.assign'), 403, 'You cannot reassign deals.');
        }

        return new DealResource($this->loadDeal($this->deals->updateTerms($deal, $request->user(), $data)));
    }

    public function status(Request $request, Deal $deal): DealResource
    {
        $this->authorize('update', $deal);
        $data = $request->validate([
            'status' => ['required', Rule::in(Deal::STATUSES)],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        return new DealResource($this->loadDeal($this->deals->changeStatus($deal, $data['status'], $request->user(), $data['reason'] ?? null)));
    }

    public function reapplyRule(Request $request, Deal $deal): DealResource
    {
        $this->authorize('update', $deal);
        abort_unless(in_array($deal->status, Deal::OPEN_STATUSES, true), 409, 'Rules can only be re-applied to open deals.');

        return new DealResource($this->loadDeal($this->deals->reapplyRule($deal)));
    }

    private function loadDeal(Deal $deal): Deal
    {
        return $deal->fresh()->load(['property.locality', 'property.owner', 'lead', 'owner', 'assignee', 'rule', 'documents.uploader',
            'agreements' => fn ($q) => $q->with(['payments.recorder', 'agreedBy'])]);
    }
}
