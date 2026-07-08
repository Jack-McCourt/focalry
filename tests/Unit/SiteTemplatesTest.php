<?php

use App\Support\SiteTemplates;

$knownBlockTypes = ['hero', 'about', 'services', 'gallery', 'blog', 'packages', 'reviews', 'text', 'image', 'video', 'button', 'cta', 'faq', 'testimonials', 'pricing', 'logos', 'map', 'embed', 'divider', 'contact', 'newsletter', 'instagram', 'slider', 'grid'];

$customTemplates = ['editorial', 'studio', 'documentary', 'noir', 'coastal', 'atelier', 'heirloom'];

it('registers the editorial, studio and documentary templates', function () {
    $keys = array_column(SiteTemplates::all(), 'key');

    expect($keys)->toContain('portfolio', 'editorial', 'studio', 'documentary');
    expect(SiteTemplates::exists('documentary'))->toBeTrue();
});

it('gives each template a valid theme', function () use ($customTemplates) {
    foreach ($customTemplates as $key) {
        $theme = SiteTemplates::theme($key);
        expect($theme['font'])->toBeIn(['sans', 'serif']);
        expect($theme['primary_color'])->toMatch('/^#[0-9a-fA-F]{6}$/');
    }
});

it('builds well-formed pages for the new templates', function () use ($knownBlockTypes, $customTemplates) {
    foreach ($customTemplates as $key) {
        $pages = SiteTemplates::pages($key, 'Acme Studio');

        // Exactly one home page, and a blog page (for SEO + seeded posts).
        expect(collect($pages)->where('is_home', true))->toHaveCount(1, "$key should have one home page");
        expect(collect($pages)->firstWhere('is_blog', true))->not->toBeNull("$key should have a blog page");

        foreach ($pages as $page) {
            expect($page['slug'])->not->toBeEmpty();

            // Every page should have exactly one h1 source: either an h1-level
            // hero (heroes can demote to h2 via heading_level, e.g. heirloom's
            // stacked portfolio banners), or a text block with heading_level h1
            // — important for SEO.
            $h1s = collect($page['blocks'])->filter(
                fn ($b) => ($b['type'] === 'hero' && ($b['data']['heading_level'] ?? 'h1') === 'h1')
                    || ($b['type'] === 'text' && ($b['data']['heading_level'] ?? null) === 'h1')
            );
            expect($h1s->count())->toBe(1, "page {$page['slug']} in $key must have exactly one h1");

            foreach ($page['blocks'] as $block) {
                expect($block['type'])->toBeIn($knownBlockTypes);
                expect($block['id'])->not->toBeEmpty();
            }
        }
    }
});

it('points every nav item at a real page', function () use ($customTemplates) {
    foreach ($customTemplates as $key) {
        $slugs = collect(SiteTemplates::pages($key, 'Acme'))->pluck('slug')->all();

        foreach (SiteTemplates::headerNav($key) as $item) {
            if ($item['kind'] === 'page') {
                expect(in_array($item['target'], $slugs, true))
                    ->toBeTrue("$key nav target {$item['target']} must be a page");
            }
        }
    }
});
