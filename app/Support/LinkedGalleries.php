<?php

namespace App\Support;

use App\Jobs\ImportSiteImage;
use App\Models\Photo;
use App\Models\Site;
use App\Models\SitePage;
use Illuminate\Support\Facades\Storage;

/**
 * "Live-linked" gallery blocks: instead of hand-picked copies, a gallery block
 * can reference a client-gallery Collection (`linked_collection_id`) and mirror
 * its ready photos. Each photo gets a deterministic public copy
 * (site/gallery/linked/{collection}/{photo}.webp), so syncing is idempotent —
 * new photos get queued for conversion, removed ones drop out of the list.
 *
 * Used by the builder's "Sync now", by Publish, and by the nightly
 * site:sync-linked-galleries command (which keeps live sites current).
 */
class LinkedGalleries
{
    /**
     * The public image URLs for a collection's ready photos, queueing the
     * conversion of any photo that hasn't been mirrored yet.
     *
     * @return list<string>
     */
    public static function imageUrls(int $studioId, int $collectionId): array
    {
        $photos = Photo::withoutGlobalScopes()
            ->where('studio_id', $studioId)
            ->where('collection_id', $collectionId)
            ->where('status', 'ready')
            ->orderBy('position')
            ->get();

        $disk = Storage::disk('wasabi');
        $dir = StudioPaths::asset($studioId, "site/gallery/linked/{$collectionId}");
        // One LIST call instead of an exists() per photo.
        $existing = collect($disk->files($dir))->map(fn ($f) => basename($f))->flip();

        $urls = [];
        foreach ($photos as $photo) {
            $dest = "{$dir}/{$photo->id}.webp";

            if (! isset($existing["{$photo->id}.webp"])) {
                $key = $photo->wasabi_key_original
                    ?: ($photo->derivativeKey('web') ?? $photo->derivativeKey('preview') ?? $photo->derivativeKey('thumb'));
                if (! $key) {
                    continue;
                }
                ImportSiteImage::dispatch($key, $dest, 1920);
            }

            $urls[] = PublicAsset::url($dest);
        }

        return $urls;
    }

    /**
     * Refresh every linked gallery block on the site's LIVE pages. Page writes
     * touch the site (SitePage::$touches), which busts the public-page cache.
     */
    public static function syncSiteBlocks(Site $site): void
    {
        foreach ($site->pages()->get() as $page) {
            $blocks = $page->blocks ?? [];
            $changed = false;
            $next = self::walk($blocks, (int) $site->studio_id, $changed);

            if ($changed) {
                $page->update(['blocks' => $next]);
            }
        }
    }

    /** @param  array<int, mixed>  $blocks */
    private static function walk(array $blocks, int $studioId, bool &$changed): array
    {
        foreach ($blocks as $i => $block) {
            $collectionId = (int) ($block['data']['linked_collection_id'] ?? 0);
            if (($block['type'] ?? null) === 'gallery' && $collectionId > 0) {
                $urls = self::imageUrls($studioId, $collectionId);
                if (($block['data']['images'] ?? []) !== $urls) {
                    $blocks[$i]['data']['images'] = $urls;
                    $changed = true;
                }
            }

            foreach ($block['children'] ?? [] as $c => $column) {
                if (is_array($column)) {
                    $blocks[$i]['children'][$c] = self::walk($column, $studioId, $changed);
                }
            }
        }

        return $blocks;
    }

    /** Sync every published site (the nightly command). @return int sites touched */
    public static function syncAllPublished(): int
    {
        $count = 0;
        Site::withoutGlobalScopes()->where('is_published', true)->with('pages')->chunkById(25, function ($sites) use (&$count) {
            foreach ($sites as $site) {
                self::syncSiteBlocks($site);
                $count++;
            }
        });

        return $count;
    }
}
