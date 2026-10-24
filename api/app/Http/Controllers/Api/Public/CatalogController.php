<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\AmenityResource;
use App\Http\Resources\LocalityResource;
use App\Models\Amenity;
use App\Models\Locality;
use App\Models\Property;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CatalogController extends Controller
{
    public function settings(): JsonResponse
    {
        $public = Setting::query()->where('is_public', true)->whereNotNull('value')->where('value', '!=', '')
            ->pluck('value', 'key');

        return response()->json(['data' => $public]);
    }

    public function localities(): AnonymousResourceCollection
    {
        $localities = Locality::query()->active()
            ->withCount(['properties as listing_count' => fn ($q) => $q->publiclyVisible()])
            ->orderBy('sort_order')->orderBy('name')
            ->get();

        return LocalityResource::collection($localities);
    }

    public function locality(string $slug): LocalityResource
    {
        $locality = Locality::query()->active()->where('slug', $slug)
            ->withCount(['properties as listing_count' => fn ($q) => $q->publiclyVisible()])
            ->firstOrFail();

        return new LocalityResource($locality);
    }

    public function amenities(): AnonymousResourceCollection
    {
        return AmenityResource::collection(Amenity::query()->active()->orderBy('sort_order')->orderBy('name')->get());
    }

    public function sitemap(): JsonResponse
    {
        return response()->json(['data' => [
            'properties' => Property::query()->publiclyVisible()->select('slug', 'updated_at')->orderByDesc('updated_at')->limit(5000)->get()
                ->map(fn ($p) => ['slug' => $p->slug, 'updated_at' => $p->updated_at?->toIso8601String()]),
            'localities' => Locality::query()->active()->select('slug', 'updated_at')->get()
                ->map(fn ($l) => ['slug' => $l->slug, 'updated_at' => $l->updated_at?->toIso8601String()]),
        ]]);
    }
}
