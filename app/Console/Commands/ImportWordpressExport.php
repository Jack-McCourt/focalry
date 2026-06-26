<?php

namespace App\Console\Commands;

use App\Models\Site;
use App\Models\SitePage;
use App\Models\Studio;
use App\Models\User;
use App\Support\Images;
use App\Support\PublicAsset;
use App\Support\SiteTemplates;
use App\Support\StudioPaths;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Imports a WordPress eXtended RSS (WXR) export + the matching uploads.zip into
 * a studio's website builder — entirely offline (no scraping the live site).
 *
 *   - Home gallery + Portfolio gallery come from the pages' ACF `gallery` field
 *     (a serialized list of attachment IDs).
 *   - Blog posts become child pages under the site's blog page: prose in a
 *     `text` block, photos in a `gallery` block, featured image as the cover.
 *
 * Every image is taken at the LARGEST size held in the export (the original,
 * preferring `_wp_attachment_metadata.original_image` over a `-scaled` file),
 * then re-encoded into our own WebP derivatives — a small `thumb` for the grid
 * tile and a large `full` for the lightbox — and stored public-read on Wasabi.
 * Files are streamed one at a time straight out of the zip, so the 13GB archive
 * never lands on local disk.
 *
 * Idempotent: imported blocks are tagged `_imported` and replaced on re-run;
 * posts are matched by slug and updated in place.
 *
 *   php artisan site:import-wxr jack@mccourtphotography.co.uk \
 *       --xml=mccourtphotography.WordPress.2026-06-25.xml --zip=uploads.zip --fresh-blog
 */
class ImportWordpressExport extends Command
{
    protected $signature = 'site:import-wxr
        {email : The studio user whose website to fill in}
        {--xml= : Path to the WordPress WXR .xml export}
        {--zip= : Path to the uploads.zip archive}
        {--home-slug=homepage : WordPress slug of the home page}
        {--portfolio-slug=our-portfolio : WordPress slug of the portfolio page}
        {--max-posts=200 : Max blog posts to import}
        {--thumb=600 : Grid-thumbnail width (px)}
        {--full=2000 : Lightbox/full width (px)}
        {--quality=82 : WebP quality}
        {--no-home : Skip the homepage gallery}
        {--no-portfolio : Skip the portfolio gallery}
        {--no-blog : Skip blog posts}
        {--fresh-blog : Delete existing posts under the blog page before importing}
        {--dry : Parse and report only — no image processing or DB writes}';

    protected $description = 'Import a WordPress WXR export + uploads.zip into this studio\'s website (home/portfolio galleries + blog) at original image size as WebP.';

    private int $studioId;

    private \ZipArchive $zip;

    /** attachment post_id => ['file' => relative upload path of the LARGEST file] */
    private array $attachments = [];

    /** resolved zip entry => ['thumb' => url, 'full' => url] (dedupe re-encoding) */
    private array $cache = [];

    private int $thumbW;

    private int $fullW;

    private int $quality;

    public function handle(): int
    {
        @ini_set('memory_limit', '1024M');

        $xmlPath = $this->option('xml') ?: base_path('mccourtphotography.WordPress.2026-06-25.xml');
        $zipPath = $this->option('zip') ?: base_path('uploads.zip');
        $this->thumbW = (int) $this->option('thumb');
        $this->fullW = (int) $this->option('full');
        $this->quality = (int) $this->option('quality');

        if (! is_file($xmlPath)) {
            $this->error("XML not found: {$xmlPath}");

            return self::FAILURE;
        }
        if (! $this->option('dry') && ! is_file($zipPath)) {
            $this->error("uploads.zip not found: {$zipPath}");

            return self::FAILURE;
        }

        $user = User::where('email', $this->argument('email'))->first();
        if (! $user || ! $user->studio_id) {
            $this->error("No user / studio found for {$this->argument('email')}.");

            return self::FAILURE;
        }
        $this->studioId = $user->studio_id;
        app()->instance('current.studio.id', $this->studioId);
        $studio = Studio::findOrFail($this->studioId);

        $this->info("Parsing {$xmlPath} …");
        $xml = simplexml_load_file($xmlPath, options: LIBXML_NOCDATA | LIBXML_PARSEHUGE);
        if (! $xml) {
            $this->error('Could not parse the XML.');

            return self::FAILURE;
        }

        [$home, $portfolio, $posts] = $this->parse($xml);
        $this->line(sprintf(
            '  attachments=%d, home-gallery=%d, portfolio-gallery=%d, posts=%d',
            count($this->attachments), count($home), count($portfolio), count($posts),
        ));

        if ($this->option('dry')) {
            $this->info('Dry run — nothing written.');

            return self::SUCCESS;
        }

        if (! $this->zipOpen($zipPath)) {
            return self::FAILURE;
        }

        $site = $this->resolveSite($studio);
        $this->info("Importing into studio #{$this->studioId} ({$studio->name}), site #{$site->id}");

        try {
            if (! $this->option('no-home')) {
                $this->importGalleryPage($site, $home, 'Home', ['home', $this->option('home-slug')], isHome: true, heading: 'Gallery');
            }
            if (! $this->option('no-portfolio')) {
                $this->importGalleryPage($site, $portfolio, 'Portfolio', [$this->option('portfolio-slug'), 'portfolio'], isHome: false, heading: 'Portfolio');
            }
            if (! $this->option('no-blog')) {
                $this->importBlog($site, $posts);
            }
        } finally {
            $this->zip->close();
        }

        $this->newLine();
        $this->info('Done. Open the website builder to review, then publish.');

        return self::SUCCESS;
    }

