<?php

namespace App\Http\Requests;

use App\Models\Lead;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Team-entered or team-edited lead details. */
class LeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'min:2', 'max:120'],
            'phone' => [$required, 'string', 'regex:/^\+?[0-9\s\-()]{10,20}$/'],
            'email' => ['nullable', 'email', 'max:160'],
            'interest' => [$required, Rule::in(Lead::INTERESTS)],
            'source' => [$creating ? 'required' : 'sometimes', Rule::in(Lead::SOURCES)],
            'property_id' => ['nullable', 'integer', 'exists:properties,id'],
            'budget_min' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'budget_max' => ['nullable', 'numeric', 'min:0', 'max:999999999999', 'gte:budget_min'],
            'preferred_locality_id' => ['nullable', 'integer', 'exists:localities,id'],
            'preferred_bhk' => ['nullable', 'integer', 'between:1,10'],
            'message' => ['nullable', 'string', 'max:2000'],
            'requirements' => ['nullable', 'string', 'max:5000'],
            'consent_marketing' => ['sometimes', 'boolean'],
            'assigned_to' => $creating ? ['nullable', 'integer', 'exists:users,id'] : ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return ['assigned_to.prohibited' => 'Use the assign action to change the assignee.'];
    }
}
