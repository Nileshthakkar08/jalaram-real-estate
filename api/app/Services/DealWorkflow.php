<?php

namespace App\Services;

use App\Exceptions\InvalidTransitionException;
use App\Models\BrokerageAgreement;
use App\Models\BrokerageRule;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Deal lifecycle and brokerage agreements.
 *
 * negotiation → agreement_pending → closed_won, with closed_lost / cancelled from any open state
 * and reopening of lost/cancelled deals. Closing a deal never marks brokerage as paid — money is
 * only ever recorded through BrokerageLedger.
 */
class DealWorkflow
{
    public const TRANSITIONS = [
        'negotiation' => ['agreement_pending', 'closed_lost', 'cancelled'],
        'agreement_pending' => ['negotiation', 'closed_won', 'closed_lost', 'cancelled'],
        'closed_won' => [],
        'closed_lost' => ['negotiation'],
        'cancelled' => ['negotiation'],
    ];

    public function __construct(
        private AuditLogger $audit,
        private BrokerageCalculator $calculator,
        private BrokerageLedger $ledger,
        private LeadService $leads,
    ) {}

    public function create(Lead $lead, Property $property, User $actor, array $data): Deal
    {
        if (! $lead->isOpen()) {
            throw new InvalidTransitionException("A deal cannot be opened on a {$lead->status} lead.");
        }
        if (in_array($property->status, ['draft', 'rejected', 'closed'], true)) {
            throw new InvalidTransitionException("A deal cannot be opened on a {$property->status} listing.");
        }

        return DB::transaction(function () use ($lead, $property, $actor, $data) {
            $rule = $this->calculator->findRule($property->listing_purpose, $property->property_type, $property->locality_id);
            $estimate = $this->calculator->estimate($rule, $property->listing_purpose, $property->price, $data['final_price'] ?? null);

            $deal = Deal::create([
                'property_id' => $property->id,
                'lead_id' => $lead->id,
                'owner_id' => $property->owner_id,
                'assigned_to' => $data['assigned_to'] ?? $lead->assigned_to ?? $actor->id,
                'created_by' => $actor->id,
                'transaction_type' => $property->listing_purpose,
                'status' => 'negotiation',
                'customer_name' => $data['customer_name'] ?? $lead->name,
                'customer_phone' => $data['customer_phone'] ?? $lead->phone,
                'asking_price' => $property->price,
                'final_price' => $data['final_price'] ?? null,
                'security_deposit' => $data['security_deposit'] ?? ($property->listing_purpose === 'rent' ? $property->security_deposit : null),
                'lease_start_date' => $data['lease_start_date'] ?? null,
                'lease_term_months' => $data['lease_term_months'] ?? null,
                'negotiation_notes' => $data['negotiation_notes'] ?? null,
                'brokerage_rule_id' => $rule?->id,
                'brokerage_basis' => $estimate,
                'estimated_brokerage' => $estimate['total'],
            ]);

            $this->syncEstimatedAgreements($deal, $estimate, $lead, $property);

            $this->leads->advanceTo($lead, 'negotiation', $actor, "Deal {$deal->reference_code} opened.");
            $lead->activities()->create([
                'user_id' => $actor->id,
                'type' => 'deal',
                'body' => "Deal {$deal->reference_code} opened for {$property->title}.",
                'meta' => ['deal_id' => $deal->id],
            ]);
            $this->audit->log('deal.created', $deal, [], $deal->only([
                'property_id', 'lead_id', 'transaction_type', 'asking_price', 'final_price', 'estimated_brokerage', 'brokerage_rule_id',
            ]));

            return $deal;
        });
    }

