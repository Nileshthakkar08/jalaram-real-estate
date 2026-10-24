<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Http\Resources\FollowUpResource;
use App\Models\FollowUp;
use App\Services\LeadService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class FollowUpController extends Controller
{
    public function __construct(private LeadService $leads) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'when' => ['nullable', Rule::in(['today', 'overdue', 'upcoming', 'done', 'all_pending'])],
            'mine' => ['nullable', 'boolean'],
        ]);
        $user = $request->user();
        $when = $f['when'] ?? 'all_pending';
        $mine = $request->boolean('mine') || ! $user->hasPermission('leads.view_all');

        $query = FollowUp::query()->with(['lead', 'assignee'])
            ->whereHas('lead')
            ->when($mine, fn ($q) => $q->where('assigned_to', $user->id));

        match ($when) {
            'today' => $query->where('status', 'pending')->whereBetween('due_at', [today(), today()->endOfDay()])->orderBy('due_at'),
            'overdue' => $query->where('status', 'pending')->where('due_at', '<', today())->orderBy('due_at'),
            'upcoming' => $query->where('status', 'pending')->where('due_at', '>', today()->endOfDay())->orderBy('due_at'),
            'done' => $query->whereIn('status', ['done', 'cancelled'])->latest('completed_at'),
            default => $query->where('status', 'pending')->orderBy('due_at'),
        };

        return FollowUpResource::collection($query->paginate(30)->withQueryString());
    }

    public function update(Request $request, FollowUp $followUp): FollowUpResource
    {
        $this->authorize('work', $followUp->lead);
        $data = $request->validate([
            'action' => ['required', Rule::in(['complete', 'cancel', 'reschedule'])],
            'outcome' => ['nullable', 'string', 'max:2000'],
            'due_at' => ['required_if:action,reschedule', 'nullable', 'date', 'after:now'],
        ]);

        return new FollowUpResource($this->leads->updateFollowUp($followUp, $request->user(), $data['action'], $data)->load(['lead', 'assignee']));
    }
}
