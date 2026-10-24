<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\BrokerageRuleRequest;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\BrokerageRuleResource;
use App\Models\AuditLog;
use App\Models\BrokerageRule;
use App\Services\AuditLogger;
use App\Services\BrokerageCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BrokerageRuleController extends Controller
{
    public function __construct(private AuditLogger $audit, private BrokerageCalculator $calculator) {}

    public function index(): AnonymousResourceCollection
    {
        return BrokerageRuleResource::collection(
            BrokerageRule::query()->with('locality')->orderBy('transaction_type')->orderByDesc('is_active')->orderByDesc('priority')->orderBy('name')->get()
        );
    }

    public function store(BrokerageRuleRequest $request): JsonResponse
    {
        $rule = BrokerageRule::create($request->ruleData() + ['created_by' => $request->user()->id, 'updated_by' => $request->user()->id]);
        $this->audit->log('brokerage_rule.created', $rule, [], $rule->toArray(), $request->input('change_reason'));

        return (new BrokerageRuleResource($rule->load('locality')))->response()->setStatusCode(201);
    }

    public function show(BrokerageRule $brokerageRule): JsonResponse
    {
        return response()->json([
            'data' => new BrokerageRuleResource($brokerageRule->load('locality')),
            'history' => AuditLogResource::collection(AuditLog::query()->with('user')->where('auditable_type', 'BrokerageRule')
                ->where('auditable_id', $brokerageRule->id)->latest('id')->get()),
        ]);
    }

    public function update(BrokerageRuleRequest $request, BrokerageRule $brokerageRule): BrokerageRuleResource
    {
        $original = $brokerageRule->getAttributes();
        $brokerageRule->fill($request->ruleData() + ['updated_by' => $request->user()->id])->save();
        $this->audit->logChanges('brokerage_rule.updated', $brokerageRule, $original, $request->input('change_reason'));

        return new BrokerageRuleResource($brokerageRule->load('locality'));
    }

    /** Soft delete; deals keep their snapshot of the rule. */
    public function destroy(Request $request, BrokerageRule $brokerageRule): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $brokerageRule->delete();
        $this->audit->log('brokerage_rule.deleted', $brokerageRule, $brokerageRule->only(['name', 'transaction_type', 'method']), [], $request->input('reason'));

        return response()->json(['message' => 'Rule deleted.']);
    }

    /** Preview a calculation against arbitrary inputs, for the rules page. */
    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transaction_type' => ['required', 'in:sale,rent'],
            'property_type' => ['nullable', 'string'],
            'locality_id' => ['nullable', 'integer'],
            'asking_price' => ['required', 'numeric', 'min:0'],
            'final_price' => ['nullable', 'numeric', 'min:0'],
        ]);
        $rule = $this->calculator->findRule($data['transaction_type'], $data['property_type'] ?? null, $data['locality_id'] ?? null);

        return response()->json(['data' => $this->calculator->estimate($rule, $data['transaction_type'], (string) $data['asking_price'], isset($data['final_price']) ? (string) $data['final_price'] : null)]);
    }
}
