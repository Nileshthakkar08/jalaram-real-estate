<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Http\Requests\BrokerageAgreementRequest;
use App\Http\Requests\BrokeragePaymentRequest;
use App\Http\Resources\BrokerageAgreementResource;
use App\Http\Resources\BrokeragePaymentResource;
use App\Models\BrokerageAgreement;
use App\Models\BrokeragePayment;
use App\Models\Deal;
use App\Models\Property;
use App\Services\BrokerageCalculator;
use App\Services\BrokerageLedger;
use App\Services\DealWorkflow;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class BrokerageController extends Controller
{
    public function __construct(
        private DealWorkflow $deals,
        private BrokerageLedger $ledger,
        private BrokerageCalculator $calculator,
        private ReportService $reports,
    ) {}

    public function estimate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'property_id' => ['required', 'integer', 'exists:properties,id'],
            'final_price' => ['nullable', 'numeric', 'min:0'],
        ]);
        $property = Property::findOrFail($data['property_id']);
        $rule = $this->calculator->findRule($property->listing_purpose, $property->property_type, $property->locality_id);

        return response()->json(['data' => $this->calculator->estimate($rule, $property->listing_purpose, $property->price, $data['final_price'] ?? null)]);
    }

    public function storeAgreement(BrokerageAgreementRequest $request, Deal $deal): JsonResponse
    {
        $this->authorize('update', $deal);
        $agreement = $this->deals->addAgreement($deal, $request->user(), $request->validated());

        return (new BrokerageAgreementResource($agreement->fresh(['payments', 'agreedBy'])))->response()->setStatusCode(201);
    }

    public function updateAgreement(BrokerageAgreementRequest $request, BrokerageAgreement $agreement): BrokerageAgreementResource
    {
        $deal = $agreement->deal;
        $this->authorize('update', $deal);
        $data = $request->validated();

        $changesMoney = array_key_exists('agreed_amount', $data) && $agreement->agreed_amount !== null
            && (string) $data['agreed_amount'] !== (string) $agreement->agreed_amount;
        if ($changesMoney || ($data['cancel'] ?? false)) {
            $this->authorize('manageFinance', $deal);
        }

        return new BrokerageAgreementResource($this->deals->updateAgreement($agreement, $request->user(), $data)->fresh(['payments.recorder', 'agreedBy']));
    }

    public function storePayment(BrokeragePaymentRequest $request, BrokerageAgreement $agreement): JsonResponse
    {
        $this->authorize('manageFinance', $agreement->deal);
        $payment = $this->ledger->record($agreement, $request->user(), $request->validated());

        return response()->json([
            'data' => new BrokeragePaymentResource($payment->load('recorder')),
            'agreement' => new BrokerageAgreementResource($agreement->fresh(['payments.recorder', 'agreedBy'])),
        ], 201);
    }

    public function voidPayment(Request $request, BrokeragePayment $payment): JsonResponse
    {
        $this->authorize('manageFinance', $payment->deal);
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $this->ledger->void($payment, $request->user(), $data['reason']);

        return response()->json([
            'data' => new BrokeragePaymentResource($payment->fresh('recorder')),
            'agreement' => new BrokerageAgreementResource($payment->agreement->fresh(['payments.recorder', 'agreedBy'])),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $user = $request->user();
        $from = isset($data['from']) ? Carbon::parse($data['from']) : now()->startOfYear();
        $to = isset($data['to']) ? Carbon::parse($data['to']) : now();

        $report = $this->reports->finance($from, $to, $user->hasPermission('finance.manage') ? null : $user);
        $report['scope'] = $user->hasPermission('finance.manage') ? 'all' : 'own_deals';

        return response()->json(['data' => $report]);
    }
}