    /** Update negotiated terms. A changed final price refreshes estimates but never touches agreed amounts. */
    public function updateTerms(Deal $deal, User $actor, array $data): Deal
    {
        if (! in_array($deal->status, Deal::OPEN_STATUSES, true) && array_key_exists('final_price', $data)
            && (string) $data['final_price'] !== (string) $deal->final_price) {
            throw new InvalidTransitionException('The final price of a closed deal cannot be changed.');
        }

        return DB::transaction(function () use ($deal, $actor, $data) {
            $original = $deal->getAttributes();
            $deal->fill($data);
            $priceChanged = $deal->isDirty('final_price');

            if ($priceChanged) {
                $rule = $deal->brokerage_rule_id ? BrokerageRule::withTrashed()->find($deal->brokerage_rule_id) : null;
                $estimate = $this->calculator->estimate($rule, $deal->transaction_type, $deal->asking_price, $deal->final_price);
                $deal->brokerage_basis = $estimate;
                $deal->estimated_brokerage = $estimate['total'];
            }
            $deal->save();

            if ($priceChanged) {
                $this->syncEstimatedAgreements($deal, $deal->brokerage_basis);
                if ($deal->lead) {
                    $deal->lead->activities()->create([
                        'user_id' => $actor->id,
                        'type' => 'negotiation',
                        'body' => "Deal {$deal->reference_code}: final price set to ".Money::format(Money::toPaise($deal->final_price)).'.',
                    ]);
                }
            }

            $this->audit->logChanges('deal.updated', $deal, $original);

            return $deal;
        });
    }

    /** Re-run rule matching (e.g. after an admin changes rules). Agreed amounts are untouched. */
    public function reapplyRule(Deal $deal): Deal
    {
        return DB::transaction(function () use ($deal) {
            $property = $deal->property;
            $rule = $this->calculator->findRule($deal->transaction_type, $property->property_type, $property->locality_id);
            $estimate = $this->calculator->estimate($rule, $deal->transaction_type, $deal->asking_price, $deal->final_price);
            $old = $deal->only(['brokerage_rule_id', 'estimated_brokerage']);
            $deal->forceFill(['brokerage_rule_id' => $rule?->id, 'brokerage_basis' => $estimate, 'estimated_brokerage' => $estimate['total']])->save();
            $this->syncEstimatedAgreements($deal, $estimate);
            $this->audit->log('deal.rule_reapplied', $deal, $old, $deal->only(['brokerage_rule_id', 'estimated_brokerage']));

            return $deal;
        });
    }

    public function changeStatus(Deal $deal, string $status, User $actor, ?string $reason = null): Deal
    {
        if (! in_array($status, self::TRANSITIONS[$deal->status] ?? [], true)) {
            throw new InvalidTransitionException("Cannot move a deal from {$deal->status} to {$status}.");
        }
        if (in_array($status, ['closed_lost', 'cancelled'], true) && blank($reason)) {
            throw ValidationException::withMessages(['reason' => ['Give a reason for closing this deal.']]);
        }
        if ($status === 'closed_won') {
            $this->assertCanCloseWon($deal);
        }

        return DB::transaction(function () use ($deal, $status, $actor, $reason) {
            $from = $deal->status;
            $deal->forceFill([
                'status' => $status,
                'closed_reason' => in_array($status, ['closed_lost', 'cancelled'], true) ? $reason : $deal->closed_reason,
                'closed_at' => in_array($status, ['closed_won', 'closed_lost', 'cancelled'], true) ? now() : null,
                'agreement_date' => $status === 'agreement_pending' ? ($deal->agreement_date ?? today()) : $deal->agreement_date,
            ])->save();

            $lead = $deal->lead;

            if ($status === 'closed_won') {
                $property = $deal->property;
                if ($property && $property->status !== 'closed') {
                    $old = $property->status;
                    $property->forceFill(['status' => 'closed'])->save();
                    $this->audit->log('property.closed_by_deal', $property, ['status' => $old], ['status' => 'closed'], "Deal {$deal->reference_code} closed won.");
                }
                // Due dates/invoices now apply; refresh statuses (nothing is marked paid here).
                $deal->agreements()->where('status', '!=', 'cancelled')->get()->each(fn ($a) => $this->ledger->recalculate($a));
                if ($lead && $lead->status !== 'won') {
                    $this->leads->markWon($lead, $actor, "Deal {$deal->reference_code} closed won.");
                }
            }

            if (in_array($status, ['closed_lost', 'cancelled'], true)) {
                // Brokerage is not earned. Agreements with no money received are cancelled; any token
                // received stays visible so it can be refunded through the ledger.
                foreach ($deal->agreements()->where('status', '!=', 'cancelled')->get() as $agreement) {
                    if ($this->ledger->totals($agreement)['net_received'] === 0) {
                        $agreement->forceFill(['status' => 'cancelled', 'cancelled_reason' => "Deal {$status}: {$reason}", 'outstanding_amount' => '0.00'])->save();
                    }
                }
            }

            $lead?->activities()->create([
                'user_id' => $actor->id,
                'type' => 'deal',
                'body' => "Deal {$deal->reference_code} moved from ".str_replace('_', ' ', $from).' to '.str_replace('_', ' ', $status).'.'
                    .($reason ? "\n{$reason}" : ''),
                'meta' => ['deal_id' => $deal->id, 'from' => $from, 'to' => $status],
            ]);
            $this->audit->log('deal.status_changed', $deal, ['status' => $from], ['status' => $status], $reason);

            return $deal;
        });
    }

