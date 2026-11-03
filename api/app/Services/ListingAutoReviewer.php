<?php

namespace App\Services;

use App\Models\Property;
use App\Models\Setting;

/**
 * Checks a listing waiting for review against rules a computer can verify. When nothing is
 * flagged (and the admin setting allows it) the listing is published without a person.
 *
 * What it cannot check: that the photos show this property, that the owner really owns it, or
 * that it exists. Those risks are why the `trusted` mode only auto-approves owners whose earlier
 * listings a person has already approved, and why moderators can suspend any listing at any time.
 *
 * Setting `auto_approve_listings`: `off` (a person reviews everything), `all` (any owner, when
 * every check passes) or `trusted` (as `all`, for owners with a listing a person approved before).
 */
class ListingAutoReviewer
{
    public const MODES = ['off', 'all', 'trusted'];

    public const DEFAULT_MODE = 'all';

    public const MIN_PHOTOS = 3;

    public const MIN_DESCRIPTION = 80;

    /** Plausible price bands in rupees: [min, max]. Outside them is usually a typo (e.g. rent entered as a sale price). */
    private const PRICE_RANGE = ['sale' => [100000, 1000000000], 'rent' => [2000, 500000]];

    /** Plausible price per sq ft for buildings: sale price, and monthly rent. */
    private const PER_SQFT_RANGE = ['sale' => [800, 50000], 'rent' => [2, 200]];

    /** Smallest believable built-up area per bedroom. */
    private const MIN_SQFT_PER_BEDROOM = 150;

    public static function mode(): string
    {
        $mode = Setting::get('auto_approve_listings', self::DEFAULT_MODE);

        return in_array($mode, self::MODES, true) ? $mode : self::DEFAULT_MODE;
    }

    /** @return string[] reasons a person should look at this listing; empty when every check passes */
    public function flags(Property $property): array
    {
        $flags = [];
        $property->loadMissing(['locality', 'owner']);

        $photos = $property->images()->count();
        if ($photos < self::MIN_PHOTOS) {
            $flags[] = "Only {$photos} photo(s); automatic approval needs at least ".self::MIN_PHOTOS.'.';
        }

        $length = mb_strlen(trim((string) $property->description));
        if ($length < self::MIN_DESCRIPTION) {
            $flags[] = "Description is short ({$length} characters); automatic approval needs ".self::MIN_DESCRIPTION.'.';
        }

        // Contact details in the text would let buyers bypass the brokerage.
        $text = $property->title."\n".$property->description;
        if (preg_match('/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/', $text)) {
            $flags[] = 'Title or description contains a phone number.';
        }
        if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $text)) {
            $flags[] = 'Title or description contains an email address.';
        }
        // Emails are reported above; leave their domain out of the link check.
        $withoutEmails = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '', $text);
        if (preg_match('~https?://|www\.|\b[a-z0-9-]+\.(?:com|in|net|org|co)\b~i', $withoutEmails)) {
            $flags[] = 'Title or description contains a website link.';
        }

        if ($property->locality && ! $property->locality->is_active) {
            $flags[] = "New area typed by the owner (\"{$property->locality->name}\"): check it and activate it under Localities.";
        }

        $flags = array_merge($flags, $this->priceFlags($property));

        if ($property->property_type !== 'plot' && $property->bedrooms > 0
            && $property->area_sqft < $property->bedrooms * self::MIN_SQFT_PER_BEDROOM) {
            $flags[] = "{$property->bedrooms} BHK in only {$property->area_sqft} sq ft looks wrong.";
        }

        $duplicate = $this->duplicateOf($property);
        if ($duplicate) {
            $flags[] = "Looks like a copy of listing {$duplicate->reference_code} (same area, type, size and price).";
        }

        $flags = array_merge($flags, $this->ownerFlags($property));

        return $flags;
    }

    /** @return string[] */
    private function priceFlags(Property $property): array
    {
        $price = (float) $property->price;
        $purpose = $property->listing_purpose;
        [$min, $max] = self::PRICE_RANGE[$purpose];
        $label = $purpose === 'rent' ? 'Rent of ₹'.number_format($price).'/month' : 'Price of ₹'.number_format($price);

        if ($price < $min || $price > $max) {
            return ["{$label} looks unusual. Check it was entered correctly."];
        }
        // Land prices vary too widely (farmland to city plots) for a per-sq-ft check.
        if ($property->property_type !== 'plot' && $property->area_sqft > 0) {
            [$low, $high] = self::PER_SQFT_RANGE[$purpose];
            $perSqft = $price / $property->area_sqft;
            if ($perSqft < $low || $perSqft > $high) {
                return ["{$label} works out to ₹".number_format($perSqft, $perSqft < 10 ? 1 : 0).' per sq ft, which looks unusual.'];
            }
        }

        return [];
    }

    private function duplicateOf(Property $property): ?Property
    {
        return Property::query()
            ->whereKeyNot($property->id)
            ->whereIn('status', ['pending', 'published', 'unavailable'])
            ->where('locality_id', $property->locality_id)
            ->where('listing_purpose', $property->listing_purpose)
            ->where('property_type', $property->property_type)
            ->where('price', $property->price)
            ->whereBetween('area_sqft', [(int) floor($property->area_sqft * 0.95), (int) ceil($property->area_sqft * 1.05)])
            ->when($property->bedrooms !== null, fn ($q) => $q->where('bedrooms', $property->bedrooms))
            ->first();
    }

    /** @return string[] */
    private function ownerFlags(Property $property): array
    {
        $others = Property::query()->where('owner_id', $property->owner_id)->whereKeyNot($property->id);
        $flags = [];

        if ((clone $others)->where('status', 'suspended')->exists()) {
            $flags[] = 'This owner has a suspended listing.';
        }
        if ((clone $others)->where('status', 'rejected')->where('reviewed_at', '>=', now()->subDays(30))->exists()) {
            $flags[] = 'This owner had a listing rejected in the last 30 days.';
        }
        // A person (not this reviewer) approved one of the owner's listings before.
        $trusted = $property->reviewed_by !== null || (clone $others)->whereNotNull('reviewed_by')->whereNotNull('published_at')->exists();
        if (self::mode() === 'trusted' && ! $trusted) {
            $flags[] = 'First listing from this owner: automatic approval is set to trusted owners only.';
        }

        return $flags;
    }
}
