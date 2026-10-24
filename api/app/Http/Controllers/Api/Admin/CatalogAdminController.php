<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AmenityResource;
use App\Http\Resources\LocalityResource;
use App\Models\Amenity;
use App\Models\Locality;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Localities and amenities. Records in use are deactivated rather than deleted. */
class CatalogAdminController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function localities(): AnonymousResourceCollection
    {
        return LocalityResource::collection(Locality::query()->withCount('properties')->orderBy('sort_order')->orderBy('name')->get());
    }

    public function storeLocality(Request $request): JsonResponse
    {
        $data = $this->validateLocality($request);
        $locality = Locality::create($data);
        $this->audit->log('locality.created', $locality, [], $data);

        return (new LocalityResource($locality))->response()->setStatusCode(201);
    }

    public function updateLocality(Request $request, Locality $locality): LocalityResource
    {
        $original = $locality->getAttributes();
        $locality->update($this->validateLocality($request, $locality));
        $this->audit->logChanges('locality.updated', $locality, $original);

        return new LocalityResource($locality->loadCount('properties'));
    }

    public function destroyLocality(Locality $locality): JsonResponse
    {
        abort_if($locality->properties()->withTrashed()->exists(), 409, 'This locality is used by listings. Deactivate it instead.');
        $locality->delete();
        $this->audit->log('locality.deleted', $locality, $locality->only(['name', 'slug']));

        return response()->json(['message' => 'Locality deleted.']);
    }

    public function amenities(): AnonymousResourceCollection
    {
        return AmenityResource::collection(Amenity::query()->withCount('properties')->orderBy('sort_order')->orderBy('name')->get());
    }

    public function storeAmenity(Request $request): JsonResponse
    {
        $data = $this->validateAmenity($request);
        $amenity = Amenity::create($data);
        $this->audit->log('amenity.created', $amenity, [], $data);

        return (new AmenityResource($amenity))->response()->setStatusCode(201);
    }

    public function updateAmenity(Request $request, Amenity $amenity): AmenityResource
    {
        $original = $amenity->getAttributes();
        $amenity->update($this->validateAmenity($request, $amenity));
        $this->audit->logChanges('amenity.updated', $amenity, $original);

        return new AmenityResource($amenity->loadCount('properties'));
    }

    public function destroyAmenity(Amenity $amenity): JsonResponse
    {
        abort_if($amenity->properties()->exists(), 409, 'This amenity is used by listings. Deactivate it instead.');
        $amenity->delete();
        $this->audit->log('amenity.deleted', $amenity, $amenity->only(['name', 'slug']));

        return response()->json(['message' => 'Amenity deleted.']);
    }

    private function validateLocality(Request $request, ?Locality $locality = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('localities', 'name')->ignore($locality?->id)],
            'slug' => ['nullable', 'string', 'max:140', 'alpha_dash', Rule::unique('localities', 'slug')->ignore($locality?->id)],
            'city' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,10000'],
        ]);
        $data['slug'] = ($data['slug'] ?? null) ?: Str::slug($data['name']);
        $data['city'] = $data['city'] ?? 'Ahmedabad';
        $data['sort_order'] = $data['sort_order'] ?? 0;

        return $data;
    }

    private function validateAmenity(Request $request, ?Amenity $amenity = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('amenities', 'name')->ignore($amenity?->id)],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'between:0,10000'],
        ]);
        $data['slug'] = Str::slug($data['name']);
        $data['sort_order'] = $data['sort_order'] ?? 0;

        return $data;
    }
}
