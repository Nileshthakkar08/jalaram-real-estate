<?php

namespace App\Http\Requests;

use App\Models\BrokerageAgreement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BrokerageAgreementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'party' => $creating ? ['required', Rule::in(BrokerageAgreement::PARTIES)] : ['prohibited'],
            'party_name' => ['nullable', 'string', 'max:120'],
            'party_phone' => ['nullable', 'string', 'max:20'],
            'agreed_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'override_reason' => ['nullable', 'string', 'max:1000'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'due_date' => ['nullable', 'date'],
            'invoice_number' => ['nullable', 'string', 'max:60'],
            'invoice_date' => ['nullable', 'date', 'required_with:invoice_number'],
            'invoiced_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'cancel' => ['sometimes', 'boolean'],
        ];
    }
}
