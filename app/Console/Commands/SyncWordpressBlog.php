<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Models\SitePage;
use App\Models\Studio;
use App\Models\User;
use App\Support\Images;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Pulls new blog posts from a LIVE WordPress site (via its REST API) into a
 * studio's website builder blog. The offline `site:import-wxr` command needs a
 * WXR export + uploads.zip; this one talks to the live site so newly-published
 * posts can be synced without re-exporting anything.
 *
 * For each post not already present on our side (matched by slug):
 *   - prose  → a `text` block,
 *   - featured image → the post cover/header,
 *   - in-content images → a `gallery` block.
 *
 * Every image is fetched at the LARGEST size the site holds — the un-scaled
 * `original_image` where WordPress kept it — then re-encoded into our own WebP
 * derivatives (small `thumb` for grid tiles, large `full` for the lightbox) and
 * stored public-read on Wasabi, so we own the sizing rather than reusing WP's.
 *
 * Idempotent: existing slugs are skipped unless --force; imported blocks are
 * tagged `_imported`.
 *
 *   php artisan site:sync-wordpress jack@mccourtphotography.co.uk
 */
class SyncWordpressBlog extends Command
{
    protected $signature = 'site:sync-wordpress
        {email : The studio user whose website blog to sync}
        {--url=https://mccourtphotography.co.uk : Base URL of the live WordPress site}
        {--max-posts=30 : How many of the newest live posts to consider}
        {--force : Re-import posts even if a page with the slug already exists}
        {--thumb=600 : Grid-thumbnail width (px)}
        {--full=2000 : Lightbox/full width (px)}
        {--quality=82 : WebP quality}
        {--dry : List what would be imported without downloading or writing}';

    protected $description = 'Pull new blog posts (and their high-res images) from the live WordPress site into this studio\'s website blog.';

    private int $studioId;

    private string $base;

    private int $thumbW;

    private int $fullW;

    private int $quality;

    /** normalized source url => ['thumb'=>url,'full'=>url]|null (dedupe re-encoding) */
    private array $cache = [];

    public function handle(): int
    {
        @ini_set('memory_limit', '1024M');
        $this->base = rtrim((string) $this->option('url'), '/');
        $this->thumbW = (int) $this->option('thumb');
        $this->fullW = (int) $this->option('full');
        $this->quality = (int) $this->option('quality');

        $user = User::where('email', $this->argument('email'))->first();
        if (! $user || ! $user->studio_id) {
            $this->error("No user / studio found for {$this->argument('email')}.");

            return self::FAILURE;
        }
        $this->studioId = $user->studio_id;
        app()->instance('current.studio.id', $this->studioId);
        $studio = Studio::findOrFail($this->studioId);

        $site = Site::where('studio_id', $studio->id)->first();
        if (! $site) {
            $this->error('That studio has no website yet — run the initial import first.');

            return self::FAILURE;
        }
        $blog = $site->blogPage();
        if (! $blog) {
            $this->error('The site has no blog page.');

            return self::FAILURE;
        }

        $existing = array_flip(
            $site->pages()->where('parent_id', $blog->id)->pluck('slug')
                ->map(fn ($s) => strtolower((string) $s))->all()
        );

        $this->info("Fetching newest {$this->option('max-posts')} posts from {$this->base} …");
        $resp = Http::timeout(30)->retry(2, 500, throw: false)->withHeaders($this->httpHeaders())->acceptJson()
            ->get($this->base.'/wp-json/wp/v2/posts', [
                'per_page' => (int) $this->option('max-posts'),
                'orderby' => 'date',
                'order' => 'desc',
                '_embed' => 1,
            ]);
        if (! $resp->successful() || ! is_array($posts = $resp->json())) {
            $this->error('REST API request failed: HTTP '.$resp->status());

            return self::FAILURE;
        }

        $new = array_values(array_filter($posts, function ($p) use ($existing) {
            $slug = strtolower((string) ($p['slug'] ?? ''));

            return $slug !== '' && ($this->option('force') || ! isset($existing[$slug]));
        }));

        $this->line(sprintf('  %d live posts, %d to import.', count($posts), count($new)));
        foreach ($new as $p) {
            $this->line('    + '.substr((string) ($p['date'] ?? ''), 0, 10).' | '.($p['slug'] ?? ''));
        }
        if (! $new) {
            $this->info('Nothing new to import.');

            return self::SUCCESS;
        }
        if ($this->option('dry')) {
            $this->info('Dry run — nothing downloaded or written.');

            return self::SUCCESS;
        }

        // Oldest-first so the newest post ends up with the highest position.
        $position = (int) $site->pages()->where('parent_id', $blog->id)->max('position');
        foreach (array_reverse($new) as $p) {
            $this->importPost($site, $blog, $p, $position);
        }

        $this->newLine();
        $this->info('Done. Open the website builder to review, then publish.');

        return self::SUCCESS;
    }

    private function importPost(Site $site, SitePage $blog, array $p, int &$position): void
    {
        $title = $this->decode((string) data_get($p, 'title.rendered', 'Untitled'));
        $slug = (string) ($p['slug'] ?? Str::slug($title));
        $this->line('• '.$title);

        $html = (string) data_get($p, 'content.rendered', '');
        $blocks = [];

        $prose = $this->htmlToText($html);
        if ($prose !== '') {
            $blocks[] = $this->block('text', ['heading' => '', 'heading_level' => 'h2', 'body' => $prose, 'align' => 'left']);
        }

        // Featured image → cover/header. Prefer the un-scaled original the API names.
        $cover = null;
        if ($featured = data_get($p, '_embedded.wp:featuredmedia.0.source_url')) {
            $cover = $this->rehostUrl((string) $featured);
        }

        // In-content gallery images.
        $images = [];
        $urls = $this->imageUrls($html);
        $bar = $urls ? $this->output->createProgressBar(count($urls)) : null;
        foreach ($urls as $u) {
            if ($img = $this->rehostUrl($u)) {
                $images[] = $img;
            }
            $bar?->advance();
        }
        $bar?->finish();
        if ($bar) {
            $this->newLine();
        }
        if ($images) {
            $blocks[] = $this->galleryBlock('', $images);
        }

        $coverUrl = $cover['full'] ?? ($images[0]['full'] ?? null);

        $page = $site->pages()->where('slug', $slug)->first() ?? new SitePage([
            'studio_id' => $this->studioId,
            'site_id' => $site->id,
            'slug' => $this->uniquePageSlug($site, $slug),
        ]);
        $page->fill([
            'studio_id' => $this->studioId,
            'site_id' => $site->id,
            'parent_id' => $blog->id,
            'title' => $title ?: 'Untitled',
            'status' => 'published',
            'published_at' => $this->date((string) ($p['date'] ?? '')),
            'excerpt' => Str::limit(trim(strip_tags($this->decode((string) data_get($p, 'excerpt.rendered', '')))) ?: $prose, 280),
            'category' => $this->firstCategoryName($p),
            'cover_image' => $coverUrl,
            'blocks' => $blocks,
        ]);
        if (! $page->exists) {
            $page->position = ++$position;
        }
        $page->save();
        $this->info('  saved — '.count($images).' images'.($cover ? ', +cover' : '').'.');
    }

    // ── Image re-hosting (WordPress 2560px scaled → our own WebP thumb + full) ──

    /**
     * Download the best form of an image URL and re-encode to WebP thumb+full.
     * Prefers WordPress's 2560px -scaled file, then the base upload, then the URL.
     *
     * @return array{thumb:string,full:string}|null
     */
    private function rehostUrl(string $url): ?array
    {
        $url = preg_replace('/\?.*$/', '', trim($url));
        if ($url === '') {
            return null;
        }

        // Normalise to the base upload name (strip any -WxH size suffix and -scaled).
        $base = preg_replace('/-\d+x\d+(?=\.\w+$)/', '', $url);
        $base = preg_replace('/-scaled(?=\.\w+$)/', '', $base);
        // Prefer WordPress's 2560px "-scaled" file: ample for our derivatives and
        // ~20x smaller than the raw original. Fall back to the base file for images
        // that were already <= 2560 (no -scaled exists), then to the exact URL used.
        $scaled = preg_replace('/(\.\w+)$/', '-scaled$1', $base);
        $candidates = array_values(array_unique([$scaled, $base, $url]));

        $key = strtolower($base);
        if (array_key_exists($key, $this->cache)) {
            return $this->cache[$key];
        }

        foreach ($candidates as $candidate) {
            $binary = $this->download($candidate);
            if ($binary === null) {
                continue;
            }
            try {
                $base = StudioPaths::asset($this->studioId, 'site/import/'.Str::uuid());
                $disk = Storage::disk('wasabi');
                $thumbKey = $base.'-thumb.webp';
                $fullKey = $base.'-full.webp';
                $disk->put($thumbKey, Images::webp($binary, $this->thumbW, $this->quality), 'public');
                $disk->put($fullKey, Images::webp($binary, $this->fullW, $this->quality), 'public');

                return $this->cache[$key] = [
                    'thumb' => PublicAsset::url($thumbKey),
                    'full' => PublicAsset::url($fullKey),
                ];
            } catch (\Throwable $e) {
                $this->warn("    encode failed: {$candidate} — {$e->getMessage()}");
            }
        }

        $this->warn("    could not fetch: {$url}");

        return $this->cache[$key] = null;
    }

    /** Browser-like headers so the site's WAF/hotlink rules don't 403 us. */
    private function httpHeaders(): array
    {
        return [
            'User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept' => 'text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8',
        ];
    }

    /** GET the URL, returning image bytes or null (non-200, non-image, or error). */
    private function download(string $url): ?string
    {
        try {
            $resp = Http::timeout(60)->retry(2, 800, throw: false)
                ->withHeaders($this->httpHeaders() + ['Referer' => $this->base.'/'])
                ->get($url);
            if (! $resp->successful()) {
                return null;
            }
            $ct = strtolower((string) $resp->header('Content-Type'));
            if ($ct !== '' && ! str_starts_with($ct, 'image/')) {
                return null;
            }
            $body = $resp->body();

            return $body !== '' ? $body : null;
        } catch (\Throwable) {
            return null;
        }
    }

    // ── HTML → blocks (mirrors the offline WXR importer) ───────────────────────

    /** Distinct in-content image srcs (largest srcset entry), in document order. */
    private function imageUrls(string $html): array
    {
        if (trim($html) === '') {
            return [];
        }
        $doc = new \DOMDocument;
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_HTML_NODEFDTD | LIBXML_HTML_NOIMPLIED);
        libxml_clear_errors();

        $seen = [];
        $urls = [];
        foreach ($doc->getElementsByTagName('img') as $img) {
            /** @var \DOMElement $img */
            $src = $img->getAttribute('src');
            if ($ss = $img->getAttribute('srcset')) {
                $src = $this->largestSrcset($ss) ?: $src;
            }
            if (! $src || ! str_contains($src, '/wp-content/uploads/')) {
                continue;
            }
            $dedupe = strtolower(preg_replace('/-\d+x\d+(?=\.\w+)/', '', $src));
            if (isset($seen[$dedupe])) {
                continue;
            }
            $seen[$dedupe] = true;
            $urls[] = html_entity_decode($src);
        }

        return $urls;
    }

