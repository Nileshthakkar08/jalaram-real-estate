<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\PropertyImageResource;
use App\Models\Property;
use App\Models\PropertyImage;
use App\Services\PropertyImageService;
use App\Services\PropertyWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Shared by owners (own listings) and moderators (any listing). */
class PropertyImageController extends Controller
{
    public function __construct(private PropertyImageService $images, private PropertyWorkflow $workflow) {}

    public function store(Request $request, Property $property): JsonResponse
    {
        $this->authorizeImages($request, $property);

        $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:'.Property::MAX_IMAGES],
            'images.*' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp'],
        ], [
            'images.*.max' => 'Each photo must be 5 MB or smaller.',
            'images.*.mimes' => 'Photos must be JPEG, PNG or WebP.',
            'images.*.mimetypes' => 'Photos must be JPEG, PNG or WebP.',
        ]);

        $this->images->store($property, $request->file('images'));
        $resubmitted = $request->user()->isOwner() && $this->workflow->afterOwnerEdit($property);

        return response()->json([
            'data' => PropertyImageResource::collection($property->images()->get()),
            'meta' => ['resubmitted_for_review' => $resubmitted],
        ], 201);
    }

    public function reorder(Request $request, Property $property): JsonResponse
    {
        $this->authorizeImages($request, $property);
        $data = $request->validate(['image_ids' => ['required', 'array'], 'image_ids.*' => ['integer']]);
        $this->images->reorder($property, $data['image_ids']);

        return response()->json(['data' => PropertyImageResource::collection($property->images()->get())]);
    }

    public function destroy(Request $request, Property $property, PropertyImage $image): JsonResponse
    {
        $this->authorizeImages($request, $property);
        abort_unless($image->property_id === $property->id, 404);
        $this->images->delete($image);
        $resubmitted = $request->user()->isOwner() && $this->workflow->afterOwnerEdit($property->refresh());

        return response()->json([
            'data' => PropertyImageResource::collection($property->images()->get()),
            'meta' => ['resubmitted_for_review' => $resubmitted],
        ]);
    }

    private function authorizeImages(Request $request, Property $property): void
    {
        $user = $request->user();
        if ($user->isOwner()) {
            $this->authorize('ownerUpdate', $property);
            abort_if(in_array($property->status, ['closed', 'suspended'], true), 409, "Photos of a {$property->status} listing cannot be changed.");

            return;
        }
        $this->authorize('moderate', $property);
    }
}
