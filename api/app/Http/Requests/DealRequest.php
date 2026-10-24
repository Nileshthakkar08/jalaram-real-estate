<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DealRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'lead_id' => $creating ? ['required', 'integer', 'exists:leads,id'] : ['prohibited'],
            'property_id' => $creating ? ['required', 'integer', 'exists:properties,id'] : ['prohibited'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['sometimes', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:20'],
            'final_price' => ['nullable', 'numeric', 'min:1', 'max:9999999999'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'lease_start_date' => ['nullable', 'date'],
            'lease_term_months' => ['nullable', 'integer', 'between:1,240'],
            'negotiation_notes' => ['nullable', 'string', 'max:5000'],
            'agreement_date' => ['nullable', 'date'],
        ];
    }
}
