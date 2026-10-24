<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPropertyResource;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PropertySearchController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'purpose' => ['nullable', Rule::in(Property::PURPOSES)],
            'locality' => ['nullable', 'string', 'max:140'],
            'type' => ['nullable', Rule::in(Property::TYPES)],
            'bhk' => ['nullable', 'integer', 'between:1,10'],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0'],
            'furnishing' => ['nullable', Rule::in(Property::FURNISHING)],
            'q' => ['nullable', 'string', 'max:100'],
            'featured' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['newest', 'price_asc', 'price_desc', 'area_desc'])],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Property::query()->publiclyVisible()
            ->with(['locality', 'images' => fn ($q) => $q->limit(1)])
            ->when($filters['purpose'] ?? null, fn ($q, $v) => $q->where('listing_purpose', $v))
            ->when($filters['locality'] ?? null, fn ($q, $v) => $q->whereHas('locality', fn ($l) => $l->where('slug', $v)))
            ->when($filters['type'] ?? null, fn ($q, $v) => $q->where('property_type', $v))
            ->when($filters['bhk'] ?? null, fn ($q, $v) => (int) $v >= 5 ? $q->where('bedrooms', '>=', 5) : $q->where('bedrooms', (int) $v))
            ->when($filters['min_price'] ?? null, fn ($q, $v) => $q->where('price', '>=', $v))
            ->when($filters['max_price'] ?? null, fn ($q, $v) => $q->where('price', '<=', $v))
            ->when($filters['furnishing'] ?? null, fn ($q, $v) => $q->where('furnishing', $v))
            ->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true))
            ->when($filters['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('public_address', 'like', $like)->orWhere('reference_code', 'like', $like));
            });

        match ($filters['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('price')->orderByDesc('id'),
            'price_desc' => $query->orderByDesc('price')->orderByDesc('id'),
            'area_desc' => $query->orderByDesc('area_sqft')->orderByDesc('id'),
            default => $query->orderByDesc('published_at')->orderByDesc('id'),
        };

        return PublicPropertyResource::collection($query->paginate($filters['per_page'] ?? 12)->withQueryString());
    }

    public function show(string $slug): JsonResponse
    {
        $property = Property::query()->publiclyVisible()
            ->with(['locality', 'images', 'amenities'])
            ->where('slug', $slug)
            ->firstOrFail();

        $similar = Property::query()->publiclyVisible()
            ->with(['locality', 'images'])
            ->whereKeyNot($property->id)
            ->where('listing_purpose', $property->listing_purpose)
            ->orderByRaw('locality_id = ? DESC', [$property->locality_id])
            ->orderByRaw('property_type = ? DESC', [$property->property_type])
            ->latest('published_at')
            ->limit(3)
            ->get();

        return response()->json([
            'data' => (new PublicPropertyResource($property))->detailed()->resolve(),
            'similar' => PublicPropertyResource::collection($similar)->resolve(),
        ]);
    }
}
