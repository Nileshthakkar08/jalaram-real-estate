<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\OwnerPropertyRequest;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\OwnerPropertyResource;
use App\Models\AuditLog;
use App\Models\Property;
use App\Services\AuditLogger;
use App\Services\PropertyWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Listing moderation. Open to admins and team members with `properties.moderate`. */
class AdminPropertyController extends Controller
{
    public function __construct(private PropertyWorkflow $workflow, private AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('moderate', Property::class);
        $f = $request->validate([
            'status' => ['nullable', Rule::in(Property::STATUSES)],
            'purpose' => ['nullable', Rule::in(Property::PURPOSES)],
            'owner_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $properties = Property::query()->with(['locality', 'images', 'owner'])->withCount(['leads', 'deals'])
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($f['purpose'] ?? null, fn ($q, $v) => $q->where('listing_purpose', $v))
            ->when($f['owner_id'] ?? null, fn ($q, $v) => $q->where('owner_id', $v))
            ->when($f['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('reference_code', 'like', $like)
                    ->orWhereHas('owner', fn ($o) => $o->where('name', 'like', $like)->orWhere('email', 'like', $like)));
            })
            ->orderByRaw("status = 'pending' DESC")
            ->latest('updated_at')
            ->paginate(20)->withQueryString();

        return OwnerPropertyResource::collection($properties);
    }

    public function show(Property $property): JsonResponse
    {
        $this->authorize('moderate', $property);
        $property->load(['locality', 'images', 'amenities', 'owner', 'reviewer'])->loadCount(['leads', 'deals']);

        return response()->json([
            'data' => new OwnerPropertyResource($property),
            'history' => AuditLogResource::collection(
                AuditLog::query()->with('user')->where('auditable_type', 'Property')->where('auditable_id', $property->id)->latest('id')->limit(50)->get()
            ),
        ]);
    }

    public function update(OwnerPropertyRequest $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('moderate', $property);
        $extra = $request->validate(['moderation_note' => ['nullable', 'string', 'max:2000']]);

        DB::transaction(function () use ($request, $property, $extra) {
            $original = $property->getAttributes();
            $property->fill($request->propertyData() + $extra)->save();
            $property->amenities()->sync($request->input('amenity_ids', []));
            $this->audit->logChanges('property.updated_by_staff', $property, $original);
        });

        return new OwnerPropertyResource($property->fresh(['locality', 'images', 'amenities', 'owner', 'reviewer']));
    }

    public function approve(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('moderate', $property);
        $data = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);

        return new OwnerPropertyResource($this->workflow->approve($property, $data['note'] ?? null)->load(['locality', 'images', 'owner']));
    }

    public function reject(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('moderate', $property);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);

        return new OwnerPropertyResource($this->workflow->reject($property, $data['reason'])->load(['locality', 'images', 'owner']));
    }

    public function status(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('moderate', $property);
        $data = $request->validate([
            'status' => ['required', Rule::in(['published', 'suspended', 'unavailable', 'closed', 'expired'])],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        return new OwnerPropertyResource($this->workflow->moderatorSetStatus($property, $data['status'], $data['reason'] ?? null)->load(['locality', 'images', 'owner']));
    }

    public function feature(Request $request, Property $property): OwnerPropertyResource
    {
        $this->authorize('moderate', $property);
        $data = $request->validate(['featured' => ['required', 'boolean']]);
        $old = $property->is_featured;
        $property->forceFill(['is_featured' => $data['featured']])->save();
        $this->audit->log('property.featured_changed', $property, ['is_featured' => $old], ['is_featured' => $property->is_featured]);

        return new OwnerPropertyResource($property->load(['locality', 'images', 'owner']));
    }
}
