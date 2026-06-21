<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lock out users whose studio has been suspended by a super admin. Super
 * admins (and an admin actively impersonating) are allowed through so they
 * can still investigate.
 */
class EnsureStudioNotSuspended
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user
            && ! $user->isSuperAdmin()
            && ! $request->session()->has('impersonator_id')
            && $user->studio?->isSuspended()) {
            abort(403, 'This account has been suspended. Please contact support.');
        }

        return $next($request);
    }
}
