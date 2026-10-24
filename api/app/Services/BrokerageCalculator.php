<?php

namespace App\Services;

use App\Models\BrokerageRule;
use App\Support\Money;
use Illuminate\Support\Carbon;

/**
 * Produces brokerage *estimates* from admin-configured rules. Estimates are guidance only:
 * the amounts each party actually agrees are recorded separately on brokerage agreements.
 */
class BrokerageCalculator
{
    public function findRule(string $transactionType, ?string $propertyType, ?int $localityId, ?Carbon $on = null): ?BrokerageRule
    {
        $on = ($on ?? now())->toDateString();

        return BrokerageRule::query()
            ->where('transaction_type', $transactionType)
            ->where('is_active', true)
            ->whereDate('effective_from', '<=', $on)
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $on))
            ->where(fn ($q) => $q->whereNull('property_type')->orWhere('property_type', $propertyType))
            ->where(fn ($q) => $q->whereNull('locality_id')->orWhere('locality_id', $localityId))
            // Most specific first: locality + type, then locality, then type, then general.
            ->orderByRaw('(locality_id IS NOT NULL) * 2 + (property_type IS NOT NULL) DESC')
            ->orderByDesc('priority')
            ->orderByDesc('effective_from')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array{
     *   rule_id: int|null, rule_name: string|null, method: string|null, basis: string|null, basis_amount: string|null,
     *   percentage: string|null, fixed_amount: string|null, total: string|null, shares: array<string,string>,
     *   explanation: string
     * }
     */
    public function estimate(?BrokerageRule $rule, string $transactionType, string|float $askingPrice, string|float|null $finalPrice): array
    {
        $result = [
            'rule_id' => $rule?->id,
            'rule_name' => $rule?->name,
            'method' => $rule?->method,
            'basis' => null,
            'basis_amount' => null,
            'percentage' => null,
            'fixed_amount' => null,
            'total' => null,
            'shares' => [],
            'explanation' => '',
        ];

        if (! $rule) {
            $result['explanation'] = 'No active brokerage rule matches this transaction. Enter the agreed brokerage manually.';

            return $result;
        }

        if ($rule->method === 'negotiated') {
            $result['explanation'] = "Rule \"{$rule->name}\": brokerage is negotiated per deal. Enter the agreed amount for each party.";

            return $result;
        }

        $asking = Money::toPaise($askingPrice);
        $final = $finalPrice !== null && $finalPrice !== '' ? Money::toPaise($finalPrice) : null;

        if ($rule->method === 'fixed') {
            $total = Money::toPaise($rule->fixed_amount);
            $result['fixed_amount'] = Money::fromPaise($total);
            $explanation = 'Fixed brokerage of '.Money::format($total);
        } else {
            [$basisPaise, $basisLabel, $usedAsking] = $this->basis($rule->percentage_basis, $asking, $final);
            $total = Money::percentOf($basisPaise, (string) $rule->percentage);
            $result['basis'] = $rule->percentage_basis;
            $result['basis_amount'] = Money::fromPaise($basisPaise);
            $result['percentage'] = (string) $rule->percentage;
            $explanation = rtrim(rtrim((string) $rule->percentage, '0'), '.').'% of '.$basisLabel.' ('.Money::format($basisPaise).')';
            if ($usedAsking) {
                $explanation .= ' — final price not yet recorded, so the asking price is used';
            }
        }

        if ($rule->min_amount !== null && $total < Money::toPaise($rule->min_amount)) {
            $total = Money::toPaise($rule->min_amount);
            $explanation .= ', raised to the rule minimum of '.Money::format($total);
        }
        if ($rule->max_amount !== null && $total > Money::toPaise($rule->max_amount)) {
            $total = Money::toPaise($rule->max_amount);
            $explanation .= ', capped at the rule maximum of '.Money::format($total);
        }

        $shares = Money::split($total, $rule->shares());
        $result['total'] = Money::fromPaise($total);
        $result['shares'] = array_map(fn (int $p) => Money::fromPaise($p), $shares);
        $result['explanation'] = "Rule \"{$rule->name}\": {$explanation}. Payable by "
            .collect($rule->shares())->map(fn ($pct, $party) => "{$party} ".rtrim(rtrim(number_format($pct, 2), '0'), '.').'%')->implode(', ')
            .'.';

        return $result;
    }

    /** @return array{0:int,1:string,2:bool} basis paise, label, whether asking price was substituted */
    private function basis(?string $basis, int $asking, ?int $final): array
    {
        return match ($basis) {
            'monthly_rent' => [$final ?? $asking, 'monthly rent', $final === null],
            'annual_rent' => [($final ?? $asking) * 12, 'annual rent (12 × monthly rent)', $final === null],
            'final_sale_price' => [$final ?? $asking, 'final sale price', $final === null],
            'asking_price' => [$asking, 'asking price', false],
            default => [$final ?? $asking, 'transaction value', $final === null],
        };
    }
}
