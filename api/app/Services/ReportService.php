<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\FollowUp;
use App\Models\Lead;
use App\Models\SiteVisit;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Brokerage reporting. Each figure reads its own layer and they are never mixed:
 *  - potential:   rule estimates on open deals (pipeline, not revenue)
 *  - agreed:      amounts parties agreed (agreed_at in range)
 *  - invoiced:    invoice amounts (invoice_date in range)
 *  - collected:   ledger payments minus refunds (payment_date in range) — the only "cash" figure
 *  - outstanding: unpaid agreed brokerage on closed-won deals (as of now)
 * Property prices and rents never feed into these numbers except through rule estimates.
 */
class ReportService
{
    public function finance(Carbon $from, Carbon $to, ?User $scopeTo = null): array
    {
        $from = $from->copy()->startOfDay();
        $to = $to->copy()->endOfDay();

        $agreements = fn () => DB::table('brokerage_agreements as a')
            ->join('deals as d', 'd.id', '=', 'a.deal_id')
            ->whereNull('a.deleted_at')->whereNull('d.deleted_at')
            ->where('a.status', '!=', 'cancelled')
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id));

        $ledger = fn (string $type) => DB::table('brokerage_payments as p')
            ->join('deals as d', 'd.id', '=', 'p.deal_id')
            ->whereNull('p.voided_at')->whereNull('d.deleted_at')
            ->where('p.type', $type)
            ->whereBetween('p.payment_date', [$from->toDateString(), $to->toDateString()])
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id));

        $potential = DB::table('deals as d')->whereNull('d.deleted_at')
            ->whereIn('d.status', Deal::OPEN_STATUSES)
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id))
            ->sum('d.estimated_brokerage');

        $agreed = $agreements()->whereNotIn('d.status', ['closed_lost', 'cancelled'])
            ->whereNotNull('a.agreed_amount')->whereBetween('a.agreed_at', [$from, $to])->sum('a.agreed_amount');
        $invoiced = $agreements()->whereBetween('a.invoice_date', [$from->toDateString(), $to->toDateString()])->sum('a.invoiced_amount');
        $payments = Money::toPaise((string) $ledger('payment')->sum('p.amount'));
        $refunds = Money::toPaise((string) $ledger('refund')->sum('p.amount'));
        $waivers = Money::toPaise((string) $ledger('waiver')->sum('p.amount'));
        $outstanding = $agreements()->where('d.status', 'closed_won')->sum('a.outstanding_amount');
        $pendingClosure = $agreements()->whereIn('d.status', Deal::OPEN_STATUSES)->whereNotNull('a.agreed_amount')->sum('a.outstanding_amount');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals' => [
                'potential' => $this->money($potential),
                'agreed' => $this->money($agreed),
                'invoiced' => $this->money($invoiced),
                'received' => Money::fromPaise($payments),
                'refunded' => Money::fromPaise($refunds),
                'collected' => Money::fromPaise($payments - $refunds),
                'waived' => Money::fromPaise($waivers),
                'outstanding' => $this->money($outstanding),
                'agreed_pending_closure' => $this->money($pendingClosure),
            ],
            'by_month' => $this->byMonth($from, $to, $scopeTo),
            'by_team_member' => $this->grouped('d.assigned_to', $from, $to, $scopeTo,
                fn (Builder $q) => $q->leftJoin('users as u', 'u.id', '=', 'd.assigned_to'), 'COALESCE(u.name, "Unassigned")'),
            'by_locality' => $this->grouped('pr.locality_id', $from, $to, $scopeTo,
                fn (Builder $q) => $q->join('properties as pr', 'pr.id', '=', 'd.property_id')->leftJoin('localities as l', 'l.id', '=', 'pr.locality_id'), 'COALESCE(l.name, "—")'),
            'by_transaction_type' => $this->grouped('d.transaction_type', $from, $to, $scopeTo, fn (Builder $q) => $q, 'd.transaction_type'),
        ];
    }

    public function teamDashboard(User $user, Carbon $from, Carbon $to): array
    {
        $leads = fn () => Lead::query()->visibleTo($user);
        $finance = $user->hasPermission('finance.manage') ? null : $user;
        $report = $this->finance(now()->startOfMonth(), now(), $finance);
        $allTime = $this->finance(Carbon::create(2000), now(), $finance);

        $followUps = fn () => FollowUp::query()->where('status', 'pending')
            ->when(! $user->hasPermission('leads.view_all'), fn ($q) => $q->where('assigned_to', $user->id));

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'leads' => [
                'new_in_period' => $leads()->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])->count(),
                'new_status' => $leads()->where('status', 'new')->count(),
                'unassigned' => Lead::query()->whereNull('assigned_to')->whereIn('status', Lead::OPEN_STATUSES)->count(),
                'assigned_to_me' => Lead::query()->where('assigned_to', $user->id)->whereIn('status', Lead::OPEN_STATUSES)->count(),
                'won_in_period' => $leads()->where('status', 'won')->whereBetween('updated_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])->count(),
                'by_status' => $leads()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            ],
            'follow_ups' => [
                'due_today' => $followUps()->whereBetween('due_at', [today(), today()->endOfDay()])->count(),
                'overdue' => $followUps()->where('due_at', '<', today())->count(),
            ],
            'site_visits' => [
                'requested' => SiteVisit::query()->where('status', 'requested')->count(),
                'scheduled_upcoming' => SiteVisit::query()->where('status', 'scheduled')->where('scheduled_at', '>=', now())
                    ->when(! $user->hasPermission('leads.view_all'), fn ($q) => $q->where('assigned_to', $user->id))->count(),
            ],
            'deals' => [
                'in_negotiation' => Deal::query()->visibleTo($user)->whereIn('status', Deal::OPEN_STATUSES)->count(),
                'closed_this_month' => Deal::query()->visibleTo($user)->where('status', 'closed_won')->where('closed_at', '>=', now()->startOfMonth())->count(),
            ],
            'brokerage' => [
                'scope' => $finance ? 'own_deals' : 'all',
                'expected' => $report['totals']['potential'],
                'agreed_this_month' => $report['totals']['agreed'],
                'collected_this_month' => $report['totals']['collected'],
                'outstanding' => $allTime['totals']['outstanding'],
            ],
        ];
    }

    private function byMonth(Carbon $from, Carbon $to, ?User $scopeTo): array
    {
        $collected = DB::table('brokerage_payments as p')
            ->join('deals as d', 'd.id', '=', 'p.deal_id')
            ->whereNull('p.voided_at')->whereNull('d.deleted_at')
            ->whereIn('p.type', ['payment', 'refund'])
            ->whereBetween('p.payment_date', [$from->toDateString(), $to->toDateString()])
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id))
            ->selectRaw("DATE_FORMAT(p.payment_date, '%Y-%m') as month, SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) as total")
            ->groupBy('month')->pluck('total', 'month');

        $agreed = DB::table('brokerage_agreements as a')
            ->join('deals as d', 'd.id', '=', 'a.deal_id')
            ->whereNull('a.deleted_at')->whereNull('d.deleted_at')
            ->where('a.status', '!=', 'cancelled')->whereNotIn('d.status', ['closed_lost', 'cancelled'])
            ->whereNotNull('a.agreed_amount')->whereBetween('a.agreed_at', [$from, $to])
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id))
            ->selectRaw("DATE_FORMAT(a.agreed_at, '%Y-%m') as month, SUM(a.agreed_amount) as total")
            ->groupBy('month')->pluck('total', 'month');

        $rows = [];
        for ($cursor = $from->copy()->startOfMonth(); $cursor->lte($to); $cursor->addMonth()) {
            $key = $cursor->format('Y-m');
            $rows[] = ['month' => $key, 'agreed' => $this->money($agreed[$key] ?? 0), 'collected' => $this->money($collected[$key] ?? 0)];
        }

        return $rows;
    }

    private function grouped(string $groupColumn, Carbon $from, Carbon $to, ?User $scopeTo, callable $joins, string $labelSql): array
    {
        $agreed = $joins(DB::table('brokerage_agreements as a')->join('deals as d', 'd.id', '=', 'a.deal_id'))
            ->whereNull('a.deleted_at')->whereNull('d.deleted_at')
            ->where('a.status', '!=', 'cancelled')->whereNotIn('d.status', ['closed_lost', 'cancelled'])
            ->whereNotNull('a.agreed_amount')->whereBetween('a.agreed_at', [$from, $to])
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id))
            ->selectRaw("{$groupColumn} as k, {$labelSql} as label, SUM(a.agreed_amount) as total")
            ->groupByRaw("{$groupColumn}, label")->get()->keyBy('k');

        $collected = $joins(DB::table('brokerage_payments as p')->join('deals as d', 'd.id', '=', 'p.deal_id'))
            ->whereNull('p.voided_at')->whereNull('d.deleted_at')->whereIn('p.type', ['payment', 'refund'])
            ->whereBetween('p.payment_date', [$from->toDateString(), $to->toDateString()])
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id))
            ->selectRaw("{$groupColumn} as k, {$labelSql} as label, SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE -p.amount END) as total")
            ->groupByRaw("{$groupColumn}, label")->get()->keyBy('k');

        $outstanding = $joins(DB::table('brokerage_agreements as a')->join('deals as d', 'd.id', '=', 'a.deal_id'))
            ->whereNull('a.deleted_at')->whereNull('d.deleted_at')
            ->where('a.status', '!=', 'cancelled')->where('d.status', 'closed_won')
            ->when($scopeTo, fn (Builder $q) => $q->where('d.assigned_to', $scopeTo->id))
            ->selectRaw("{$groupColumn} as k, {$labelSql} as label, SUM(a.outstanding_amount) as total")
            ->groupByRaw("{$groupColumn}, label")->get()->keyBy('k');

        $keys = collect([$agreed, $collected, $outstanding])->flatMap(fn ($c) => $c->keys())->unique();

        return $keys->map(function ($k) use ($agreed, $collected, $outstanding) {
            $label = ($agreed[$k] ?? $collected[$k] ?? $outstanding[$k])->label;

            return [
                'key' => $k,
                'label' => $label,
                'agreed' => $this->money($agreed[$k]->total ?? 0),
                'collected' => $this->money($collected[$k]->total ?? 0),
                'outstanding' => $this->money($outstanding[$k]->total ?? 0),
            ];
        })->sortByDesc(fn ($r) => Money::toPaise($r['agreed']))->values()->all();
    }

    private function money(mixed $value): string
    {
        return Money::fromPaise(Money::toPaise((string) ($value ?? '0')));
    }
}
