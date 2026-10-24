<?php

namespace App\Http\Requests;

use App\Models\SiteVisit;
use Illuminate\Validation\Rule;

class SiteVisitRequestRequest extends PublicEnquiryRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();
        $this->merge(['interest' => $this->interest ?? 'general']);
    }

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'property_id' => ['required', 'integer'],
            'preferred_date' => ['required', 'date', 'after_or_equal:today', 'before_or_equal:'.now()->addDays(60)->toDateString()],
            'preferred_slot' => ['nullable', Rule::in(SiteVisit::SLOTS)],
        ]);
    }
}
