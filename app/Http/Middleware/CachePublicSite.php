<?php

namespace App\Http\Middleware;

use App\Models\Site;
use App\Support\SiteVisits;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Full-page cache for the public studio websites.
 *
 * Published site content only changes on Publish (drafts never touch the live
 * tables), so the rendered HTML is safe to cache. The key embeds the site's
 * `updated_at` as a version — publishing (or anything that touches the site,
 * e.g. category renames via SiteCategory::$touches) starts writing fresh keys
 * and the stale ones simply age out of the TTL.
 *
 * Only full-HTML GETs are cached: those carry the SSR render + page/blocks
 * query cost and are what crawlers hit. Inertia XHR navigations (X-Inertia)
 * skip the cache — they don't invoke SSR and are cheap. Requests with flash
 * (e.g. the thank-you after a contact-form submit) or validation errors are
 * user-specific and bypass entirely.
 */
class CachePublicSite
{
    private const TTL_HOURS = 6;

    public function handle(Request $request, Closure $next): Response
    {
        $slug = (string) $request->route('slug');

        if ($slug === '' || ! $request->isMethod('GET') || $request->header('X-Inertia')) {
            return $next($request);
        }

        if ($request->hasSession() && $this->sessionIsPersonal($request)) {
            return $next($request);
        }

        // One indexed three-column read replaces the full render on a hit; the
        // updated_at versions the key. Unknown/unpublished slugs fall through.
        $site = Site::withoutGlobalScopes()
            ->where('slug', $slug)
            ->where('is_published', true)
            ->first(['id', 'studio_id', 'updated_at']);

        if (! $site) {
            return $next($request);
        }

        // Only the query params the renderer actually reads (blog pagination)
        // go into the key — junk params (utm_*, cache-busting spam) would
        // otherwise mint unlimited cache entries for identical content.
        $uri = $this->normalizedUri($request);
        if ($uri === null) {
            return $next($request); // out-of-range params: render live, don't cache
        }

        // The same page renders different link bases on a custom domain vs the
        // /site/{slug} path, so the serving host is part of the key. The Inertia
        // (asset-manifest) version is included so a deploy with new JS/CSS
        // hashes never serves HTML that references the old build.
        $host = (string) ($request->attributes->get('site_domain_host') ?? '');
        $build = (string) Inertia::getVersion();
        $key = 'public-site:'.sha1($slug.'|'.$site->updated_at.'|'.$host.'|'.$build.'|'.$uri);

        if (is_array($hit = Cache::get($key))) {
            // The controller never runs on a hit — count the page view here so
            // the built-in analytics don't undercount cached traffic.
            $this->recordVisit($request, $site->id, $site->studio_id);

            return response($hit['content'], 200, $hit['headers'] + ['X-Page-Cache' => 'hit']);
        }

        $response = $next($request);

        // Cache plain 200s only — redirects, 404s and anything that set a
        // cookie stay per-request. (Session/CSRF cookies are attached by
        // middleware outside this one, so they're never captured here.)
        if ($response->getStatusCode() === 200 && ! $response->headers->has('Set-Cookie') && is_string($response->getContent())) {
            Cache::put($key, [
                'content' => $response->getContent(),
                'headers' => ['Content-Type' => $response->headers->get('Content-Type', 'text/html; charset=UTF-8')],
            ], now()->addHours(self::TTL_HOURS));
        }

        return $response;
    }

    /**
     * Path + the recognized query params only (?page, ?category — blog
     * pagination), sorted for a stable key. Null when a recognized param is
     * outside sane bounds: those requests render live and are never cached,
     * so `?page=999999` spam can't grow the cache.
     */
    private function normalizedUri(Request $request): ?string
    {
        $page = $request->query('page');
        if ($page !== null && (! ctype_digit((string) $page) || (int) $page < 1 || (int) $page > 500)) {
            return null;
        }

        $category = $request->query('category');
        if ($category !== null && (! is_string($category) || strlen($category) > 120)) {
            return null;
        }

        $params = array_filter([
            'category' => is_string($category) ? $category : null,
            'page' => $page !== null ? (string) $page : null,
        ], fn ($v) => $v !== null && $v !== '');

        $path = (string) (parse_url($request->getRequestUri(), PHP_URL_PATH) ?: '/');

        return $path.($params ? '?'.http_build_query($params) : '');
    }

    /** Flash messages / validation errors make a response user-specific. */
    private function sessionIsPersonal(Request $request): bool
    {
        $session = $request->session();

        return $session->has('success') || $session->has('error') || $session->has('errors');
    }

    /** Analytics for cache hits — only the content pages the controller counts. */
    private function recordVisit(Request $request, int $siteId, ?int $studioId): void
    {
        $route = (string) $request->route()?->getName();

        $path = match ($route) {
            'sites.public.show' => (string) $request->route('page'),
            'sites.public.post' => $request->route('parent').'/'.$request->route('post'),
            default => null, // sitemap/robots aren't page views
        };

        if ($path !== null) {
            SiteVisits::record($siteId, $studioId, $path, $request);
        }
    }
}
