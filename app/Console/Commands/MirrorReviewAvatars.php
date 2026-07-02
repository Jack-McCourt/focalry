<?php

namespace App\Console\Commands;

use App\Models\SitePage;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Copy Google reviewer avatars (lh3.googleusercontent.com) already saved in
 * reviews blocks into our own Wasabi bucket and rewrite the URLs. Serving them
 * first-party removes the third-party cookies Google's image host sets — a
 * Lighthouse "best practices" flag. New review pulls are mirrored automatically
 * by SiteController::googleReviews(); this fixes existing published data.
 */
class MirrorReviewAvatars extends Command
{
    protected $signature = 'reviews:mirror-avatars';

    protected $description = 'Mirror Google reviewer avatars into Wasabi and rewrite block URLs (first-party).';

    public function handle(): int
    {
        $pages = SitePage::withoutGlobalScopes()->whereNotNull('blocks')->get();
        $count = 0;

        foreach ($pages as $page) {
            $changed = false;
            $blocks = $this->walk($page->blocks ?? [], (int) $page->studio_id, $changed, $count);
            if ($changed) {
                $page->blocks = $blocks;
                $page->save();
            }
        }

        $this->info("Mirrored {$count} reviewer avatar(s).");

        return self::SUCCESS;
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     * @return array<int, array<string, mixed>>
     */
    private function walk(array $blocks, int $studioId, bool &$changed, int &$count): array
    {
        foreach ($blocks as &$block) {
            if (($block['type'] ?? '') === 'reviews' && is_array($block['data']['reviews'] ?? null)) {
                foreach ($block['data']['reviews'] as &$review) {
                    $url = $review['avatar'] ?? null;
                    if ($url && str_contains((string) $url, 'googleusercontent.com')) {
                        $mirrored = $this->mirror($studioId, (string) $url);
                        if ($mirrored) {
                            $review['avatar'] = $mirrored;
                            $changed = true;
                            $count++;
                        }
                    }
                }
                unset($review);
            }

            // Grid blocks nest child blocks in per-column arrays.
            if (is_array($block['children'] ?? null)) {
                foreach ($block['children'] as &$col) {
                    if (is_array($col)) {
                        $col = $this->walk($col, $studioId, $changed, $count);
                    }
                }
                unset($col);
            }
        }
        unset($block);

        return $blocks;
    }

    private function mirror(int $studioId, string $url): ?string
    {
        try {
            $response = Http::timeout(8)->get($url);
            if ($response->failed()) {
                return null;
            }

            $path = StudioPaths::asset($studioId, 'site/reviews/'.md5($url).'.jpg');
            Storage::disk('wasabi')->put($path, $response->body(), ['visibility' => 'public', 'CacheControl' => 'public, max-age=31536000, immutable']);

            return PublicAsset::url($path);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