    public function addAgreement(Deal $deal, User $actor, array $data): BrokerageAgreement
    {
        if (in_array($deal->status, ['closed_lost', 'cancelled'], true)) {
            throw new InvalidTransitionException('Brokerage cannot be agreed on a lost or cancelled deal.');
        }
        $this->assertPartyAllowed($deal, $data['party']);

        return DB::transaction(function () use ($deal, $actor, $data) {
            Deal::query()->whereKey($deal->id)->lockForUpdate()->first();

            $agreement = $deal->agreements()->where('party', $data['party'])->where('status', '!=', 'cancelled')->first();
            if ($agreement && $agreement->agreed_amount !== null) {
                throw ValidationException::withMessages(['party' => ['Brokerage for this party is already agreed. Edit the existing agreement instead.']]);
            }

            $agreement ??= $deal->agreements()->make(['party' => $data['party'], 'status' => 'estimated']);
            $agreement->fill([
                'party_name' => $data['party_name'] ?? $agreement->party_name ?? $this->defaultPartyName($deal, $data['party']),
                'party_phone' => $data['party_phone'] ?? $agreement->party_phone,
                'due_date' => $data['due_date'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            if (isset($data['agreed_amount']) && $data['agreed_amount'] !== '') {
                $this->applyAgreedAmount($agreement, $actor, (string) $data['agreed_amount'], $data['override_reason'] ?? null);
            }
            $agreement->save();
            $this->ledger->recalculate($agreement);

            $this->audit->log('brokerage.agreement_created', $agreement, [], $agreement->only([
                'deal_id', 'party', 'estimated_amount', 'agreed_amount', 'is_override', 'due_date',
            ]), $agreement->override_reason);

            return $agreement;
        });
    }

    /** Update an agreement. Changing the agreed amount after it is set always requires a reason. */
    public function updateAgreement(BrokerageAgreement $agreement, User $actor, array $data): BrokerageAgreement
    {
        if ($agreement->status === 'cancelled') {
            throw new InvalidTransitionException('This agreement is cancelled.');
        }

        return DB::transaction(function () use ($agreement, $actor, $data) {
            $agreement = BrokerageAgreement::query()->lockForUpdate()->findOrFail($agreement->id);
            $original = $agreement->getAttributes();
            $reason = $data['reason'] ?? null;

            if (($data['cancel'] ?? false) === true) {
                if (blank($reason)) {
                    throw ValidationException::withMessages(['reason' => ['Give a reason for cancelling this brokerage agreement.']]);
                }
                if ($this->ledger->totals($agreement)['net_received'] > 0) {
                    throw ValidationException::withMessages(['cancel' => ['Money has been received on this agreement. Record a refund or waiver instead.']]);
                }
                $agreement->forceFill(['status' => 'cancelled', 'cancelled_reason' => $reason, 'outstanding_amount' => '0.00'])->save();
                $this->audit->log('brokerage.agreement_cancelled', $agreement, ['status' => $original['status']], ['status' => 'cancelled'], $reason);

                return $agreement;
            }

            if (array_key_exists('agreed_amount', $data) && $data['agreed_amount'] !== null) {
                $new = Money::toPaise((string) $data['agreed_amount']);
                $current = $agreement->agreed_amount === null ? null : Money::toPaise($agreement->agreed_amount);
                if ($current !== $new) {
                    if ($current !== null && blank($reason)) {
                        throw ValidationException::withMessages(['reason' => ['Give a reason for changing an agreed brokerage amount.']]);
                    }
                    $netReceived = $this->ledger->totals($agreement)['net_received'];
                    if ($new < $netReceived) {
                        throw ValidationException::withMessages(['agreed_amount' => ['The agreed amount cannot be below what has already been received ('.Money::format($netReceived).'). Record a refund first.']]);
                    }
                    $this->applyAgreedAmount($agreement, $actor, (string) $data['agreed_amount'], $reason ?? ($data['override_reason'] ?? null));
                }
            }

            foreach (['party_name', 'party_phone', 'due_date', 'invoice_number', 'invoice_date', 'invoiced_amount', 'notes'] as $field) {
                if (array_key_exists($field, $data)) {
                    $agreement->{$field} = $data[$field];
                }
            }
            if ($agreement->agreed_amount !== null && Money::toPaise($agreement->invoiced_amount ?? '0') > Money::toPaise($agreement->agreed_amount)) {
                throw ValidationException::withMessages(['invoiced_amount' => ['The invoiced amount cannot exceed the agreed brokerage.']]);
            }

            $agreement->save();
            $this->ledger->recalculate($agreement);
            $this->audit->logChanges('brokerage.agreement_updated', $agreement, $original, $reason);

            return $agreement;
        });
    }

    private function applyAgreedAmount(BrokerageAgreement $agreement, User $actor, string $amount, ?string $reason): void
    {
        $agreed = Money::toPaise($amount);
        if ($agreed < 0) {
            throw ValidationException::withMessages(['agreed_amount' => ['The agreed amount cannot be negative.']]);
        }
        $estimate = $agreement->estimated_amount !== null ? Money::toPaise($agreement->estimated_amount) : null;
        $isOverride = $estimate !== null && $estimate !== $agreed;

        if ($isOverride && blank($reason)) {
            throw ValidationException::withMessages(['override_reason' => [
                'The agreed amount differs from the rule estimate of '.Money::format($estimate).'. Give a reason for the override.',
            ]]);
        }

        $agreement->forceFill([
            'agreed_amount' => Money::fromPaise($agreed),
            'is_override' => $isOverride,
            'override_reason' => $reason ?: null,
            'agreed_at' => now(),
            'agreed_by' => $actor->id,
        ]);
    }

    /** Create/update `estimated` agreements to match the rule's per-party shares. Agreed amounts are never changed. */
    private function syncEstimatedAgreements(Deal $deal, ?array $estimate, ?Lead $lead = null, ?Property $property = null): void
    {
        foreach ($estimate['shares'] ?? [] as $party => $amount) {
            $agreement = $deal->agreements()->where('party', $party)->where('status', '!=', 'cancelled')->first();
            if ($agreement) {
                $agreement->forceFill(['estimated_amount' => $amount])->save();
                $this->ledger->recalculate($agreement);

                continue;
            }
            $deal->agreements()->create([
                'party' => $party,
                'party_name' => $this->defaultPartyName($deal, $party),
                'party_phone' => in_array($party, ['owner', 'seller'], true)
                    ? ($property ?? $deal->property)?->coordinationContact()['phone']
                    : ($lead ?? $deal->lead)?->phone,
                'estimated_amount' => $amount,
                'status' => 'estimated',
            ]);
        }
    }

    private function defaultPartyName(Deal $deal, string $party): ?string
    {
        return in_array($party, ['owner', 'seller'], true)
            ? $deal->property?->coordinationContact()['name']
            : $deal->customer_name;
    }

    private function assertPartyAllowed(Deal $deal, string $party): void
    {
        if (! in_array($party, BrokerageRule::PARTIES[$deal->transaction_type], true)) {
            throw ValidationException::withMessages(['party' => [
                "For a {$deal->transaction_type} deal the responsible party must be one of: ".implode(', ', BrokerageRule::PARTIES[$deal->transaction_type]).'.',
            ]]);
        }
    }

    private function assertCanCloseWon(Deal $deal): void
    {
        $errors = [];
        if ($deal->final_price === null) {
            $errors['final_price'] = ['Record the final '.($deal->transaction_type === 'rent' ? 'monthly rent' : 'sale price').' before closing the deal.'];
        }
        $agreed = $deal->agreements()->where('status', '!=', 'cancelled')->whereNotNull('agreed_amount')->count();
        if ($agreed === 0) {
            $errors['agreements'] = ['Record the agreed brokerage for at least one responsible party before closing the deal.'];
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }
}
