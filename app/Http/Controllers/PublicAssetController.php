<?php

namespace App\Http\Controllers;

use App\Support\WasabiObject;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Streams public site assets (logos, site/product/package images, attachments)
 * from Wasabi. Only the `public/` prefix is reachable, so private originals can
 * never be served here. Long, immutable cache headers let browsers/CDNs cache
 * aggressively so Wasabi is hit rarely.
 *
 * This exists because the Wasabi account currently blocks anonymous public
 * reads; once that's enabled, PublicAsset::url() can point straight at Wasabi
 * and this route becomes unused. See App\Support\PublicAsset.
 */
class PublicAssetController extends Controller
{
    public function show(string $path): BinaryFileResponse
    {
        // Constrained to the public prefix; reject any traversal attempt.
        abort_if(str_contains($path, '..'), 404);
        $key = 'public/'.ltrim($path, '/');

        // Streams to a temp file (avoids the php-fpm tempnam spill on larger
        // objects); deleted after the response is sent — nothing persists.
        try {
            $localPath = WasabiObject::toTempFile($key);
        } catch (\Throwable $e) {
            abort(404);
        }

        return response()
            ->file($localPath, ['Cache-Control' => 'public, max-age=31536000, immutable'])
            ->deleteFileAfterSend(true);
    }
}
