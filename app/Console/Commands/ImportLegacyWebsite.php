<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Models\SitePage;
use App\Models\Studio;
use App\Models\User;
use App\Support\PublicAsset;
use App\Support\SiteTemplates;
use App\Support\StudioPaths;
use Illuminate\Console\Command;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * One-off importer that scrapes a legacy WordPress photography site and fills in
 * the studio's site-builder site: the homepage gallery, the portfolio gallery,
 * and the blog posts. Every image is re-hosted to Wasabi at its ORIGINAL size
 * (WordPress's "-WIDTHxHEIGHT" suffix is stripped to fetch the full upload).
 *
 * Idempotent: imported blocks/pages are tagged and replaced on re-run.
 *
 *   php artisan site:import-legacy jack@mccourtphotography.co.uk
 *   php artisan site:import-legacy jack@mccourtphotography.co.uk --url=https://mccourtphotography.co.uk --no-blog
 */
class ImportLegacyWebsite extends Command
{
    protected $signature = 'site:import-legacy
        {email : The studio user whose website to fill in}
        {--url=https://mccourtphotography.co.uk : The legacy site root}
        {--portfolio-path=/our-portfolio/ : Path to the portfolio page}
        {--max-posts=200 : Max blog posts to import}
        {--no-home : Skip the homepage gallery}
        {--no-portfolio : Skip the portfolio gallery}
        {--no-blog : Skip blog posts}';

    protected $description = 'Scrape a legacy WordPress site into this studio\'s website (home gallery, portfolio, blog) at original image size.';

    private int $studioId;

    private string $root;

    /** source-url (normalized) => re-hosted Wasabi URL */
    private array $cache = [];

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();
        if (! $user || ! $user->studio_id) {
            $this->error("No user / studio found for {$this->argument('email')}.");

            return self::FAILURE;
        }

        $this->studioId = $user->studio_id;
        $this->root = rtrim($this->option('url'), '/');
        app()->instance('current.studio.id', $this->studioId);

        $studio = Studio::findOrFail($this->studioId);

        // Guard: the source may sit behind a Cloudflare bot challenge that a plain
        // HTTP client can't solve. Bail with actionable instructions rather than
        // silently importing nothing.
        if ($this->isChallenge($this->get($this->root.'/')?->body())) {
            $ip = @file_get_contents('https://api.ipify.org') ?: 'this server';
            $this->error('The source site is behind a Cloudflare bot challenge — it will not serve content to this server.');
            $this->line('Fix one of these on the source site\'s Cloudflare, then re-run:');
            $this->line("  • Allowlist this server's IP ({$ip}): Security → WAF → Tools → IP Access Rules → Allow.");
            $this->line('  • Or temporarily turn off "Under Attack Mode" / set Security Level to Essentially Off.');

            return self::FAILURE;
        }

        $site = $this->resolveSite($studio);
        $this->info("Importing {$this->root} → studio #{$this->studioId} ({$studio->name}), site #{$site->id}");

        if (! $this->option('no-home')) {
            $this->importHomeGallery($site);
        }
        if (! $this->option('no-portfolio')) {
            $this->importPortfolioGallery($site);
        }
        if (! $this->option('no-blog')) {
            $this->importBlog($site);
        }

        $this->newLine();
        $this->info('Done. Open the website builder to review, then publish.');

        return self::SUCCESS;
    }

    // ── Homepage gallery ────────────────────────────────────────────────────

    private function importHomeGallery(Site $site): void
    {
        $this->line('• Homepage gallery…');
        $urls = $this->rehostMany($this->scrapeImageUrls($this->root.'/'));
        if (! $urls) {
            $this->warn('  no images found on the homepage.');

            return;
        }

        $page = $site->pages()->where('is_home', true)->first()
            ?? $this->createPage($site, 'Home', 'home', ['is_home' => true]);

        $this->setImportedBlocks($page, [
            $this->galleryBlock('Gallery', $urls),
        ]);
        $this->info('  imported '.count($urls).' images into the home gallery.');
    }

    // ── Portfolio gallery ───────────────────────────────────────────────────

    private function importPortfolioGallery(Site $site): void
    {
        $this->line('• Portfolio gallery…');
        $urls = $this->rehostMany($this->scrapeImageUrls($this->root.$this->option('portfolio-path')));
        if (! $urls) {
            $this->warn('  no images found on the portfolio page.');

            return;
        }

        $page = $this->findPage($site, ['our-portfolio', 'portfolio'])
            ?? $this->createPage($site, 'Portfolio', 'portfolio');

        $this->setImportedBlocks($page, [
            $this->galleryBlock('Portfolio', $urls),
        ]);
        $this->info('  imported '.count($urls).' images into the portfolio.');
    }

    // ── Blog ────────────────────────────────────────────────────────────────

    private function importBlog(Site $site): void
    {
        $this->line('• Blog posts (WordPress REST API)…');
        $posts = $this->fetchPosts();
        if (! $posts) {
            $this->warn('  no posts returned from /wp-json/wp/v2/posts.');

            return;
        }

        $position = (int) $site->pages()->max('position');
        foreach ($posts as $post) {
            $title = $this->decode($post['title']['rendered'] ?? 'Untitled');
            $slug = $post['slug'] ?? Str::slug($title);
            $this->line("  - {$title}");

            $cover = null;
            $featured = data_get($post, '_embedded.wp:featuredmedia.0.source_url');
            if ($featured) {
                $cover = $this->rehost($featured);
            }

            // Re-host every inline image in the body, rewriting the HTML to point
            // at the new Wasabi copies, then keep the prose as an embed block.
            [$html, $bodyImages] = $this->rewriteBodyImages($post['content']['rendered'] ?? '');
            if (! $cover && $bodyImages) {
                $cover = $bodyImages[0];
            }

            $blocks = [];
            if ($html !== '') {
                $blocks[] = $this->block('embed', ['html' => $html]);
            } elseif ($bodyImages) {
                $blocks[] = $this->galleryBlock('', $bodyImages);
            }

            $page = $this->findPage($site, [$slug]) ?? new SitePage([
                'studio_id' => $this->studioId,
                'site_id' => $site->id,
                'slug' => $this->uniquePageSlug($site, $slug),
            ]);

            $page->fill([
                'studio_id' => $this->studioId,
                'site_id' => $site->id,
                'title' => $title,
                'is_blog' => true,
                'status' => 'published',
                'published_at' => $this->date($post['date'] ?? null),
                'excerpt' => Str::limit(trim(html_entity_decode(strip_tags($post['excerpt']['rendered'] ?? ''))), 280),
                'category' => data_get($post, '_embedded.wp:term.0.0.name'),
                'cover_image' => $cover,
                'blocks' => $blocks, // each already tagged _imported via block()
            ]);
            if (! $page->exists) {
                $page->position = ++$position;
            }
            $page->save();
        }

        $this->info('  imported '.count($posts).' blog posts.');
    }

    /** Page through the WP REST API for all published posts (newest first). */
    private function fetchPosts(): array
    {
        $all = [];
        $max = (int) $this->option('max-posts');
        for ($pageNo = 1; $pageNo <= 20; $pageNo++) {
            $res = Http::withHeaders(['User-Agent' => 'Mozilla/5.0'])->timeout(60)
                ->get($this->root.'/wp-json/wp/v2/posts', ['per_page' => 50, 'page' => $pageNo, '_embed' => 1]);
            if (! $res->successful()) {
                break;
            }
            $batch = $res->json();
            if (! is_array($batch) || ! $batch) {
                break;
            }
            $all = array_merge($all, $batch);
            if (count($all) >= $max || count($batch) < 50) {
                break;
            }
        }

        return array_slice($all, 0, $max);
    }

    // ── Scraping ─────────────────────────────────────────────────────────────

    /**
     * Distinct photos on a page, in document order. Prefers images inside the
     * theme's `.masonry-grid` gallery containers; falls back to every
     * /wp-content/uploads/ URL in the markup.
     */
    private function scrapeImageUrls(string $url): array
    {
        $res = $this->get($url);
        if (! $res || ! $res->successful()) {
            $this->warn("  could not fetch {$url} (".($res?->status() ?? 'no response').').');

            return [];
        }
        $html = $res->body();
        if ($this->isChallenge($html)) {
            $this->warn('  blocked by a Cloudflare challenge — see the instructions above.');

            return [];
        }

        $candidates = $this->imagesInMasonry($html) ?: $this->uploadsInHtml($html);

        $seen = [];
        $ordered = [];
        foreach ($candidates as $raw) {
            $raw = html_entity_decode($raw);
            if (! preg_match('#/wp-content/uploads/#', $raw)) {
                continue;
            }
            $key = $this->dedupeKey($raw);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $ordered[] = $raw;
        }

        return $ordered;
    }

    /** Image URLs found inside elements whose class contains "masonry-grid". */
    private function imagesInMasonry(string $html): array
    {
        $doc = new \DOMDocument;
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        $xp = new \DOMXPath($doc);

        $urls = [];
        $grids = $xp->query("//*[contains(concat(' ', normalize-space(@class), ' '), ' masonry-grid ') or contains(@class,'masonry-grid')]");
        foreach ($grids as $grid) {
            // Links to the full-size image first, then the <img> sources.
            foreach ($xp->query('.//a[@href]', $grid) as $a) {
                $urls[] = $a->getAttribute('href');
            }
            foreach ($xp->query('.//img', $grid) as $img) {
                /** @var \DOMElement $img */
                foreach (['data-src', 'data-lazy-src', 'data-original', 'src'] as $attr) {
                    if ($v = $img->getAttribute($attr)) {
                        $urls[] = $v;
                        break;
                    }
                }
                if ($ss = $img->getAttribute('srcset')) {
                    if ($best = $this->largestSrcset($ss)) {
                        $urls[] = $best;
                    }
                }
            }
        }

        return $urls;
    }

    /** Fallback: every uploads URL anywhere in the markup. */
    private function uploadsInHtml(string $html): array
    {
        preg_match_all(
            '#https?:(?:\\\\/|/)+[^\s"\'<>\\\\)]+/wp-content/uploads/[^\s"\'<>\\\\)]+?\.(?:jpe?g|png|webp|gif)#i',
            $html,
            $m,
        );

        return array_map(fn ($u) => str_replace('\\/', '/', $u), $m[0]);
    }

    private function get(string $url): ?Response
    {
        try {
            return Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
                'Accept' => 'text/html,application/xhtml+xml,application/json,*/*',
            ])->timeout(60)->get($url);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Detect a Cloudflare / generic JS bot-challenge interstitial. */
    private function isChallenge(?string $body): bool
    {
        if ($body === null || $body === '') {
            return true;
        }

        return (bool) preg_match('/One moment, please|Just a moment|cf-browser-verification|cf_chl_|Checking if the site connection is secure|Enable JavaScript and cookies to continue/i', $body)
            // a tiny page that immediately reloads itself is the tell-tale shell.
            || (strlen($body) < 4000 && str_contains($body, 'window.location.reload'));
    }

    // ── Image re-hosting (original size) ─────────────────────────────────────

    /** @param string[] $urls @return string[] re-hosted URLs */
    private function rehostMany(array $urls): array
    {
        $out = [];
        $bar = $this->output->createProgressBar(count($urls));
        foreach ($urls as $u) {
            if ($new = $this->rehost($u)) {
                $out[] = $new;
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();

        return $out;
    }

    /** Download the original-size image and store it in Wasabi; cached per source. */
    private function rehost(string $srcUrl): ?string
    {
        $key = $this->dedupeKey($srcUrl);
        if (array_key_exists($key, $this->cache)) {
            return $this->cache[$key];
        }

        foreach ($this->originalCandidates($srcUrl) as $candidate) {
            try {
                $res = Http::withHeaders(['User-Agent' => 'Mozilla/5.0'])->timeout(120)->get($candidate);
                if (! $res->successful() || ! str_starts_with((string) $res->header('Content-Type'), 'image')) {
                    continue;
                }
                $ext = strtolower(pathinfo(parse_url($candidate, PHP_URL_PATH), PATHINFO_EXTENSION)) ?: 'jpg';
                $dest = StudioPaths::asset($this->studioId, 'site/import/'.Str::uuid().'.'.$ext);
                Storage::disk('wasabi')->put($dest, $res->body(), 'public');

                return $this->cache[$key] = PublicAsset::url($dest);
            } catch (\Throwable $e) {
                // try the next candidate
            }
        }

        $this->warn("  failed to fetch image: {$srcUrl}");

        return $this->cache[$key] = null;
    }

    /**
     * Candidate URLs from most-original to least, so we grab the full upload when
     * it exists and gracefully fall back to whatever resolves.
     *
     * @return string[]
     */
    private function originalCandidates(string $u): array
    {
        $candidates = [
            preg_replace('/-\d+x\d+(?=\.\w+($|\?))/', '', $u),      // name-1920x1280.jpg → name.jpg
            preg_replace('/-\d+x\d+/', '', $u),                      // handles name-768x512-optimized.jpg
            preg_replace('/-\d+x\d+(?=\.\w+($|\?))/', '-scaled', $u), // very large uploads: -scaled.jpg
            $u,
        ];

        return array_values(array_unique(array_filter($candidates)));
    }

    /** Collapse all responsive sizes of one photo to a single identity. */
    private function dedupeKey(string $u): string
    {
        $u = preg_replace('/\?.*$/', '', $u);
        $u = preg_replace('/-\d+x\d+/', '', $u);
        $u = preg_replace('/-(scaled|optimized|topaz[\w-]*)/i', '', $u);

        return strtolower($u);
    }

    /** Re-host inline <img>s in post HTML; returns [rewrittenHtml, [newUrls]]. */
    private function rewriteBodyImages(string $html): array
    {
        if (trim($html) === '') {
            return ['', []];
        }

        $doc = new \DOMDocument;
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="UTF-8"><div>'.$html.'</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        $newUrls = [];
        foreach (iterator_to_array($doc->getElementsByTagName('img')) as $img) {
            /** @var \DOMElement $img */
            $src = $img->getAttribute('src');
            // Prefer the largest srcset candidate if present.
            if ($srcset = $img->getAttribute('srcset')) {
                $best = $this->largestSrcset($srcset);
                $src = $best ?: $src;
            }
            if (! $src || ! str_contains($src, '/wp-content/uploads/')) {
                continue;
            }
            if ($new = $this->rehost($src)) {
                $img->setAttribute('src', $new);
                $img->removeAttribute('srcset');
                $img->removeAttribute('sizes');
                $img->setAttribute('loading', 'lazy');
                $newUrls[] = $new;
            }
        }

        // Drop scripts/styles that came along for the ride.
        foreach (['script', 'style'] as $tag) {
            foreach (iterator_to_array($doc->getElementsByTagName($tag)) as $node) {
                $node->parentNode?->removeChild($node);
            }
        }

        $wrapper = $doc->getElementsByTagName('div')->item(0);
        $out = '';
        if ($wrapper) {
            foreach ($wrapper->childNodes as $child) {
                $out .= $doc->saveHTML($child);
            }
        }

        return [trim($out), $newUrls];
    }

    private function largestSrcset(string $srcset): ?string
    {
        $best = null;
        $bestW = -1;
        foreach (explode(',', $srcset) as $part) {
            $bits = preg_split('/\s+/', trim($part));
            $url = $bits[0] ?? '';
            $w = isset($bits[1]) ? (int) rtrim($bits[1], 'w') : 0;
            if ($url && $w > $bestW) {
                $bestW = $w;
                $best = $url;
            }
        }

        return $best;
    }

    // ── Site / page helpers ──────────────────────────────────────────────────

    private function resolveSite(Studio $studio): Site
    {
        $site = Site::where('studio_id', $studio->id)->first();
        if ($site) {
            return $site;
        }

        return DB::transaction(function () use ($studio) {
            $site = Site::create([
                'studio_id' => $studio->id,
                'name' => $studio->name ?: 'My Studio',
                'slug' => Str::slug(($studio->slug ?: $studio->name ?: 'studio')).'-'.Str::lower(Str::random(4)),
                'template' => SiteTemplates::DEFAULT,
                'theme' => SiteTemplates::theme(SiteTemplates::DEFAULT),
                'header_nav' => SiteTemplates::headerNav(SiteTemplates::DEFAULT),
                'footer_nav' => SiteTemplates::footerNav(SiteTemplates::DEFAULT),
                'contact_email' => $studio->email,
                'is_published' => false,
            ]);
            $this->createPage($site, 'Home', 'home', ['is_home' => true]);

            return $site;
        });
    }

    /** @param string[] $slugs */
    private function findPage(Site $site, array $slugs): ?SitePage
    {
        return $site->pages()->whereIn('slug', $slugs)->first();
    }

    private function createPage(Site $site, string $title, string $slug, array $extra = []): SitePage
    {
        return $site->pages()->create(array_merge([
            'studio_id' => $this->studioId,
            'title' => $title,
            'slug' => $this->uniquePageSlug($site, $slug),
            'position' => (int) $site->pages()->max('position') + 1,
            'status' => 'published',
            'blocks' => [],
        ], $extra));
    }

    private function uniquePageSlug(Site $site, string $slug): string
    {
        $slug = Str::slug($slug) ?: 'page';
        $base = $slug;
        $i = 2;
        while ($site->pages()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /** Replace this page's previously-imported blocks, keeping any hand-made ones. */
    private function setImportedBlocks(SitePage $page, array $blocks): void
    {
        $kept = collect($page->blocks ?? [])->reject(fn ($b) => data_get($b, 'data._imported'))->values()->all();
        $page->blocks = array_merge($kept, $blocks);
        $page->save();
    }

    /** @param string[] $images */
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
        return [
            'id' => (string) Str::uuid(),
            'type' => $type,
            'data' => $data + ['_imported' => true],
        ];
    }

    private function decode(string $s): string
    {
        return trim(html_entity_decode($s, ENT_QUOTES | ENT_HTML5));
    }

    private function date(?string $iso): ?string
    {
        return $iso ? Carbon::parse($iso)->toDateTimeString() : null;
    }
}
