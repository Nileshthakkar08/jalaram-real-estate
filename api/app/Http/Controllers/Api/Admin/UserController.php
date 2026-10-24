<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'role' => ['nullable', Rule::in(User::ROLES)],
            'q' => ['nullable', 'string', 'max:100'],
            'active' => ['nullable', 'boolean'],
        ]);

        $users = User::query()->withCount(['properties', 'assignedLeads'])
            ->when($f['role'] ?? null, fn ($q, $v) => $q->where('role', $v))
            ->when($request->has('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->when($f['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like));
            })
            ->orderByRaw("FIELD(role, 'admin', 'team_member', 'owner')")->orderBy('name')
            ->paginate(25)->withQueryString();

        return UserResource::collection($users)->additional(['meta' => ['permissions' => User::PERMISSIONS]]);
    }

    /** Admins create internal staff accounts. Owners self-register. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:160', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['required', Rule::in([User::ROLE_TEAM, User::ROLE_ADMIN, User::ROLE_OWNER])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => [Rule::in(array_keys(User::PERMISSIONS))],
            'password' => ['required', Password::min(10)->letters()->numbers()],
        ]);

        $user = User::create([
            'name' => strip_tags($data['name']),
            'email' => Str::lower($data['email']),
            'phone' => $data['phone'] ?? null,
            'role' => $data['role'],
            'permissions' => $data['role'] === User::ROLE_TEAM ? array_values(array_unique($data['permissions'] ?? [])) : null,
            'password' => $data['password'],
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();
        $this->audit->log('user.created', $user, [], $user->only(['name', 'email', 'role', 'permissions']));

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function update(Request $request, User $user): UserResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'role' => ['sometimes', Rule::in(User::ROLES)],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => [Rule::in(array_keys(User::PERMISSIONS))],
            'is_active' => ['sometimes', 'boolean'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $actor = $request->user();
        if ($user->id === $actor->id && ((isset($data['role']) && $data['role'] !== User::ROLE_ADMIN) || (isset($data['is_active']) && ! $data['is_active']))) {
            throw ValidationException::withMessages(['role' => ['You cannot remove your own admin access or deactivate yourself.']]);
        }
        if (isset($data['role']) && $data['role'] !== $user->role && $user->role === User::ROLE_OWNER && $user->properties()->exists()) {
            throw ValidationException::withMessages(['role' => ['This owner has listings. Create a separate staff account instead of changing the role.']]);
        }

        $original = $user->getAttributes();
        $role = $data['role'] ?? $user->role;
        $user->fill(collect($data)->only(['name', 'phone', 'role', 'is_active'])->all());
        if ($role === User::ROLE_TEAM) {
            if (array_key_exists('permissions', $data)) {
                $user->permissions = array_values(array_unique($data['permissions'] ?? []));
            }
        } else {
            $user->permissions = null;
        }
        $user->save();
        $this->audit->logChanges('user.updated', $user, $original, $data['reason'] ?? null);

        if ($user->wasChanged('is_active') && ! $user->is_active) {
            // Sign the user out everywhere.
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        return new UserResource($user->loadCount(['properties', 'assignedLeads']));
    }
}
