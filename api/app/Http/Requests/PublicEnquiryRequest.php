<?php

namespace App\Http\Requests;

use App\Models\Lead;
use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Public enquiry form. Site-visit requests extend this with date/slot rules. */
class PublicEnquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim(strip_tags($this->name)) : $this->name,
            'message' => is_string($this->message) ? trim(strip_tags($this->message)) : $this->message,
            'email' => is_string($this->email) && trim($this->email) === '' ? null : $this->email,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'phone' => ['required', 'string', 'regex:/^\+?[0-9\s\-()]{10,20}$/'],
            'email' => ['nullable', 'email:rfc', 'max:160'],
            'message' => ['nullable', 'string', 'max:2000'],
            'interest' => ['required', Rule::in(Lead::INTERESTS)],
            'property_id' => ['nullable', 'integer'],
            'budget_min' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'budget_max' => ['nullable', 'numeric', 'min:0', 'max:999999999999', 'gte:budget_min'],
            'preferred_locality_id' => ['nullable', 'integer', 'exists:localities,id'],
            'preferred_bhk' => ['nullable', 'integer', 'between:1,10'],
            'source_page' => ['nullable', 'string', 'max:255'],
            'utm_source' => ['nullable', 'string', 'max:100'],
            'utm_medium' => ['nullable', 'string', 'max:100'],
            'utm_campaign' => ['nullable', 'string', 'max:100'],
            'consent_contact' => ['accepted'],
            'consent_marketing' => ['nullable', 'boolean'],
            // Honeypot: real users never see or fill this field.
            'website' => ['nullable', 'max:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.regex' => 'Enter a valid phone number with at least 10 digits.',
            'consent_contact.accepted' => 'Please agree to be contacted about your enquiry.',
            'website.max' => 'Your submission could not be accepted.',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if (strlen(Lead::normalizePhone((string) $this->phone)) < 10) {
                $validator->errors()->add('phone', 'Enter a valid phone number with at least 10 digits.');
            }
            if ($this->property_id && ! $this->publicProperty()) {
                $validator->errors()->add('property_id', 'This property is no longer available for enquiries.');
            }
        }];
    }

    public function publicProperty(): ?Property
    {
        return once(fn () => $this->property_id
            ? Property::query()->publiclyVisible()->find($this->property_id)
            : null);
    }

    /** Attributes safe to store on the lead. */
    public function leadData(): array
    {
        $data = $this->safe()->only([
            'name', 'phone', 'email', 'message', 'interest', 'budget_min', 'budget_max', 'preferred_locality_id',
            'preferred_bhk', 'source_page', 'utm_source', 'utm_medium', 'utm_campaign',
        ]);
        $property = $this->publicProperty();

        // Server-derived values take precedence over anything the client sent.
        return array_merge($data, [
            'property_id' => $property?->id,
            'interest' => $property ? ($property->listing_purpose === 'sale' ? 'buy' : 'rent') : $data['interest'],
            'source' => 'website',
            'consent_contact' => true,
            'consent_marketing' => $this->boolean('consent_marketing'),
            'ip_address' => $this->ip(),
        ]);
    }
}
