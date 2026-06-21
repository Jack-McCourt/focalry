<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate a route group behind a plan feature. The studio's current tier must
 * unlock $feature (see config/plans.php) or the user is redirected to the
 * billing page with an upgrade prompt.
 *
 * Usage: ->middleware('plan:store')
 */
class EnsurePlanFeature
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $studio = $request->user()?->studio;

        if (! $studio || ! $studio->hasFeature($feature)) {
            $label = config("plans.feature_labels.$feature", 'this feature');

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => "Your plan doesn't include {$label}. Upgrade to unlock it.",
                    'upgrade_url' => route('billing.index'),
                ], 403);
            }

            return redirect()
                ->route('billing.index')
                ->with('error', "Your plan doesn't include {$label}. Upgrade to unlock it.");
        }

        return $next($request);
    }
}
