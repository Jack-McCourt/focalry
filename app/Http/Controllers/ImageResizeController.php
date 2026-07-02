<?php

namespace App\Http\Controllers;

use App\Support\ImageDerivatives;
use App\Support\PublicAsset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * On-the-fly responsive image derivatives for the website builder. Given one of
 * our own public asset URLs and a target width, it generates a width-capped WebP
 * (once), caches it to Wasabi, and 302-redirects to the CDN copy with an
 * immutable cache header — so the browser caches the redirect and every later
 * load goes straight to the edge, skipping PHP entirely.
 *
 * Only our own public bucket assets are resizable (validated in ImageDerivatives),
 * so this is not an open image proxy. Pre-warm with: php artisan images:warm-derivatives
 */
class ImageResizeController extends Controller
{
    public function show(Request $request): RedirectResponse
    {
        $width = (int) $request->query('w');
        abort_unless(in_array($width, ImageDerivatives::WIDTHS, true), 404);

        $rel = ImageDerivatives::relPath((string) $request->query('src'));
        abort_if($rel === null, 404);

        $key = ImageDerivatives::ensure($rel, $width);

        // Fall back to the original on any failure — never break the image.
        $url = PublicAsset::url($key ?? 'public/'.$rel);

        return redirect()->away($url, 302, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
