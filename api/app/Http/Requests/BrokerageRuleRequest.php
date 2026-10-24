<?php

namespace App\Http\Requests;

use App\Models\BrokerageRule;
use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BrokerageRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $method = $this->input('method');

        return [
            'name' => ['required', 'string', 'max:120'],
            'transaction_type' => ['required', Rule::in(['sale', 'rent'])],
            'method' => ['required', Rule::in(BrokerageRule::METHODS)],
            'fixed_amount' => [Rule::requiredIf($method === 'fixed'), 'nullable', 'numeric', 'min:0', 'max:9999999999'],
            'percentage' => [Rule::requiredIf($method === 'percentage'), 'nullable', 'numeric', 'gt:0', 'max:100', 'decimal:0,4'],
            'percentage_basis' => [Rule::requiredIf($method === 'percentage'), 'nullable', Rule::in(BrokerageRule::BASES)],
            'min_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'max_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999', 'gte:min_amount'],
            'payer' => ['required', Rule::in(BrokerageRule::PAYERS)],
            'split_shares' => [Rule::requiredIf($this->input('payer') === 'split'), 'nullable', 'array'],
            'split_shares.*' => ['numeric', 'gt:0', 'max:100'],
            'property_type' => ['nullable', Rule::in(Property::TYPES)],
            'locality_id' => ['nullable', 'integer', 'exists:localities,id'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'is_active' => ['boolean'],
            'priority' => ['nullable', 'integer', 'between:-100,100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'change_reason' => [$this->isMethod('put') ? 'required' : 'nullable', 'string', 'max:500'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $type = $this->input('transaction_type');
            $payer = $this->input('payer');
            $parties = BrokerageRule::PARTIES[$type] ?? [];

            if ($payer === 'split') {
                $shares = (array) $this->input('split_shares', []);
                foreach (array_keys($shares) as $party) {
                    if (! in_array($party, $parties, true)) {
                        $validator->errors()->add('split_shares', "For {$type} transactions the split parties must be: ".implode(', ', $parties).'.');
                    }
                }
                if (abs(array_sum(array_map('floatval', $shares)) - 100) > 0.0001) {
                    $validator->errors()->add('split_shares', 'Split shares must add up to 100%.');
                }
            } elseif ($payer && $type === 'rent' && in_array($payer, ['buyer', 'seller'], true)) {
                $validator->errors()->add('payer', 'Rental brokerage is paid by the owner or the tenant.');
            } elseif ($payer && $type === 'sale' && $payer === 'tenant') {
                $validator->errors()->add('payer', 'Sale brokerage is paid by the seller (owner) or the buyer.');
            }

            if ($this->input('method') === 'percentage') {
                $basis = $this->input('percentage_basis');
                if ($type === 'rent' && $basis === 'final_sale_price') {
                    $validator->errors()->add('percentage_basis', 'Rental rules use monthly rent, annual rent or asking price as the basis.');
                }
                if ($type === 'sale' && in_array($basis, ['monthly_rent', 'annual_rent'], true)) {
                    $validator->errors()->add('percentage_basis', 'Sale rules use the final sale price or asking price as the basis.');
                }
            }
        }];
    }

    public function ruleData(): array
    {
        $data = $this->safe()->except(['change_reason']);
        $method = $data['method'];
        if ($method !== 'fixed') {
            $data['fixed_amount'] = null;
        }
        if ($method !== 'percentage') {
            $data['percentage'] = null;
            $data['percentage_basis'] = null;
        }
        if ($data['payer'] !== 'split') {
            $data['split_shares'] = null;
        }
        $data['is_active'] = $this->boolean('is_active', true);
        $data['priority'] = (int) ($data['priority'] ?? 0);

        return $data;
    }
}
