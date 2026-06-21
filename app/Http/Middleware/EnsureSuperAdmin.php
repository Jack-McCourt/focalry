<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restrict a route to platform super admins. While impersonating a studio
 * user, admin access is intentionally withheld — the admin must stop
 * impersonating to return to the admin suite.
 */
class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isSuperAdmin() || $request->session()->has('impersonator_id')) {
            abort(403, 'Super admin access required.');
        }

        return $next($request);
    }
}
