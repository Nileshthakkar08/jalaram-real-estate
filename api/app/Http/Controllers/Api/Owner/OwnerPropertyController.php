<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\OwnerPropertyRequest;
use App\Http\Resources\OwnerPropertyResource;
use App\Models\Property;
use App\Services\AuditLogger;
use App\Services\PropertyWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Owners manage their own listings only. Leads and brokerage are never exposed here. */
class OwnerPropertyController extends Controller
{
    public function __construct(private PropertyWorkflow $workflow, private AuditLogger $audit) {}

    public function dashboard(Request $request): JsonResponse
    {
        $counts = $request->user()->properties()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');
        $recent = $request->user()->properties()->with(['locality', 'images'])->latest('updated_at')->limit(5)->get();

        return response()->json(['data' => [
            'counts' => $counts,
            'total' => $counts->sum(),
            'recent' => OwnerPropertyResource::collection($recent),
        ]]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['status' => ['nullable', Rule::in(Property::STATUSES)]]);

        $properties = $request->user()->properties()
            ->with(['locality', 'images'])
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->latest('updated_at')
            ->paginate(12);

        return OwnerPropertyResource::collection($properties);
    }

    public function store(OwnerPropertyRequest $request): JsonResponse
    {
        $property = DB::transaction(function () use ($request) {
            $property = Property::create($request->propertyData() + [
                'owner_id' => $request->user()->id,
                'status' => 'draft',
            ]);
            $property->amenities()->sync($request->input('amenity_ids', []));
            $this->audit->log('property.created', $property, [], ['title' => $property->title]);

            return $property;
        });

        return (new OwnerPropertyResource($property->fresh(['locality', 'images', 'amenities'])))->response()->setStatusCode(201);
    }

    public function show(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('ownerView', $property);

        return new OwnerPropertyResource($property->load(['locality', 'images', 'amenities']));
    }

    public function update(OwnerPropertyRequest $request, Property $property): JsonResponse
    {
        $this->authorize('ownerUpdate', $property);
        abort_unless($this->workflow->ownerCanEdit($property), 409, "A {$property->status} listing cannot be edited. Contact Jalaram Real Estate.");

        $resubmitted = DB::transaction(function () use ($request, $property) {
            $original = $property->getAttributes();
            $property->fill($request->propertyData());
            $changed = $property->isDirty();
            $property->save();
            $amenityChanges = $property->amenities()->sync($request->input('amenity_ids', []));
            $changed = $changed || array_filter($amenityChanges) !== [];
            $this->audit->logChanges('property.updated', $property, $original);

            return $changed ? $this->workflow->afterOwnerEdit($property) : false;
        });

        return (new OwnerPropertyResource($property->fresh(['locality', 'images', 'amenities'])))
            ->additional(['meta' => ['resubmitted_for_review' => $resubmitted]])
            ->response();
    }

    public function destroy(Request $request, Property $property): JsonResponse
    {
        $this->authorize('ownerDelete', $property);
        $property->delete();
        $this->audit->log('property.deleted', $property);

        return response()->json(['message' => 'Listing deleted.']);
    }

    public function submit(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('ownerUpdate', $property);

        return new OwnerPropertyResource($this->workflow->submit($property)->load(['locality', 'images', 'amenities']));
    }

    public function availability(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('ownerUpdate', $property);
        $request->validate(['available' => ['required', 'boolean']]);

        return new OwnerPropertyResource($this->workflow->setAvailability($property, $request->boolean('available'))->load(['locality', 'images', 'amenities']));
    }

    public function close(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('ownerUpdate', $property);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);

        return new OwnerPropertyResource($this->workflow->ownerClose($property, $data['reason'] ?? null)->load(['locality', 'images', 'amenities']));
    }
}
