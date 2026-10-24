<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Http\Resources\DealResource;
use App\Http\Resources\LeadResource;
use App\Http\Resources\OwnerNoteResource;
use App\Http\Resources\OwnerPropertyResource;
use App\Models\Lead;
use App\Models\OwnerCoordinationNote;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Internal property view: includes private address and owner contact for coordination. */
class TeamPropertyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'status' => ['nullable', Rule::in(Property::STATUSES)],
            'purpose' => ['nullable', Rule::in(Property::PURPOSES)],
            'locality_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        $properties = Property::query()->with(['locality', 'images', 'owner'])->withCount(['leads', 'deals'])
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v), fn ($q) => $q->where('status', '!=', 'draft'))
            ->when($f['purpose'] ?? null, fn ($q, $v) => $q->where('listing_purpose', $v))
            ->when($f['locality_id'] ?? null, fn ($q, $v) => $q->where('locality_id', $v))
            ->when($f['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('reference_code', 'like', $like)
                    ->orWhere('public_address', 'like', $like)->orWhereHas('owner', fn ($o) => $o->where('name', 'like', $like)));
            })
            ->latest('updated_at')
            ->paginate($f['per_page'] ?? 20)->withQueryString();

        return OwnerPropertyResource::collection($properties);
    }

    public function show(Request $request, Property $property): JsonResponse
    {
        $property->load(['locality', 'images', 'amenities', 'owner', 'reviewer'])->loadCount(['leads', 'deals']);
        $user = $request->user();

        return response()->json([
            'data' => new OwnerPropertyResource($property),
            'owner_notes' => OwnerNoteResource::collection($property->ownerNotes()->with('user')->get()),
            'leads' => LeadResource::collection(Lead::query()->visibleTo($user)->where('property_id', $property->id)->with('assignee')->latest('id')->limit(50)->get()),
            'deals' => DealResource::collection($property->deals()->visibleTo($user)->with('assignee')->latest('id')->get()),
        ]);
    }

    public function addOwnerNote(Request $request, Property $property): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(OwnerCoordinationNote::TYPES)],
            'body' => ['required', 'string', 'max:5000'],
            'lead_id' => ['nullable', 'integer', Rule::exists('leads', 'id')->where('property_id', $property->id)],
            'deal_id' => ['nullable', 'integer', Rule::exists('deals', 'id')->where('property_id', $property->id)],
        ]);
        if (! empty($data['lead_id'])) {
            $this->authorize('work', Lead::findOrFail($data['lead_id']));
        }

        $note = DB::transaction(function () use ($property, $data, $request) {
            $note = $property->ownerNotes()->create($data + ['user_id' => $request->user()->id]);
            if (! empty($data['lead_id'])) {
                Lead::find($data['lead_id'])->activities()->create([
                    'user_id' => $request->user()->id,
                    'type' => 'owner_coordination',
                    'body' => 'Owner coordination ('.str_replace('_', ' ', $data['type']).'): '.$data['body'],
                ]);
            }

            return $note;
        });

        return (new OwnerNoteResource($note->load('user')))->response()->setStatusCode(201);
    }
}