    // ── Parsing ──────────────────────────────────────────────────────────────

    /** @return array{0: int[], 1: int[], 2: array<int,array>} [homeIds, portfolioIds, posts] */
    private function parse(\SimpleXMLElement $xml): array
    {
        $homeIds = [];
        $portfolioIds = [];
        $posts = [];
        $wpNs = 'http://wordpress.org/export/1.2/';
        $contentNs = 'http://purl.org/rss/1.0/modules/content/';

        foreach ($xml->channel->item as $item) {
            $wp = $item->children($wpNs);
            $type = (string) $wp->post_type;
            $status = (string) $wp->status;
            $meta = $this->metaMap($wp);

            if ($type === 'attachment') {
                $file = $meta['_wp_attached_file'] ?? null;
                if ($file) {
                    $this->attachments[(int) $wp->post_id] = ['file' => $this->largestFile($file, $meta['_wp_attachment_metadata'] ?? null)];
                }

                continue;
            }

            if ($type === 'page' && $status === 'publish') {
                $slug = (string) $wp->post_name;
                if ($slug === $this->option('home-slug')) {
                    $homeIds = $this->galleryIds($meta);
                } elseif ($slug === $this->option('portfolio-slug')) {
                    $portfolioIds = $this->galleryIds($meta);
                }

                continue;
            }

            if ($type === 'post' && $status === 'publish') {
                $posts[] = [
                    'title' => $this->decode((string) $item->title),
                    'slug' => (string) $wp->post_name,
                    'content' => (string) $item->children($contentNs)->encoded,
                    'excerpt' => $this->decode((string) $item->children('http://wordpress.org/export/1.2/excerpt/')->encoded),
                    'date' => (string) $wp->post_date,
                    'category' => $this->firstCategory($item),
                    'thumbnail_id' => isset($meta['_thumbnail_id']) ? (int) $meta['_thumbnail_id'] : null,
                ];
            }
        }

        // Newest first, capped.
        usort($posts, fn ($a, $b) => strcmp($b['date'], $a['date']));

        return [$homeIds, $portfolioIds, array_slice($posts, 0, (int) $this->option('max-posts'))];
    }

    /** Flatten an item's <wp:postmeta> into key => value. */
    private function metaMap(\SimpleXMLElement $wp): array
    {
        $out = [];
        foreach ($wp->postmeta as $m) {
            $out[(string) $m->meta_key] = (string) $m->meta_value;
        }

        return $out;
    }

    /** Decode the ACF `gallery` postmeta (serialized list of attachment IDs). */
    private function galleryIds(array $meta): array
    {
        $raw = $meta['gallery'] ?? null;
        if (! $raw) {
            return [];
        }
        $ids = @unserialize($raw, ['allowed_classes' => false]);

        return is_array($ids) ? array_values(array_map('intval', $ids)) : [];
    }

    /** The largest stored file: prefer the un-scaled `original_image` if present. */
    private function largestFile(string $attachedFile, ?string $metaSerialized): string
    {
        if ($metaSerialized) {
            $meta = @unserialize($metaSerialized, ['allowed_classes' => false]);
            $original = is_array($meta) ? ($meta['original_image'] ?? null) : null;
            if ($original) {
                $dir = trim(dirname($attachedFile), '.');

                return ($dir !== '' ? $dir.'/' : '').$original;
            }
        }

        return $attachedFile;
    }

    private function firstCategory(\SimpleXMLElement $item): ?string
    {
        foreach ($item->category as $c) {
            if ((string) $c['domain'] === 'category') {
                return $this->decode((string) $c) ?: null;
            }
        }

        return null;
    }

    private function decode(string $s): string
    {
        return trim(html_entity_decode($s, ENT_QUOTES | ENT_HTML5));
    }

    /** Open the uploads archive once; reused for every per-image stream read. */
    private function zipOpen(string $zipPath): bool
    {
        $this->zip = new \ZipArchive;
        if ($this->zip->open($zipPath) !== true) {
            $this->error("Could not open zip: {$zipPath}");

            return false;
        }

        return true;
    }

