<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetCurrentStudio
{
    public function handle(Request $request, Closure $next): Response
    {
        $studioId = null;

        if ($request->user()) {
            $studioId = $request->user()->studio_id;
        }

        app()->instance('current.studio.id', $studioId);

        return $next($request);
    }
}
