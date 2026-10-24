<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\Setting;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class AdminController extends Controller
{
    public function __construct(private AuditLogger $audit, private ReportService $reports) {}

    public function dashboard(): JsonResponse
    {
        $finance = $this->reports->finance(now()->startOfMonth(), now());
        $allTime = $this->reports->finance(Carbon::create(2000), now());

        return response()->json(['data' => [
            'properties' => Property::query()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            'users' => User::query()->selectRaw('role, COUNT(*) as total')->groupBy('role')->pluck('total', 'role'),
            'leads' => [
                'open' => Lead::query()->whereIn('status', Lead::OPEN_STATUSES)->count(),
                'unassigned' => Lead::query()->whereIn('status', Lead::OPEN_STATUSES)->whereNull('assigned_to')->count(),
                'this_month' => Lead::query()->where('created_at', '>=', now()->startOfMonth())->count(),
                'won_this_month' => Lead::query()->where('status', 'won')->where('updated_at', '>=', now()->startOfMonth())->count(),
            ],
            'deals' => [
                'open' => Deal::query()->whereIn('status', Deal::OPEN_STATUSES)->count(),
                'closed_won_this_month' => Deal::query()->where('status', 'closed_won')->where('closed_at', '>=', now()->startOfMonth())->count(),
            ],
            'brokerage' => [
                'potential' => $finance['totals']['potential'],
                'agreed_this_month' => $finance['totals']['agreed'],
                'collected_this_month' => $finance['totals']['collected'],
                'outstanding' => $allTime['totals']['outstanding'],
            ],
            'pending_review' => Property::query()->where('status', 'pending')->count(),
        ]]);
    }

    public function settings(): JsonResponse
    {
        $values = Setting::query()->pluck('value', 'key');

        return response()->json(['data' => collect(Setting::DEFINITIONS)->map(fn ($public, $key) => [
            'key' => $key, 'value' => $values[$key] ?? null, 'is_public' => $public,
        ])->values()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settings' => ['required', 'array'],
            'settings.business_phone' => ['nullable', 'string', 'max:30'],
            'settings.business_whatsapp' => ['nullable', 'string', 'regex:/^[0-9]{10,15}$/'],
            'settings.business_email' => ['nullable', 'email', 'max:160'],
            'settings.business_address' => ['nullable', 'string', 'max:300'],
            'settings.business_hours' => ['nullable', 'string', 'max:120'],
            'settings.social_instagram' => ['nullable', 'url:https', 'max:300'],
            'settings.social_facebook' => ['nullable', 'url:https', 'max:300'],
            'settings.rera_registration' => ['nullable', 'string', 'max:80'],
            'settings.listing_validity_days' => ['nullable', 'integer', 'between:0,730'],
            'settings.lead_notification_email' => ['nullable', 'email', 'max:160'],
        ], ['settings.business_whatsapp.regex' => 'Enter the WhatsApp number as digits with country code, e.g. 919800000000.']);

        $old = Setting::query()->pluck('value', 'key');
        $changes = [];
        foreach ($data['settings'] as $key => $value) {
            if (! array_key_exists($key, Setting::DEFINITIONS)) {
                continue;
            }
            $value = $value === null ? null : trim((string) $value);
            if (($old[$key] ?? null) !== $value) {
                $changes[$key] = [$old[$key] ?? null, $value];
            }
            Setting::updateOrCreate(['key' => $key], ['value' => $value, 'is_public' => Setting::DEFINITIONS[$key]]);
        }
        if ($changes) {
            $this->audit->log('settings.updated', null, array_map(fn ($c) => $c[0], $changes), array_map(fn ($c) => $c[1], $changes));
        }

        return $this->settings();
    }

    public function auditLogs(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'entity' => ['nullable', 'string', 'max:100'],
            'entity_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $logs = AuditLog::query()->with('user')
            ->when($f['action'] ?? null, fn ($q, $v) => $q->where('action', 'like', str_replace(['%', '_'], ['\%', '\_'], $v).'%'))
            ->when($f['entity'] ?? null, fn ($q, $v) => $q->where('auditable_type', $v))
            ->when($f['entity_id'] ?? null, fn ($q, $v) => $q->where('auditable_id', $v))
            ->when($f['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', Carbon::parse($v)->startOfDay()))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<=', Carbon::parse($v)->endOfDay()))
            ->latest('id')
            ->paginate(50)->withQueryString();

        return AuditLogResource::collection($logs);
    }

    public function financeReport(Request $request): JsonResponse
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $from = isset($data['from']) ? Carbon::parse($data['from']) : now()->subMonths(11)->startOfMonth();
        $to = isset($data['to']) ? Carbon::parse($data['to']) : now();

        return response()->json(['data' => $this->reports->finance($from, $to) + ['scope' => 'all']]);
    }
}
