<?php

namespace App\Http\Middleware;

use App\Models\Site;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves a studio's website on its own verified custom domain.
 *
 * When a request arrives on a host that isn't the platform's own domain and
 * matches a verified, published site, the request is rewritten to that site's
 * internal /site/{slug}/... path. This reuses all existing routes, session,
 * CSRF and Inertia handling, while the controller reads the stamped
 * `site_domain_host` attribute to emit clean root-relative URLs for the domain.
 */
class ResolveCustomDomain
{
    public function handle(Request $request, Closure $next): Response
    {
        $host = strtolower($request->getHost());

        if ($this->isAppHost($host)) {
            return $next($request);
        }

        $site = Site::withoutGlobalScopes()
            ->where('custom_domain', $host)
            ->whereNotNull('domain_verified_at')
            ->where('is_published', true)
            ->first();

        if (! $site) {
            return $next($request); // unknown host → normal routing (likely 404)
        }

        $path = trim($request->path(), '/');
        $internal = '/site/'.$site->slug.($path !== '' ? '/'.$path : '');
        if ($qs = $request->getQueryString()) {
            $internal .= '?'.$qs;
        }

        $server = $request->server->all();
        $server['REQUEST_URI'] = $internal;

        $rewritten = $request->duplicate(null, null, null, null, null, $server);
        $rewritten->attributes->set('site_domain_host', $host);
        // Preserve the original clean URI so Inertia reports it (and the browser
        // address bar stays clean) instead of the internal /site/{slug} path.
        $rewritten->attributes->set('site_clean_uri', $request->getRequestUri());
        $rewritten->setRouteResolver($request->getRouteResolver());

        // Keep the container's shared request in sync for code using request().
        app()->instance('request', $rewritten);

        return $next($rewritten);
    }

    private function isAppHost(string $host): bool
    {
        $strip = fn (string $h) => preg_replace('#^www\.#', '', strtolower($h));
        $host = $strip($host);
        $appHost = $strip((string) parse_url((string) config('app.url'), PHP_URL_HOST));

        return $host === '' || $host === $appHost || $host === 'localhost' || $host === '127.0.0.1';
    }
}