    // ── Image re-hosting (largest original → our own WebP thumb + full) ────────

    /** Re-host by attachment ID. @return array{thumb:string,full:string}|null */
    private function rehostId(?int $id): ?array
    {
        if (! $id || empty($this->attachments[$id]['file'])) {
            return null;
        }

        return $this->rehostUploadPath($this->attachments[$id]['file']);
    }

    /**
     * Re-host an uploads-relative path (e.g. "2025/03/foo.jpg"). Tries the path,
     * its size-suffix-stripped original, and a -scaled variant, in that order.
     *
     * @return array{thumb:string,full:string}|null
     */
    private function rehostUploadPath(string $relPath): ?array
    {
        $relPath = ltrim(preg_replace('/\?.*$/', '', $relPath), '/');
        $stripped = preg_replace('/-\d+x\d+(?=\.\w+$)/', '', $relPath);
        $scaled = preg_replace('/(\.\w+)$/', '-scaled$1', $stripped);

        foreach (array_unique([$relPath, $stripped, $scaled]) as $candidate) {
            $entry = 'uploads/'.$candidate;
            $idx = $this->zip->locateName($entry, \ZipArchive::FL_NOCASE);
            if ($idx === false) {
                continue;
            }

            return $this->rehostEntry($this->zip->getNameIndex($idx));
        }

        $this->warn("    missing in zip: {$relPath}");

        return null;
    }

    /** Stream one zip entry to a temp file, encode thumb+full WebP, upload. */
    private function rehostEntry(string $entry): ?array
    {
        if (isset($this->cache[$entry])) {
            return $this->cache[$entry];
        }

        $tmp = tempnam(sys_get_temp_dir(), 'wxr');
        try {
            $in = $this->zip->getStream($entry);
            if (! $in) {
                return $this->cache[$entry] = null;
            }
            $out = fopen($tmp, 'wb');
            stream_copy_to_stream($in, $out);
            fclose($in);
            fclose($out);

            $base = StudioPaths::asset($this->studioId, 'site/import/'.Str::uuid());
            $disk = Storage::disk('wasabi');
            $thumbKey = $base.'-thumb.webp';
            $fullKey = $base.'-full.webp';
            $disk->put($thumbKey, Images::webp($tmp, $this->thumbW, $this->quality), 'public');
            $disk->put($fullKey, Images::webp($tmp, $this->fullW, $this->quality), 'public');

            return $this->cache[$entry] = [
                'thumb' => PublicAsset::url($thumbKey),
                'full' => PublicAsset::url($fullKey),
            ];
        } catch (\Throwable $e) {
            $this->warn("    failed: {$entry} — {$e->getMessage()}");

            return $this->cache[$entry] = null;
        } finally {
            @unlink($tmp);
        }
    }

    // ── Gallery pages (home / portfolio) ───────────────────────────────────────

    /**
     * @param  int[]  $attachmentIds
     * @param  string[]  $slugCandidates  Existing-page slugs to fill in, most-specific first
     */
    private function importGalleryPage(Site $site, array $attachmentIds, string $title, array $slugCandidates, bool $isHome, string $heading): void
    {
        $this->line("• {$title} gallery — ".count($attachmentIds).' images…');
        if (! $attachmentIds) {
            $this->warn('  none found in the export.');

            return;
        }

        $images = $this->rehostList($attachmentIds);
        if (! $images) {
            $this->warn('  no images could be re-hosted.');

            return;
        }

        // Reuse the matching existing page (so it stays in the nav); the home page
        // is matched by its flag too. Only create one if nothing fits.
        $page = $site->pages()->whereIn('slug', $slugCandidates)->first()
            ?? ($isHome ? $site->pages()->where('is_home', true)->first() : null)
            ?? $this->createPage($site, $title, $slugCandidates[0], $isHome ? ['is_home' => true] : []);

        // Replace any existing gallery / previously-imported block; keep the rest
        // (hero, about, …) so the page's design survives a re-import.
        $kept = collect($page->blocks ?? [])
            ->reject(fn ($b) => ($b['type'] ?? null) === 'gallery' || data_get($b, 'data._imported'))
            ->values()->all();

        $page->blocks = array_merge($kept, [$this->galleryBlock($heading, $images, fullWidth: $title === 'Portfolio')]);
        $page->save();
        $this->info('  imported '.count($images).' images.');
    }

