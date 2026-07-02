<?php

namespace App\Console\Commands;

use App\Models\SitePage;
use App\Support\ImageDerivatives;
use Illuminate\Console\Command;

/**
 * Pre-generates the responsive WebP derivatives for every site image already in
 * use (block `image_url`s + post cover images), so the first visitor never pays
 * the on-the-fly generation cost. New uploads are handled lazily by /img.
 */
class WarmImageDerivatives extends Command
{
    protected $signature = 'images:warm-derivatives';

    protected $description = 'Pre-generate responsive image derivatives for existing site images.';

    public function handle(): int
    {
        // Gather every unique source URL we serve responsively.
        $urls = [];
        foreach (SitePage::withoutGlobalScopes()->get(['cover_image', 'blocks']) as $page) {
            if ($page->cover_image) {
                $urls[$page->cover_image] = true;
            }
            $this->collectImageUrls($page->blocks ?? [], $urls);
        }

        // Keep only our own resizable assets.
        $rels = [];
        foreach (array_keys($urls) as $url) {
            if ($rel = ImageDerivatives::relPath($url)) {
                $rels[$rel] = true;
            }
        }
        $rels = array_keys($rels);

        if (! $rels) {
            $this->info('No site images to warm.');

            return self::SUCCESS;
        }

        $this->info(count($rels).' image(s) × '.count(ImageDerivatives::WIDTHS).' widths.');
        $bar = $this->output->createProgressBar(count($rels));
        $bar->start();

        $generated = 0;
        $failed = 0;
        foreach ($rels as $rel) {
            foreach (ImageDerivatives::WIDTHS as $w) {
                ImageDerivatives::ensure($rel, $w) ? $generated++ : $failed++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. {$generated} derivative(s) ready".($failed ? ", {$failed} failed/skipped." : '.'));

        return self::SUCCESS;
    }

    /**
     * Recursively collect every `image_url` string from a block tree (covers hero,
     * about, feature, image and card blocks, including nested grid columns).
     * Galleries use a different shape and are intentionally not warmed here.
     *
     * @param  array<int|string, mixed>  $node
     * @param  array<string, true>  $urls
     */
    private function collectImageUrls(array $node, array &$urls): void
    {
        foreach ($node as $key => $value) {
            if ($key === 'image_url' && is_string($value) && $value !== '') {
                $urls[$value] = true;
            } elseif (is_array($value)) {
                $this->collectImageUrls($value, $urls);
            }
        }
    }
}
