<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Customers are derived from leads, grouped by normalised phone number. */
class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $term = $request->input('q');

        $base = Lead::query()->visibleTo($request->user())
            ->when($term, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $digits = preg_replace('/\D+/', '', $term);
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)
                    ->when(strlen($digits) >= 4, fn ($w) => $w->orWhere('phone_normalized', 'like', "%{$digits}%")));
            });

        $page = (clone $base)
            ->selectRaw('phone_normalized, MAX(id) as latest_id, COUNT(*) as enquiries, MAX(created_at) as last_enquiry_at')
            ->selectRaw("SUM(status IN ('new','assigned','contacted','qualified','site_visit','negotiation')) as open_leads")
            ->selectRaw("SUM(status = 'won') as won_leads")
            ->groupBy('phone_normalized')
            ->orderByDesc('last_enquiry_at')
            ->paginate(25)->withQueryString();

        $latest = Lead::query()->whereIn('id', $page->pluck('latest_id'))->with('assignee')->get()->keyBy('id');

        return response()->json([
            'data' => $page->getCollection()->map(function ($row) use ($latest) {
                $lead = $latest[$row->latest_id] ?? null;

                return [
                    'phone_normalized' => $row->phone_normalized,
                    'name' => $lead?->name,
                    'phone' => $lead?->phone,
                    'email' => $lead?->email,
                    'enquiries' => (int) $row->enquiries,
                    'open_leads' => (int) $row->open_leads,
                    'won_leads' => (int) $row->won_leads,
                    'last_enquiry_at' => Carbon::parse($row->last_enquiry_at)->toIso8601String(),
                    'latest_lead_id' => (int) $row->latest_id,
                    'latest_status' => $lead?->status,
                    'assignee' => $lead?->assignee?->only(['id', 'name']),
                ];
            }),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage()],
        ]);
    }
}
