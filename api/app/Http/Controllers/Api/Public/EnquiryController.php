<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\PublicEnquiryRequest;
use App\Http\Requests\SiteVisitRequestRequest;
use App\Services\LeadService;
use Illuminate\Http\JsonResponse;

/** Every public enquiry lands in the central lead system — never with the property owner. */
class EnquiryController extends Controller
{
    public function __construct(private LeadService $leads) {}

    public function store(PublicEnquiryRequest $request): JsonResponse
    {
        [$lead, $duplicate] = $this->leads->intake($request->leadData());

        return response()->json([
            'data' => ['reference' => $lead->reference_code, 'duplicate' => $duplicate],
            'message' => $duplicate
                ? 'We already have your enquiry and have added this message to it. Our team will contact you shortly.'
                : 'Thank you. Our team will contact you shortly.',
        ], $duplicate ? 200 : 201);
    }

    public function siteVisit(SiteVisitRequestRequest $request): JsonResponse
    {
        [$lead, $duplicate] = $this->leads->intake($request->leadData(), $request->safe()->only(['preferred_date', 'preferred_slot']));

        return response()->json([
            'data' => ['reference' => $lead->reference_code, 'duplicate' => $duplicate],
            'message' => 'Your visit request has been received. Our team will call you to confirm a time with the owner.',
        ], $duplicate ? 200 : 201);
    }
}
