<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: ->middleware('role:team_member,admin'). Also rejects deactivated accounts. */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if (! $user->is_active) {
            auth()->guard('web')->logout();

            return response()->json(['message' => 'Your account has been deactivated.'], 403);
        }
        if ($roles !== [] && ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'You do not have access to this area.'], 403);
        }

        return $next($request);
    }
}
