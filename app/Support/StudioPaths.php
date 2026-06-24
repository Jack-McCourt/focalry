<?php

namespace App\Support;

/**
 * Single source of truth for studio-scoped storage keys. Public assets all live
 * under the `public/` prefix (served via the CDN); private originals/derivatives
 * sit outside it. Keeping the prefix here prevents drift across the dozen-odd
 * upload call sites.
 */
class StudioPaths
{
    /** Public-prefix directory/key for a studio asset: public/studios/{id}[/suffix]. */
    public static function asset(int|string $studioId, string $suffix = ''): string
    {
        $base = "public/studios/{$studioId}";

        return $suffix === '' ? $base : $base.'/'.ltrim($suffix, '/');
    }
}
