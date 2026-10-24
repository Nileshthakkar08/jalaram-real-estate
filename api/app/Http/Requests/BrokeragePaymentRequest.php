<?php

namespace App\Http\Requests;

use App\Models\BrokeragePayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BrokeragePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(BrokeragePayment::TYPES)],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999', 'decimal:0,2'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'method' => ['nullable', Rule::requiredIf($this->input('type') === 'payment'), Rule::in(BrokeragePayment::METHODS)],
            'reference_number' => ['nullable', 'string', 'max:80'],
            'receipt_number' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
