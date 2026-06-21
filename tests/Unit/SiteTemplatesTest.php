<?php

use App\Support\SiteTemplates;

$knownBlockTypes = ['hero', 'about', 'services', 'gallery', 'blog', 'packages', 'text', 'image', 'contact', 'grid'];

it('registers the editorial and studio templates', function () {
    $keys = array_column(SiteTemplates::all(), 'key');

    expect($keys)->toContain('portfolio', 'editorial', 'studio');
    expect(SiteTemplates::exists('editorial'))->toBeTrue();
    expect(SiteTemplates::exists('studio'))->toBeTrue();
});

it('gives each template a valid theme', function () {
    foreach (['editorial', 'studio'] as $key) {
        $theme = SiteTemplates::theme($key);
        expect($theme['font'])->toBeIn(['sans', 'serif']);
        expect($theme['primary_color'])->toMatch('/^#[0-9a-fA-F]{6}$/');
    }
});

it('builds well-formed pages for the new templates', function () use ($knownBlockTypes) {
    foreach (['editorial', 'studio'] as $key) {
        $pages = SiteTemplates::pages($key, 'Acme Studio');

        // Exactly one home page, and a blog page (for SEO + seeded posts).
        expect(collect($pages)->where('is_home', true))->toHaveCount(1, "$key should have one home page");
        expect(collect($pages)->firstWhere('is_blog', true))->not->toBeNull("$key should have a blog page");

        foreach ($pages as $page) {
            expect($page['slug'])->not->toBeEmpty();

            // Every page should have exactly one h1 source: either a hero, or a
            // text block with heading_level h1 — important for SEO.
            $h1s = collect($page['blocks'])->filter(
                fn ($b) => $b['type'] === 'hero'
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

it('points every nav item at a real page', function () {
    foreach (['editorial', 'studio'] as $key) {
        $slugs = collect(SiteTemplates::pages($key, 'Acme'))->pluck('slug')->all();

        foreach (SiteTemplates::headerNav($key) as $item) {
            if ($item['kind'] === 'page') {
                expect(in_array($item['target'], $slugs, true))
                    ->toBeTrue("$key nav target {$item['target']} must be a page");
            }
        }
    }
});
