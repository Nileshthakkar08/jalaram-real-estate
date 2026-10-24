<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Http\Resources\DealDocumentResource;
use App\Models\Deal;
use App\Models\DealDocument;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Agreement copies, receipts, etc. Stored on a private disk and only streamed to authorised staff. */
class DealDocumentController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function store(Request $request, Deal $deal): JsonResponse
    {
        $this->authorize('update', $deal);
        $data = $request->validate([
            'type' => ['required', Rule::in(DealDocument::TYPES)],
            'title' => ['required', 'string', 'max:160'],
            'reference_number' => ['nullable', 'string', 'max:80'],
            'file' => ['nullable', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png', 'mimetypes:application/pdf,image/jpeg,image/png'],
        ]);

        $disk = config('filesystems.deal_document_disk', 'local');
        $attributes = ['type' => $data['type'], 'title' => strip_tags($data['title']), 'reference_number' => $data['reference_number'] ?? null, 'uploaded_by' => $request->user()->id];

        if ($file = $request->file('file')) {
            $ext = match ($file->getMimeType()) {
                'application/pdf' => 'pdf', 'image/png' => 'png', default => 'jpg',
            };
            $path = $file->storeAs("deal-documents/{$deal->id}", Str::uuid().".{$ext}", ['disk' => $disk, 'visibility' => 'private']);
            $attributes += ['disk' => $disk, 'path' => $path, 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize()];
        }

        $document = $deal->documents()->create($attributes);
        $this->audit->log('deal.document_added', $deal, [], ['document_id' => $document->id, 'type' => $document->type, 'title' => $document->title]);

        return (new DealDocumentResource($document->load('uploader')))->response()->setStatusCode(201);
    }

    public function download(Request $request, DealDocument $document): StreamedResponse
    {
        $this->authorize('view', $document->deal);
        abort_unless($document->path && Storage::disk($document->disk)->exists($document->path), 404);

        return Storage::disk($document->disk)->download(
            $document->path,
            Str::slug($document->title).'.'.pathinfo($document->path, PATHINFO_EXTENSION),
        );
    }

    public function destroy(Request $request, DealDocument $document): JsonResponse
    {
        $this->authorize('update', $document->deal);
        $document->delete();
        if ($document->path) {
            Storage::disk($document->disk)->delete($document->path);
        }
        $this->audit->log('deal.document_deleted', $document->deal, ['document_id' => $document->id, 'title' => $document->title]);

        return response()->json(['message' => 'Document deleted.']);
    }
}
