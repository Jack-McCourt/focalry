<?php

use App\Http\Middleware\EnsurePlanFeature;
use App\Http\Middleware\EnsureStudioNotSuspended;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ResolveCustomDomain;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetCurrentStudio;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Runs before routing so custom-domain requests are rewritten to the
        // right site before the app's own root routes can match them.
        $middleware->prepend(ResolveCustomDomain::class);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            SetCurrentStudio::class,
            SecurityHeaders::class,
        ]);

        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->api(append: [
            SetCurrentStudio::class,
        ]);

        $middleware->alias([
            'plan' => EnsurePlanFeature::class,
            'admin' => EnsureSuperAdmin::class,
            'studio.active' => EnsureStudioNotSuspended::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
