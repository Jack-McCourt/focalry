<?php

namespace App\Support;

/**
 * Resolves a public Wasabi object key (under the `public/` prefix) to a URL.
 *
 * Single source of truth for how public site assets are served:
 *   - CDN (preferred): when WASABI_CDN_URL is set (a BunnyCDN pull zone with S3
 *     Auth fronting the bucket), serve the object straight from the edge.
 *   - Stream fallback: otherwise serve via the app's `/assets/...` route, which
 *     works even while the Wasabi account blocks anonymous public reads.
 *
 * Both paths are relative to the `public/` prefix: the pull zone's origin points
 * at `<bucket>/public`, so the CDN can never reach private objects outside it.
 */
class PublicAsset
{
    /** Cache-Control for uploaded assets — filenames are unique, so cache forever. */
    public const CACHE_FOREVER = 'public, max-age=31536000, immutable';

    public static function url(?string $key): ?string
    {
        if (! $key) {
            return null;
        }

        // Object keys live under the `public/` prefix; CDN/stream paths are relative to it.
        $rel = str_starts_with($key, 'public/') ? substr($key, strlen('public/')) : ltrim($key, '/');

        // --- CDN: origin is `<bucket>/public`, so emit the path relative to it. ---
        $cdn = config('filesystems.disks.wasabi.cdn_url');
        if ($cdn) {
            return rtrim($cdn, '/').'/'.$rel;
        }

        // --- Fallback: stream through the app. ---
        return url('assets/'.$rel);
    }
}
