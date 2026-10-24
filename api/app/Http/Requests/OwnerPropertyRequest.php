<?php

namespace App\Http\Requests;

use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Listing fields editable by owners (and by admins on their behalf). */
class OwnerPropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Ownership is checked by PropertyPolicy in the controller.
    }

    protected function prepareForValidation(): void
    {
        foreach (['title', 'description', 'public_address', 'private_address'] as $field) {
            if (is_string($this->{$field})) {
                $this->merge([$field => trim(strip_tags($this->{$field}))]);
            }
        }
    }

    public function rules(): array
    {
        $isPlot = $this->input('property_type') === 'plot';

        return [
            'title' => ['required', 'string', 'min:10', 'max:160'],
            'description' => ['nullable', 'string', 'max:5000'],
            'listing_purpose' => ['required', Rule::in(Property::PURPOSES)],
            'property_type' => ['required', Rule::in(Property::TYPES)],
            'locality_id' => ['required', 'integer', Rule::exists('localities', 'id')->where('is_active', true)],
            'public_address' => ['required', 'string', 'max:200'],
            'private_address' => ['nullable', 'string', 'max:300'],
            'pincode' => ['nullable', 'digits:6'],
            'price' => ['required', 'numeric', 'min:1000', 'max:9999999999'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:9999999999', Rule::prohibitedIf($this->input('listing_purpose') === 'sale')],
            'maintenance_charges' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'price_negotiable' => ['boolean'],
            'area_sqft' => ['required', 'integer', 'min:50', 'max:1000000'],
            'bedrooms' => [$isPlot ? 'nullable' : 'required', 'integer', 'between:0,20'],
            'bathrooms' => ['nullable', 'integer', 'between:0,20'],
            'balconies' => ['nullable', 'integer', 'between:0,20'],
            'floor_number' => ['nullable', 'integer', 'between:-3,200'],
            'total_floors' => ['nullable', 'integer', 'between:1,200'],
            'furnishing' => ['nullable', Rule::in(Property::FURNISHING)],
            'facing' => ['nullable', Rule::in(Property::FACING)],
            'property_age_years' => ['nullable', 'integer', 'between:0,150'],
            'available_from' => ['nullable', 'date'],
            'owner_contact_name' => ['nullable', 'string', 'max:120'],
            'owner_contact_phone' => ['nullable', 'string', 'regex:/^\+?[0-9\s\-()]{10,20}$/'],
            'owner_contact_email' => ['nullable', 'email', 'max:160'],
            'amenity_ids' => ['nullable', 'array', 'max:50'],
            'amenity_ids.*' => ['integer', Rule::exists('amenities', 'id')->where('is_active', true)],
        ];
    }

    public function propertyData(): array
    {
        $data = $this->safe()->only(Property::OWNER_EDITABLE);
        $data['description'] ??= '';
        $data['price_negotiable'] = $this->boolean('price_negotiable');
        if (($data['listing_purpose'] ?? null) === 'sale') {
            $data['security_deposit'] = null;
        }

        return $data;
    }
}
