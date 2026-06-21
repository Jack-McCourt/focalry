<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Support\PhotoArchive;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class StoreDownloadController extends Controller
{
    /**
     * Deliver a purchased digital download. Gated by the unguessable per-item
     * token and a paid order. Resolution honours the product's digital_resolution.
     */
    public function download(string $token, PhotoArchive $archive): BinaryFileResponse
    {
        $item = OrderItem::withoutGlobalScopes()
            ->with(['order', 'photo'])
            ->where('download_token', $token)
            ->where('fulfilment', 'digital')
            ->firstOrFail();

        abort_unless($item->order && $item->order->isPaid(), 403, 'This order has not been paid.');
        abort_unless($item->photo, 404, 'File unavailable.');

        $key = $this->resolveKey($item);
        abort_unless($key, 404, 'File unavailable.');

        $item->increment('download_count');

        return $archive->file($key, $item->photo->filename);
    }

    private function resolveKey(OrderItem $item): ?string
    {
        $photo = $item->photo;

        return match ($item->digital_resolution) {
            'original' => $photo->wasabi_key_original,
            'web' => $photo->derivativeKey('web') ?? $photo->wasabi_key_original,
            default => $photo->derivativeKey('print')
                ?? $photo->derivativeKey('web')
                ?? $photo->wasabi_key_original,
        };
    }
}
