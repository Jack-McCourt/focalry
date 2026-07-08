<?php

namespace App\Support;

use App\Models\SiteVisit;
use Illuminate\Http\Request;

/**
 * Records a public-site page view for the built-in analytics. Shared by
 * PublicSiteController (cache misses) and CachePublicSite (cache hits), so
 * serving a page from the full-page cache still counts the visit.
 *
 * Obvious bots are skipped, and the insert is deferred to after the response
 * has been sent so analytics never costs the visitor time.
 */
class SiteVisits
{
    public static function record(int $siteId, ?int $studioId, string $path, Request $request): void
    {
        $ua = (string) $request->userAgent();
        if ($ua === '' || preg_match('/bot|crawl|spider|slurp|bing|facebookexternalhit|headless|preview|monitor/i', $ua)) {
            return;
        }

        $ref = $request->headers->get('referer');
        $host = $ref ? parse_url($ref, PHP_URL_HOST) : null;
        // Ignore self-referrals (internal navigation).
        if ($host === $request->getHost()) {
            $host = null;
        }

        // Anonymous unique-visitor hash: rotates daily, never stores the IP.
        $visitorHash = substr(sha1(implode('|', [now()->toDateString(), $siteId, (string) $request->ip(), $ua])), 0, 40);
        $device = preg_match('/tablet|ipad/i', $ua) ? 'tablet' : (preg_match('/mobi|android|iphone/i', $ua) ? 'mobile' : 'desktop');
        $utm = fn (string $key) => ($v = trim((string) $request->query($key, ''))) !== '' ? mb_substr($v, 0, 120) : null;
        $utms = ['utm_source' => $utm('utm_source'), 'utm_medium' => $utm('utm_medium'), 'utm_campaign' => $utm('utm_campaign')];

        $record = function () use ($siteId, $studioId, $path, $host, $visitorHash, $device, $utms) {
            app()->instance('current.studio.id', $studioId);

            try {
                SiteVisit::create([
                    'site_id' => $siteId,
                    'path' => mb_substr($path !== '' ? $path : '/', 0, 250),
                    'referrer_host' => $host ? mb_substr((string) $host, 0, 250) : null,
                    'visitor_hash' => $visitorHash,
                    'device' => $device,
                    ...$utms,
                ]);
            } catch (\Throwable $e) {
                report($e);
            }
        };

        // In tests, run inline: afterResponse registers app-terminating callbacks,
        // which accumulate (and re-fire) across the multiple in-process requests a
        // test makes. Real requests bootstrap a fresh app, so deferring is safe.
        if (app()->runningUnitTests()) {
            $record();

            return;
        }

        dispatch($record)->afterResponse();
    }
}
