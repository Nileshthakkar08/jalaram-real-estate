<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Services\PropertyVideoService;
use App\Services\PropertyWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Shared by owners (own listings) and moderators (any listing), like the photos. */
class PropertyVideoController extends Controller
{
    public function __construct(private PropertyVideoService $videos, private PropertyWorkflow $workflow) {}

    /** Receives one piece of the video; the response after the last piece carries the saved video. */
    public function chunk(Request $request, Property $property): JsonResponse
    {
        $this->authorizeVideo($request, $property);

        $data = $request->validate([
            'upload_id' => ['required', 'uuid'],
            'index' => ['required', 'integer', 'min:0', 'lt:total'],
            'total' => ['required', 'integer', 'min:1', 'max:'.PropertyVideoService::MAX_CHUNKS],
            'size' => ['required', 'integer', 'min:1', 'max:'.PropertyVideoService::MAX_BYTES],
            'chunk' => ['required', 'file', 'max:'.(PropertyVideoService::CHUNK_BYTES / 1024)],
        ], [
            'size.max' => 'The video must be 100 MB or smaller.',
        ]);

        $done = $this->videos->storeChunk($property, [
            'upload_id' => strtolower($data['upload_id']),
            'index' => (int) $data['index'],
            'total' => (int) $data['total'],
            'size' => (int) $data['size'],
        ], $request->file('chunk'));

        if (! $done) {
            return response()->json(['data' => ['received' => (int) $data['index'] + 1, 'total' => (int) $data['total']]], 202);
        }

        $resubmitted = $request->user()->isOwner() && $this->workflow->afterOwnerEdit($property->refresh());

        return response()->json([
            'data' => ['video' => $property->refresh()->videoData()],
            'meta' => ['resubmitted_for_review' => $resubmitted],
        ], 201);
    }

    public function destroy(Request $request, Property $property): JsonResponse
    {
        $this->authorizeVideo($request, $property);
        $this->videos->delete($property);
        $resubmitted = $request->user()->isOwner() && $this->workflow->afterOwnerEdit($property->refresh());

        return response()->json(['data' => ['video' => null], 'meta' => ['resubmitted_for_review' => $resubmitted]]);
    }

    private function authorizeVideo(Request $request, Property $property): void
    {
        $user = $request->user();
        if ($user->isOwner()) {
            $this->authorize('ownerUpdate', $property);
            abort_if(in_array($property->status, ['closed', 'suspended'], true), 409, "The video of a {$property->status} listing cannot be changed.");

            return;
        }
        $this->authorize('moderate', $property);
    }
}