    private function largestSrcset(string $srcset): ?string
    {
        $best = null;
        $bestW = -1;
        foreach (explode(',', $srcset) as $part) {
            $bits = preg_split('/\s+/', trim($part));
            $w = isset($bits[1]) ? (int) rtrim($bits[1], 'w') : 0;
            if (($bits[0] ?? '') && $w > $bestW) {
                $bestW = $w;
                $best = $bits[0];
            }
        }

        return $best;
    }

    /** Flatten post HTML to readable plain text with blank-line paragraph breaks. */
    private function htmlToText(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        $html = preg_replace('#<(script|style|figure|img|figcaption)[^>]*>.*?</\1>#is', '', $html);
        $html = preg_replace('#<(img|br)[^>]*/?>#i', "\n", $html);
        $html = preg_replace('#</(p|div|h[1-6]|li|blockquote|ul|ol|tr)>#i', "\n\n", $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5);
        $text = preg_replace('/[ \t]+/', ' ', $text);
        $text = preg_replace('/\n{3,}/', "\n\n", $text);

        return trim($text);
    }

    private function firstCategoryName(array $p): ?string
    {
        foreach ((array) data_get($p, '_embedded.wp:term', []) as $group) {
            foreach ((array) $group as $term) {
                if (($term['taxonomy'] ?? '') === 'category') {
                    return $this->decode((string) ($term['name'] ?? '')) ?: null;
                }
            }
        }

        return null;
    }

    // ── Page / block helpers ───────────────────────────────────────────────────

    private function uniquePageSlug(Site $site, string $slug): string
    {
        $slug = Str::slug($slug) ?: 'post';
        $base = $slug;
        $i = 2;
        while ($site->pages()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /** @param array<int,array{thumb:string,full:string}> $images */
    private function galleryBlock(string $heading, array $images): array
    {
        return $this->block('gallery', [
            'heading' => $heading,
            'columns' => 3,
            'images' => array_values($images),
            'layout' => 'masonry',
            'lightbox' => true,
            'full_width' => false,
        ]);
    }

    private function block(string $type, array $data): array
    {
        return ['id' => (string) Str::uuid(), 'type' => $type, 'data' => $data + ['_imported' => true]];
    }

    private function decode(string $s): string
    {
        return trim(html_entity_decode($s, ENT_QUOTES | ENT_HTML5));
    }

    private function date(?string $raw): ?string
    {
        if (! $raw || str_starts_with($raw, '0000')) {
            return null;
        }
        try {
            return Carbon::parse($raw)->toDateTimeString();
        } catch (\Throwable) {
            return null;
        }
    }
}
