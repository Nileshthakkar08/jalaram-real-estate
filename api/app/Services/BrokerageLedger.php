<?php

namespace App\Services;

use App\Exceptions\InvalidTransitionException;
use App\Models\BrokerageAgreement;
use App\Models\BrokeragePayment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Append-only ledger of money against each brokerage agreement. Entries are voided, never
 * deleted, and agreement balances/statuses are always recomputed from the ledger.
 */
class BrokerageLedger
{
    public function __construct(private AuditLogger $audit) {}

    public function record(BrokerageAgreement $agreement, User $actor, array $data): BrokeragePayment
    {
        return DB::transaction(function () use ($agreement, $actor, $data) {
            /** @var BrokerageAgreement $agreement */
            $agreement = BrokerageAgreement::query()->lockForUpdate()->findOrFail($agreement->id);

            if ($agreement->status === 'cancelled') {
                throw new InvalidTransitionException('This brokerage agreement is cancelled.');
            }
            if ($agreement->agreed_amount === null) {
                throw new InvalidTransitionException('Record the agreed brokerage before entering payments.');
            }

            $amount = Money::toPaise($data['amount']);
            if ($amount <= 0) {
                throw ValidationException::withMessages(['amount' => ['Amount must be greater than zero.']]);
            }

            $totals = $this->totals($agreement);
            $type = $data['type'];

            if ($type === 'payment' && $amount > $totals['outstanding']) {
                throw ValidationException::withMessages(['amount' => [
                    'Payment exceeds the outstanding balance of '.Money::format($totals['outstanding']).'. Adjust the agreed amount first if more was agreed.',
                ]]);
            }
            if ($type === 'waiver' && $amount > $totals['outstanding']) {
                throw ValidationException::withMessages(['amount' => ['Waiver exceeds the outstanding balance of '.Money::format($totals['outstanding']).'.']]);
            }
            if ($type === 'refund' && $amount > $totals['net_received']) {
                throw ValidationException::withMessages(['amount' => ['Refund exceeds the net amount received ('.Money::format($totals['net_received']).').']]);
            }
            if (in_array($type, ['refund', 'waiver'], true) && blank($data['notes'] ?? null)) {
                throw ValidationException::withMessages(['notes' => ["Explain the reason for this {$type}."]]);
            }

            $payment = $agreement->payments()->create([
                'deal_id' => $agreement->deal_id,
                'type' => $type,
                'amount' => Money::fromPaise($amount),
                'payment_date' => $data['payment_date'],
                'method' => $type === 'waiver' ? null : ($data['method'] ?? null),
                'reference_number' => $data['reference_number'] ?? null,
                'receipt_number' => $data['receipt_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $actor->id,
            ]);

            $this->recalculate($agreement);
            $this->audit->log("brokerage.{$type}_recorded", $payment, [], $payment->only([
                'brokerage_agreement_id', 'deal_id', 'type', 'amount', 'payment_date', 'method', 'reference_number', 'receipt_number',
            ]), $data['notes'] ?? null);

            return $payment;
        });
    }

    public function void(BrokeragePayment $payment, User $actor, string $reason): BrokeragePayment
    {
        return DB::transaction(function () use ($payment, $actor, $reason) {
            $agreement = BrokerageAgreement::query()->lockForUpdate()->findOrFail($payment->brokerage_agreement_id);
            $payment->refresh();

            if ($payment->voided_at) {
                throw new InvalidTransitionException('This entry is already void.');
            }

            $payment->forceFill(['voided_at' => now(), 'voided_by' => $actor->id, 'void_reason' => $reason])->save();

            $totals = $this->totals($agreement);
            if ($totals['net_received'] < 0) {
                throw ValidationException::withMessages(['reason' => ['Void the related refund first — refunds would exceed payments.']]);
            }

            $this->recalculate($agreement);
            $this->audit->log('brokerage.entry_voided', $payment, ['voided_at' => null], ['voided_at' => now()->toDateTimeString()], $reason);

            return $payment;
        });
    }

    /** Recompute cached totals and status from the ledger. Call inside a transaction. */
    public function recalculate(BrokerageAgreement $agreement): BrokerageAgreement
    {
        $t = $this->totals($agreement);

        $status = match (true) {
            $agreement->status === 'cancelled' => 'cancelled',
            $agreement->agreed_amount === null => 'estimated',
            $t['refunded'] > 0 && $t['received'] > 0 && $t['net_received'] <= 0 => 'refunded',
            $t['waived'] > 0 && $t['outstanding'] === 0 && $t['net_received'] === 0 => 'waived',
            $t['outstanding'] === 0 => 'paid',
            $t['net_received'] > 0 => 'partially_paid',
            Money::toPaise($agreement->invoiced_amount) > 0
                || ($agreement->due_date && $agreement->due_date->lte(today())) => 'due',
            default => 'agreed',
        };

        $agreement->forceFill([
            'amount_received' => Money::fromPaise($t['received']),
            'amount_refunded' => Money::fromPaise($t['refunded']),
            'amount_waived' => Money::fromPaise($t['waived']),
            'outstanding_amount' => Money::fromPaise($agreement->status === 'cancelled' ? 0 : $t['outstanding']),
            'status' => $status,
        ])->save();

        return $agreement;
    }

    /** @return array{received:int, refunded:int, waived:int, net_received:int, outstanding:int} in paise */
    public function totals(BrokerageAgreement $agreement): array
    {
        $sums = BrokeragePayment::query()
            ->where('brokerage_agreement_id', $agreement->id)
            ->whereNull('voided_at')
            ->selectRaw('type, SUM(amount) as total')
            ->groupBy('type')
            ->pluck('total', 'type');

        $received = Money::toPaise($sums['payment'] ?? '0');
        $refunded = Money::toPaise($sums['refund'] ?? '0');
        $waived = Money::toPaise($sums['waiver'] ?? '0');
        $net = $received - $refunded;
        $agreed = Money::toPaise($agreement->agreed_amount ?? '0');

        return [
            'received' => $received,
            'refunded' => $refunded,
            'waived' => $waived,
            'net_received' => $net,
            'outstanding' => max(0, $agreed - $net - $waived),
        ];
    }
}