    /** @param int[] $ids @return array<int,array{thumb:string,full:string}> */
    private function rehostList(array $ids): array
    {
        $out = [];
        $bar = $this->output->createProgressBar(count($ids));
        foreach ($ids as $id) {
            if ($img = $this->rehostId($id)) {
                $out[] = $img;
            }
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();

        return $out;
    }

    // ── Blog ───────────────────────────────────────────────────────────────────

    /** @param array<int,array> $posts */
    private function importBlog(Site $site, array $posts): void
    {
        $this->line('• Blog posts ('.count($posts).')…');
        $blog = $site->blogPage() ?? $this->createPage($site, 'Blog', 'blog', ['is_blog' => true]);

        if ($this->option('fresh-blog')) {
            $deleted = $site->pages()->where('parent_id', $blog->id)->delete();
            $this->line("  cleared {$deleted} existing post(s).");
        }

        $position = (int) $site->pages()->where('parent_id', $blog->id)->max('position');
        foreach ($posts as $post) {
            $this->line('  - '.$post['title']);
            $blocks = [];

            $prose = $this->htmlToText($post['content']);
            if ($prose !== '') {
                $blocks[] = $this->block('text', ['heading' => '', 'heading_level' => 'h2', 'body' => $prose, 'align' => 'left']);
            }

            $images = [];
            foreach ($this->imageUrls($post['content']) as $url) {
                if ($rel = $this->uploadsRelative($url)) {
                    if ($img = $this->rehostUploadPath($rel)) {
                        $images[] = $img;
                    }
                }
            }
            if ($images) {
                $blocks[] = $this->galleryBlock('', $images);
            }

            $cover = $this->rehostId($post['thumbnail_id']);
            $coverUrl = $cover['full'] ?? ($images[0]['full'] ?? null);

            $slug = $post['slug'] ?: Str::slug($post['title']);
            $page = $site->pages()->where('slug', $slug)->first() ?? new SitePage([
                'studio_id' => $this->studioId,
                'site_id' => $site->id,
                'slug' => $this->uniquePageSlug($site, $slug),
            ]);

            $page->fill([
                'studio_id' => $this->studioId,
                'site_id' => $site->id,
                'parent_id' => $blog->id,
                'title' => $post['title'] ?: 'Untitled',
                'status' => 'published',
                'published_at' => $this->date($post['date']),
                'excerpt' => Str::limit(trim($post['excerpt'] !== '' ? strip_tags($post['excerpt']) : $prose), 280),
                'category' => $post['category'],
                'cover_image' => $coverUrl,
                'blocks' => $blocks,
            ]);
            if (! $page->exists) {
                $page->position = ++$position;
            }
            $page->save();
        }

        $this->info('  imported '.count($posts).' posts.');
    }

    /** Distinct image srcs in post HTML, in document order, that live in uploads. */
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
            $key = strtolower(preg_replace('/-\d+x\d+(?=\.\w+)/', '', $src));
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
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

    /** Pull the uploads-relative path out of a full wp-content URL. */
    private function uploadsRelative(string $url): ?string
    {
        if (preg_match('#/wp-content/uploads/(.+)$#', $url, $m)) {
            return $m[1];
        }

        return null;
    }

    /** Flatten post HTML to readable plain text with blank-line paragraph breaks. */
    private function htmlToText(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        // Drop media/scripts; turn block boundaries into newlines before stripping.
        $html = preg_replace('#<(script|style|figure|img|figcaption)[^>]*>.*?</\1>#is', '', $html);
        $html = preg_replace('#<(img|br)[^>]*/?>#i', "\n", $html);
        $html = preg_replace('#</(p|div|h[1-6]|li|blockquote|ul|ol|tr)>#i', "\n\n", $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5);
        $text = preg_replace('/[ \t]+/', ' ', $text);
        $text = preg_replace('/\n{3,}/', "\n\n", $text);

        return trim($text);
    }

    // ── Site / page / block helpers ────────────────────────────────────────────

    private function resolveSite(Studio $studio): Site
    {
        return Site::where('studio_id', $studio->id)->first() ?? DB::transaction(function () use ($studio) {
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

    private function createPage(Site $site, string $title, string $slug, array $extra = []): SitePage
    {
        return $site->pages()->create(array_merge([
            'studio_id' => $this->studioId,
            'title' => $title,
            'slug' => $this->uniquePageSlug($site, $slug),
            'position' => (int) $site->pages()->whereNull('parent_id')->max('position') + 1,
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

    /** @param array<int,array{thumb:string,full:string}> $images */
    private function galleryBlock(string $heading, array $images, bool $fullWidth = false): array
    {
        return $this->block('gallery', [
            'heading' => $heading,
            'columns' => 3,
            'images' => array_values($images),
            'layout' => 'masonry',
            'lightbox' => true,
            'full_width' => $fullWidth,
        ]);
    }

    private function block(string $type, array $data): array
    {
        return ['id' => (string) Str::uuid(), 'type' => $type, 'data' => $data + ['_imported' => true]];
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
