<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Registry of starter website templates. A template is a theme + managed
 * header/footer navigation + a set of pages, each page being an ordered list of
 * modular blocks.
 *
 * To add a template: add an entry to META and a builder method returning pages.
 * The block shapes here must stay in sync with the front-end block renderer
 * (resources/js/Components/site/blocks.tsx).
 */
class SiteTemplates
{
    /** @var array<string, array{name: string, description: string}> */
    public const META = [
        'heirloom' => [
            'name' => 'Heirloom',
            'description' => 'A light, timeless wedding template — soft greys, elegant uppercase serif type and a split masthead — with home, about, experience, services, testimonials, portfolio galleries, blog and contact.',
        ],
        'editorial' => [
            'name' => 'Editorial',
            'description' => 'An elegant, fine-art template with serif type and warm tones — home, portfolio, about, investment, journal and contact.',
        ],
        'studio' => [
            'name' => 'Studio',
            'description' => 'A clean, modern single-scroll template with bold sans-serif type — home, work, journal and contact.',
        ],
        'documentary' => [
            'name' => 'Documentary',
            'description' => 'A minimal, photo-led documentary wedding template — black on white, clean sans-serif type — with home, portfolio, pricing, FAQ, journal and contact pages.',
        ],
        'noir' => [
            'name' => 'Noir',
            'description' => 'A dark, moody wedding template — gold accents on near-black, dramatic serif headings — home, portfolio, investment, journal and contact.',
        ],
        'coastal' => [
            'name' => 'Coastal',
            'description' => 'A light, airy template with soft blue accents and generous whitespace — perfect for family, lifestyle and destination work.',
        ],
        'atelier' => [
            'name' => 'Atelier',
            'description' => 'A fine-art, editorial template in warm blush tones with elegant serif type — for boudoir, portrait and fine-art studios.',
        ],
        'portfolio' => [
            'name' => 'Portfolio',
            'description' => 'A multi-page site: home, about, a blog and a contact page — with sensible blocks on each.',
        ],
    ];

    public const DEFAULT = 'portfolio';

    // Placeholder copy — the starter templates use lorem ipsum for all long-form
    // text so they ship anonymised (studios replace it with their own words).
    private const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure.';

    private const LOREM_LEAD = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

    private const LOREM_SENTENCE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor.';

    private const LOREM_FEATURES = "Lorem ipsum dolor sit\nConsectetur adipiscing elit\nSed do eiusmod tempor\nUt labore et dolore magna";

    private const LOREM_BULLETS = "• Lorem ipsum dolor sit amet\n• Consectetur adipiscing elit\n• Sed do eiusmod tempor incididunt\n• Ut labore et dolore magna";

    /** @return list<array{key: string, name: string, description: string, thumbnail: string}> */
    public static function all(): array
    {
        return collect(self::META)
            ->map(fn ($meta, $key) => ['key' => $key, 'thumbnail' => "/images/templates/thumbs/{$key}.jpg"] + $meta)
            ->values()
            ->all();
    }

    /**
     * A bundled stock photo (public/images/templates/stock/*.webp — curated
     * Unsplash-licensed images) so starter templates ship looking designed
     * instead of full of grey placeholders. Studios replace them with their own.
     */
    private static function img(string $name): string
    {
        return "/images/templates/stock/{$name}.webp";
    }

    public static function exists(string $key): bool
    {
        return array_key_exists($key, self::META);
    }

    /** @return array{primary_color: string, font: string, heading_font: string, body_font: string, logo_font: string} */
    public static function theme(string $key): array
    {
        return match ($key) {
            // Fashion-magazine look: dramatic DM Serif Display headings, Lora body,
            // a Playfair wordmark, warm ink accent, and the "editorial" style preset
            // (uppercase tracked nav + ruled centred headings).
            'editorial' => ['primary_color' => '#8c3b2e', 'font' => 'serif', 'heading_font' => 'dm_serif', 'body_font' => 'lora', 'logo_font' => 'playfair', 'nav_size' => 'sm', 'logo_size' => 'xl', 'style' => 'editorial'],
            // Boutique studio: clean geometric Montserrat, slate ink, and a centred
            // masthead (the "studio" style preset) for a gallery-like, modern feel.
            'studio' => ['primary_color' => '#1f2937', 'font' => 'sans', 'heading_font' => 'montserrat', 'body_font' => 'montserrat', 'logo_font' => 'montserrat', 'nav_size' => 'sm', 'logo_size' => 'md', 'style' => 'studio'],
            // Matches mccourtphotography.co.uk: Raleway for titles + body. Permanent
            // Marker (its logo font) is available in the picker but not defaulted.
            'documentary' => ['primary_color' => '#171717', 'font' => 'sans', 'heading_font' => 'raleway', 'body_font' => 'raleway', 'logo_font' => '', 'nav_size' => 'base', 'logo_size' => 'xl', 'width' => 'wide'],
            // Dark and moody: gold on near-black, dramatic Cormorant display serif.
            'noir' => ['primary_color' => '#c9a962', 'font' => 'serif', 'heading_font' => 'cormorant', 'body_font' => 'raleway', 'logo_font' => 'cormorant', 'nav_size' => 'sm', 'logo_size' => 'lg', 'style' => 'studio'],
            // Light and airy: soft coastal blue, Playfair headings, Poppins body.
            'coastal' => ['primary_color' => '#5e8ca7', 'font' => 'serif', 'heading_font' => 'playfair', 'body_font' => 'poppins', 'logo_font' => 'playfair', 'nav_size' => 'sm', 'logo_size' => 'md'],
            // Fine-art blush: Cormorant + Lora with the editorial style preset.
            'atelier' => ['primary_color' => '#a8756f', 'font' => 'serif', 'heading_font' => 'cormorant', 'body_font' => 'lora', 'logo_font' => 'cormorant', 'nav_size' => 'sm', 'logo_size' => 'xl', 'style' => 'editorial'],
            // Timeless wedding classic (Pixieset "Jennifer"-like): soft greys,
            // light uppercase Cormorant display, EB Garamond (Caslon-like) body,
            // and the "heirloom" preset (split masthead + square tracked buttons).
            'heirloom' => ['primary_color' => '#7d7d7d', 'font' => 'serif', 'heading_font' => 'cormorant', 'body_font' => 'eb_garamond', 'logo_font' => 'cormorant', 'heading_weight' => 400, 'text_color' => '#6a6a6a', 'nav_size' => 'sm', 'logo_size' => 'lg', 'style' => 'heirloom'],
            default => ['primary_color' => '#171717', 'font' => 'sans', 'heading_font' => 'sans', 'body_font' => 'sans', 'logo_font' => ''],
        };
    }

    /** @return list<array{label: string, kind: string, target: string}> */
    public static function headerNav(string $key): array
    {
        return match ($key) {
            'editorial' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'Portfolio', 'kind' => 'page', 'target' => 'portfolio'],
                ['label' => 'About', 'kind' => 'page', 'target' => 'about'],
                ['label' => 'Investment', 'kind' => 'page', 'target' => 'investment'],
                ['label' => 'Journal', 'kind' => 'page', 'target' => 'journal'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            'studio' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'Work', 'kind' => 'page', 'target' => 'work'],
                ['label' => 'Journal', 'kind' => 'page', 'target' => 'journal'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            'documentary' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'Portfolio', 'kind' => 'page', 'target' => 'portfolio'],
                ['label' => 'Pricing', 'kind' => 'page', 'target' => 'pricing'],
                ['label' => 'FAQ', 'kind' => 'page', 'target' => 'faq'],
                ['label' => 'Blog', 'kind' => 'page', 'target' => 'blog'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            'noir' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'Portfolio', 'kind' => 'page', 'target' => 'portfolio'],
                ['label' => 'Investment', 'kind' => 'page', 'target' => 'investment'],
                ['label' => 'Journal', 'kind' => 'page', 'target' => 'journal'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            'coastal' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'About', 'kind' => 'page', 'target' => 'about'],
                ['label' => 'Galleries', 'kind' => 'page', 'target' => 'galleries'],
                ['label' => 'Journal', 'kind' => 'page', 'target' => 'journal'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            'atelier' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'Portfolio', 'kind' => 'page', 'target' => 'portfolio'],
                ['label' => 'Investment', 'kind' => 'page', 'target' => 'investment'],
                ['label' => 'Journal', 'kind' => 'page', 'target' => 'journal'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            // Six top-level items so the split masthead balances 3 + 3 around the
            // wordmark; Info and Portfolio carry dropdown children.
            'heirloom' => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'About', 'kind' => 'page', 'target' => 'about'],
                ['label' => 'Info', 'kind' => 'url', 'target' => '#', 'children' => [
                    ['label' => 'Experience', 'kind' => 'page', 'target' => 'experience'],
                    ['label' => 'Services', 'kind' => 'page', 'target' => 'services'],
                    ['label' => 'Testimonials', 'kind' => 'page', 'target' => 'testimonials'],
                ]],
                ['label' => 'Blog', 'kind' => 'page', 'target' => 'blog'],
                ['label' => 'Portfolio', 'kind' => 'page', 'target' => 'portfolio', 'children' => [
                    ['label' => 'Weddings', 'kind' => 'page', 'target' => 'weddings'],
                    ['label' => 'Couples', 'kind' => 'page', 'target' => 'couples'],
                    ['label' => 'Engagements', 'kind' => 'page', 'target' => 'engagements'],
                ]],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
            default => [
                ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
                ['label' => 'About', 'kind' => 'page', 'target' => 'about'],
                ['label' => 'Blog', 'kind' => 'page', 'target' => 'blog'],
                ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
            ],
        };
    }

    /** @return list<array{label: string, kind: string, target: string}> */
    public static function footerNav(string $key): array
    {
        return self::headerNav($key);
    }

    /**
     * Build the seed pages for a template, personalised with the studio name.
     *
     * @return list<array{title: string, slug: string, is_home: bool, blocks: list<array{id: string, type: string, data: array<string, mixed>}>}>
     */
    public static function pages(string $key, string $studioName): array
    {
        $key = self::exists($key) ? $key : self::DEFAULT;

        return match ($key) {
            'editorial' => self::editorialPages($studioName),
            'studio' => self::studioPages($studioName),
            'documentary' => self::documentaryPages($studioName),
            'noir' => self::noirPages($studioName),
            'coastal' => self::coastalPages($studioName),
            'atelier' => self::atelierPages($studioName),
            'heirloom' => self::heirloomPages($studioName),
            default => self::portfolioPages($studioName),
        };
    }

    /** @return list<array{title: string, slug: string, is_home: bool, blocks: array}> */
    private static function portfolioPages(string $studioName): array
    {
        return [
            // ── Home ──
            [
                'title' => 'Home',
                'slug' => 'home',
                'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName,
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('autumn-couple'),
                        'cta_label' => 'Enquire now',
                        'cta_link' => '/contact',
                        'overlay' => 35,
                        'align' => 'center',
                    ]),
                    self::block('services', [
                        'heading' => 'What I offer',
                        'items' => [
                            ['title' => 'Weddings', 'description' => self::LOREM_SENTENCE, 'price' => 'From $2,400'],
                            ['title' => 'Portraits', 'description' => self::LOREM_SENTENCE, 'price' => 'From $350'],
                            ['title' => 'Events', 'description' => self::LOREM_SENTENCE, 'price' => 'From $600'],
                        ],
                    ]),
                    self::block('gallery', [
                        'heading' => 'Recent work',
                        'columns' => 3,
                        'images' => [
                            self::img('confetti'), self::img('aisle-gold'), self::img('bride-bouquet'),
                            self::img('portrait-red'), self::img('reception-candid'), self::img('table-florals'),
                        ],
                    ]),
                    self::block('blog', [
                        'heading' => 'From the journal',
                        'columns' => 3,
                        'limit' => 3,
                    ]),
                ],
            ],

            // ── About (a general content page) ──
            [
                'title' => 'About',
                'slug' => 'about',
                'is_home' => false,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'About',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('table-florals'),
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => "Hi, I'm a photographer",
                        'body' => self::LOREM,
                        'image_url' => self::img('portrait-outdoor'),
                        'image_side' => 'left',
                    ]),
                    self::block('services', [
                        'heading' => 'How it works',
                        'items' => [
                            ['title' => '1. Get in touch', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                            ['title' => '2. The shoot', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                            ['title' => '3. Your gallery', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                        ],
                    ]),
                ],
            ],

            // ── Blog (designated blog page; posts are child pages) ──
            [
                'title' => 'Blog',
                'slug' => 'blog',
                'is_home' => false,
                'is_blog' => true,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Journal',
                        'body' => self::LOREM,
                        'align' => 'center',
                    ]),
                    self::block('blog', [
                        'heading' => '',
                        'columns' => 3,
                        'limit' => 0,
                    ]),
                ],
            ],

            // ── Contact ──
            [
                'title' => 'Contact',
                'slug' => 'contact',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Get in touch',
                        'body' => self::LOREM,
                        'align' => 'center',
                    ]),
                    self::block('contact', [
                        'heading' => '',
                        'subheading' => '',
                        'submit_label' => 'Send enquiry',
                        'show_phone' => true,
                        'show_event_date' => true,
                        'show_event_type' => true,
                    ]),
                ],
            ],
        ];
    }

    /**
     * Editorial — a fine-art, serif template. Big portrait/masonry galleries,
     * a story-led about page and a dedicated investment page.
     *
     * @return list<array{title: string, slug: string, is_home: bool, blocks: array}>
     */
    private static function editorialPages(string $studioName): array
    {
        return [
            // ── Home ──
            [
                'title' => 'Home',
                'slug' => 'home',
                'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName,
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('veil-field'),
                        'cta_label' => 'Enquire',
                        'cta_link' => '/contact',
                        'overlay' => 35,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => 'A storyteller at heart',
                        'body' => self::LOREM,
                        'image_url' => self::img('portrait-warm'),
                        'image_side' => 'right',
                    ]),
                    self::block('gallery', [
                        'heading' => 'Selected work',
                        'columns' => 2,
                        'layout' => 'portrait',
                        'lightbox' => true,
                        'images' => [
                            self::img('arch-flowers'), self::img('bride-bouquet'),
                            self::img('rings-hands'), self::img('roses-candles'),
                            self::img('place-settings'), self::img('autumn-couple'),
                        ],
                    ]),
                    self::block('services', [
                        'heading' => 'The experience',
                        'items' => [
                            ['title' => 'Weddings', 'description' => self::LOREM_SENTENCE, 'price' => 'From $3,200'],
                            ['title' => 'Elopements', 'description' => self::LOREM_SENTENCE, 'price' => 'From $1,800'],
                            ['title' => 'Engagements', 'description' => self::LOREM_SENTENCE, 'price' => 'From $500'],
                        ],
                    ], ['background' => '#f7efe9']),
                    self::block('blog', [
                        'heading' => 'From the journal',
                        'columns' => 3,
                        'limit' => 3,
                    ]),
                    self::block('text', [
                        'heading' => "Let's tell your story",
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h2',
                    ], ['background' => '#b0654f', 'text_color' => '#ffffff', 'padding' => 'lg']),
                ],
            ],

            // ── Portfolio ──
            [
                'title' => 'Portfolio',
                'slug' => 'portfolio',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Portfolio',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('gallery', [
                        'heading' => '',
                        'columns' => 2,
                        'layout' => 'masonry',
                        'lightbox' => true,
                        'images' => [
                            self::img('veil-field'), self::img('rings-hands'),
                            self::img('arch-flowers'), self::img('autumn-couple'),
                            self::img('roses-candles'), self::img('bride-bouquet'),
                            self::img('table-florals'), self::img('aisle-gold'),
                        ],
                    ]),
                ],
            ],

            // ── About ──
            [
                'title' => 'About',
                'slug' => 'about',
                'is_home' => false,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'About',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('arch-flowers'),
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => "Hello, I'm so glad you're here",
                        'body' => self::LOREM,
                        'image_url' => self::img('portrait-wall'),
                        'image_side' => 'left',
                    ]),
                    self::block('services', [
                        'heading' => 'How we work together',
                        'items' => [
                            ['title' => '01 — Enquire', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                            ['title' => '02 — Plan', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                            ['title' => '03 — Relive', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                        ],
                    ], ['background' => '#f7efe9']),
                ],
            ],

            // ── Investment ──
            [
                'title' => 'Investment',
                'slug' => 'investment',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Investment',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('packages', [
                        'heading' => 'Wedding collections',
                        'subheading' => self::LOREM_LEAD,
                        'columns' => 3,
                    ]),
                    self::block('services', [
                        'heading' => 'Always included',
                        'items' => [
                            ['title' => 'Pre-wedding consult', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                            ['title' => 'A second photographer', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                            ['title' => 'Private online gallery', 'description' => self::LOREM_SENTENCE, 'price' => ''],
                        ],
                    ], ['background' => '#f7efe9']),
                ],
            ],

            // ── Journal (blog) ──
            [
                'title' => 'Journal',
                'slug' => 'journal',
                'is_home' => false,
                'is_blog' => true,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Journal',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('blog', ['heading' => '', 'columns' => 2, 'limit' => 0]),
                ],
            ],

            // ── Contact ──
            [
                'title' => 'Contact',
                'slug' => 'contact',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Get in touch',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('contact', [
                        'heading' => '',
                        'subheading' => '',
                        'submit_label' => 'Send enquiry',
                        'show_phone' => true,
                        'show_event_date' => true,
                        'show_event_type' => true,
                    ]),
                ],
            ],
        ];
    }

    /**
     * Studio — a clean, modern, sans-serif template. Lean navigation, a rich
     * single-scroll home page, a work grid and a journal.
     *
     * @return list<array{title: string, slug: string, is_home: bool, blocks: array}>
     */
    private static function studioPages(string $studioName): array
    {
        return [
            // ── Home (rich single-scroll) ──
            [
                'title' => 'Home',
                'slug' => 'home',
                'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName,
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('confetti'),
                        'cta_label' => 'Book a call',
                        'cta_link' => '/contact',
                        'overlay' => 40,
                        'align' => 'left',
                    ]),
                    self::block('services', [
                        'heading' => 'Services',
                        'items' => [
                            ['title' => 'Weddings', 'description' => self::LOREM_SENTENCE, 'price' => 'From $2,800'],
                            ['title' => 'Portraits', 'description' => self::LOREM_SENTENCE, 'price' => 'From $400'],
                            ['title' => 'Brand & events', 'description' => self::LOREM_SENTENCE, 'price' => 'From $700'],
                        ],
                    ], ['background' => '#eef2ff']),
                    self::block('gallery', [
                        'heading' => 'Recent work',
                        'columns' => 3,
                        'layout' => 'square',
                        'lightbox' => true,
                        'images' => [
                            self::img('brick-venue'), self::img('concert'), self::img('reception-candid'),
                            self::img('portrait-red'), self::img('portrait-male'), self::img('marquee'),
                        ],
                    ]),
                    self::block('about', [
                        'heading' => 'A little about me',
                        'body' => self::LOREM,
                        'image_url' => self::img('portrait-male'),
                        'image_side' => 'left',
                    ]),
                    self::block('packages', [
                        'heading' => 'Packages',
                        'subheading' => self::LOREM_LEAD,
                        'columns' => 3,
                    ]),
                    self::block('blog', [
                        'heading' => 'Latest stories',
                        'columns' => 3,
                        'limit' => 3,
                    ]),
                    self::block('text', [
                        'heading' => 'Ready when you are',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h2',
                    ], ['background' => '#4f46e5', 'text_color' => '#ffffff', 'padding' => 'lg']),
                ],
            ],

            // ── Work ──
            [
                'title' => 'Work',
                'slug' => 'work',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Work',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('gallery', [
                        'heading' => '',
                        'columns' => 3,
                        'layout' => 'square',
                        'lightbox' => true,
                        'images' => [
                            self::img('concert'), self::img('brick-venue'), self::img('confetti'),
                            self::img('reception-candid'), self::img('marquee'), self::img('portrait-red'),
                        ],
                    ]),
                ],
            ],

            // ── Journal (blog) ──
            [
                'title' => 'Journal',
                'slug' => 'journal',
                'is_home' => false,
                'is_blog' => true,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Journal',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('blog', ['heading' => '', 'columns' => 3, 'limit' => 0]),
                ],
            ],

            // ── Contact ──
            [
                'title' => 'Contact',
                'slug' => 'contact',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Contact',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('contact', [
                        'heading' => '',
                        'subheading' => '',
                        'submit_label' => 'Send message',
                        'show_phone' => true,
                        'show_event_date' => true,
                        'show_event_type' => true,
                    ]),
                ],
            ],
        ];
    }

    /**
     * Documentary — a minimal, photo-led wedding template (black on white, clean
     * sans-serif). Home, portfolio, pricing, FAQ, journal and contact. Modelled
     * on a documentary wedding studio's site (copy anonymised as lorem ipsum).
     *
     * @return list<array{title: string, slug: string, is_home: bool, blocks: array}>
     */
    private static function documentaryPages(string $studioName): array
    {
        return [
            // ── Home ──
            [
                'title' => 'Home',
                'slug' => 'home',
                'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName,
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('palm-night'),
                        'cta_label' => 'Enquire',
                        'cta_link' => '/contact',
                        'overlay' => 40,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => 'Candid moments, beautifully told',
                        'body' => self::LOREM,
                        'image_url' => self::img('confetti'),
                        'image_side' => 'left',
                    ]),
                    self::block('gallery', [
                        'heading' => 'Recent weddings',
                        'columns' => 3,
                        'layout' => 'square',
                        'lightbox' => true,
                        'images' => [
                            self::img('confetti'), self::img('palm-night'), self::img('reception-candid'),
                            self::img('bw-headwrap'), self::img('brick-venue'), self::img('field-walk'),
                        ],
                    ]),
                    self::block('text', [
                        'heading' => 'Your dream wedding, captured',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h2',
                    ], ['background' => '#f5f5f4', 'padding' => 'lg']),
                    self::block('about', [
                        'heading' => 'Behind the camera',
                        'body' => self::LOREM,
                        'image_url' => self::img('field-walk'),
                        'image_side' => 'right',
                    ]),
                    self::block('about', [
                        'heading' => 'Our approach',
                        'body' => self::LOREM,
                        'image_url' => self::img('dark-hands'),
                        'image_side' => 'left',
                    ]),
                    self::block('cta', [
                        'heading' => "Let's capture your day",
                        'subheading' => self::LOREM_LEAD,
                        'button_label' => 'Check availability',
                        'button_link' => '/contact',
                    ]),
                ],
            ],

            // ── Portfolio ──
            [
                'title' => 'Portfolio',
                'slug' => 'portfolio',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Portfolio',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('gallery', [
                        'heading' => '',
                        'columns' => 3,
                        'layout' => 'masonry',
                        'lightbox' => true,
                        'images' => [
                            self::img('confetti'), self::img('field-walk'), self::img('palm-night'),
                            self::img('bw-headwrap'), self::img('reception-candid'), self::img('dark-hands'),
                            self::img('brick-venue'), self::img('bride-bouquet'), self::img('veil-field'),
                        ],
                    ]),
                ],
            ],

            // ── Pricing ──
            [
                'title' => 'Pricing',
                'slug' => 'pricing',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Pricing',
                        'body' => self::LOREM_LEAD,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    // Each package is a full-width image-and-text row (alternating
                    // sides), mirroring a classic photographer's pricing page.
                    self::block('about', [
                        'heading' => 'The Wee One — £800',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => self::img('bride-bouquet'),
                        'image_side' => 'left',
                    ]),
                    self::block('about', [
                        'heading' => 'The Big One — £1,150',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => self::img('dark-hands'),
                        'image_side' => 'right',
                    ]),
                    self::block('about', [
                        'heading' => 'Both of Us — £1,450',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => self::img('veil-field'),
                        'image_side' => 'left',
                    ]),
                    // The premium tier is featured with a soft background.
                    self::block('about', [
                        'heading' => 'All the Bells and Whistles — £1,850',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => self::img('table-florals'),
                        'image_side' => 'right',
                    ], ['background' => '#f5f5f4', 'padding' => 'lg']),
                    self::block('cta', [
                        'heading' => 'Ready to book?',
                        'subheading' => self::LOREM_LEAD,
                        'button_label' => 'Enquire',
                        'button_link' => '/contact',
                    ]),
                ],
            ],

            // ── FAQ ──
            [
                'title' => 'FAQ',
                'slug' => 'faq',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Frequently asked questions',
                        'body' => '',
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('faq', [
                        'heading' => '',
                        'items' => [
                            ['q' => 'Do you travel?', 'a' => self::LOREM],
                            ['q' => 'How long until we get our photos?', 'a' => self::LOREM],
                            ['q' => 'Why two photographers?', 'a' => self::LOREM],
                            ['q' => 'Can you help with the dress?', 'a' => self::LOREM],
                            ['q' => 'Do you offer payment plans?', 'a' => self::LOREM],
                            ['q' => 'How do we book?', 'a' => self::LOREM],
                        ],
                    ]),
                ],
            ],

            // ── Blog (designated blog page; posts are child pages) ──
            [
                'title' => 'Blog',
                'slug' => 'blog',
                'is_home' => false,
                'is_blog' => true,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Journal',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('blog', ['heading' => '', 'columns' => 3, 'limit' => 0]),
                ],
            ],

            // ── Contact ──
            [
                'title' => 'Contact',
                'slug' => 'contact',
                'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Get in touch',
                        'body' => self::LOREM,
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('contact', [
                        'heading' => '',
                        'subheading' => '',
                        'submit_label' => 'Send enquiry',
                        'show_phone' => true,
                        'show_event_date' => true,
                        'show_event_type' => true,
                    ]),
                ],
            ],
        ];
    }

    /**
     * Example blog posts seeded under the blog page. Each is a block-built page.
     *
     * @return list<array{title: string, slug: string, excerpt: string, cover_image: string, status: string, days_ago: int, blocks: array}>
     */
    /** @return list<array{title: string, slug: string, is_home: bool, blocks: array}> */
    private static function noirPages(string $studioName): array
    {
        $dark = ['background' => '#121212', 'text_color' => '#f5f0e8'];

        return [
            [
                'title' => 'Home', 'slug' => 'home', 'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName, 'subheading' => self::LOREM_LEAD, 'image_url' => self::img('moody-bride'),
                        'cta_label' => 'Enquire', 'cta_link' => '/contact', 'overlay' => 55,
                        'height' => 'full', 'title_size' => 'xl', 'text_shadow' => 'soft',
                        'content_y' => 'bottom', 'content_x' => 'left', 'text_align' => 'left',
                        'text_bg' => 'gradient', 'text_bg_color' => '#000000', 'text_bg_opacity' => 70, 'text_bg_extent' => 55,
                    ]),
                    self::block('text', ['heading' => 'After dark, everything glows', 'heading_level' => 'h2', 'body' => self::LOREM, 'align' => 'center'], $dark + ['padding' => 'xl']),
                    self::block('gallery', ['heading' => '', 'columns' => 3, 'layout' => 'masonry', 'lightbox' => true, 'images' => [
                        self::img('bw-beach-couple'), self::img('dark-toast'), self::img('dark-hands'),
                        self::img('dark-dinner'), self::img('palm-night'), self::img('bw-headwrap'),
                    ], 'full_width' => true], $dark),
                    self::block('testimonials', ['heading' => 'Kind words', 'items' => [
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'E & J', 'role' => 'Married 2026'],
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'A & S', 'role' => 'Married 2025'],
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'M & T', 'role' => 'Married 2025'],
                    ]], $dark),
                    self::block('cta', ['heading' => 'Dates for next season are open', 'subheading' => self::LOREM_LEAD, 'button_label' => 'Check availability', 'button_link' => '/contact']),
                ],
            ],
            [
                'title' => 'Portfolio', 'slug' => 'portfolio', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Portfolio', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center'], $dark),
                    self::block('gallery', ['heading' => '', 'columns' => 3, 'layout' => 'masonry', 'lightbox' => true, 'images' => [
                        self::img('moody-bride'), self::img('bw-beach-couple'), self::img('dark-dinner'),
                        self::img('bw-headwrap'), self::img('dark-hands'), self::img('dark-toast'),
                        self::img('palm-night'), self::img('field-walk'), self::img('concert'),
                    ], 'full_width' => true], $dark),
                ],
            ],
            [
                'title' => 'Investment', 'slug' => 'investment', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Investment', 'heading_level' => 'h1', 'body' => self::LOREM, 'align' => 'center']),
                    self::block('pricing', ['heading' => '', 'plans' => [
                        ['name' => 'Intimate', 'price' => '$2,400', 'period' => '', 'features' => self::LOREM_FEATURES, 'button_label' => 'Enquire', 'button_link' => '/contact', 'featured' => false],
                        ['name' => 'Signature', 'price' => '$3,800', 'period' => '', 'features' => self::LOREM_FEATURES, 'button_label' => 'Enquire', 'button_link' => '/contact', 'featured' => true],
                        ['name' => 'Legacy', 'price' => '$5,200', 'period' => '', 'features' => self::LOREM_FEATURES, 'button_label' => 'Enquire', 'button_link' => '/contact', 'featured' => false],
                    ]]),
                    self::block('faq', ['heading' => 'Questions, answered', 'items' => [
                        ['q' => 'Lorem ipsum dolor sit amet?', 'a' => self::LOREM_SENTENCE],
                        ['q' => 'Consectetur adipiscing elit?', 'a' => self::LOREM_SENTENCE],
                        ['q' => 'Sed do eiusmod tempor?', 'a' => self::LOREM_SENTENCE],
                    ]]),
                ],
            ],
            [
                'title' => 'Journal', 'slug' => 'journal', 'is_home' => false, 'is_blog' => true,
                'blocks' => [
                    self::block('text', ['heading' => 'Journal', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('blog', ['heading' => '', 'columns' => 3, 'limit' => 0, 'per_page' => 9, 'show_categories' => true]),
                ],
            ],
            [
                'title' => 'Contact', 'slug' => 'contact', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Get in touch', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center'], $dark),
                    self::block('contact', ['heading' => "Let's talk", 'subheading' => self::LOREM_SENTENCE, 'submit_label' => 'Send enquiry', 'show_phone' => true, 'show_event_date' => true, 'show_event_type' => true]),
                ],
            ],
        ];
    }

    /** @return list<array{title: string, slug: string, is_home: bool, blocks: array}> */
    private static function coastalPages(string $studioName): array
    {
        $wash = ['background' => '#f2f7fa'];

        return [
            [
                'title' => 'Home', 'slug' => 'home', 'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName, 'subheading' => self::LOREM_LEAD, 'image_url' => self::img('beach-sunrise'),
                        'cta_label' => 'Say hello', 'cta_link' => '/contact', 'overlay' => 20,
                        'title_size' => 'lg', 'text_bg' => 'panel', 'text_bg_color' => '#ffffff', 'text_bg_opacity' => 65,
                    ]),
                    self::block('about', ['heading' => 'Hello, and welcome', 'body' => self::LOREM, 'image_url' => self::img('family-fence'), 'image_side' => 'right']),
                    self::block('gallery', ['heading' => 'Recent sessions', 'columns' => 3, 'layout' => 'landscape', 'lightbox' => true, 'images' => [
                        self::img('kids-forest'), self::img('newborn'), self::img('family-couch'),
                        self::img('ocean-aerial'), self::img('family-fence'), self::img('beach-veil'),
                    ]], $wash),
                    self::block('services', ['heading' => 'Sessions', 'items' => [
                        ['title' => 'Family', 'description' => self::LOREM_SENTENCE, 'price' => 'From $450'],
                        ['title' => 'Motherhood', 'description' => self::LOREM_SENTENCE, 'price' => 'From $400'],
                        ['title' => 'Couples', 'description' => self::LOREM_SENTENCE, 'price' => 'From $380'],
                    ]]),
                    self::block('newsletter', ['heading' => 'Join the newsletter', 'subheading' => self::LOREM_SENTENCE, 'placeholder' => 'Your email address', 'button_label' => 'Subscribe', 'success_message' => "You're on the list — thank you!", 'show_name' => false], $wash),
                ],
            ],
            [
                'title' => 'About', 'slug' => 'about', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'About', 'heading_level' => 'h1', 'body' => self::LOREM, 'align' => 'center']),
                    self::block('about', ['heading' => 'The person behind the camera', 'body' => self::LOREM, 'image_url' => self::img('portrait-outdoor'), 'image_side' => 'left']),
                ],
            ],
            [
                'title' => 'Galleries', 'slug' => 'galleries', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Galleries', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('gallery', ['heading' => '', 'columns' => 3, 'layout' => 'landscape', 'lightbox' => true, 'images' => [
                        self::img('beach-sunrise'), self::img('family-couch'), self::img('kids-forest'),
                        self::img('newborn'), self::img('beach-veil'), self::img('ocean-aerial'),
                    ]]),
                ],
            ],
            [
                'title' => 'Journal', 'slug' => 'journal', 'is_home' => false, 'is_blog' => true,
                'blocks' => [
                    self::block('text', ['heading' => 'Journal', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('blog', ['heading' => '', 'columns' => 3, 'limit' => 0, 'per_page' => 9, 'show_categories' => true]),
                ],
            ],
            [
                'title' => 'Contact', 'slug' => 'contact', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Contact', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('contact', ['heading' => "Let's plan your session", 'subheading' => self::LOREM_SENTENCE, 'submit_label' => 'Send enquiry', 'show_phone' => true, 'show_event_date' => true, 'show_event_type' => true]),
                ],
            ],
        ];
    }

    /** @return list<array{title: string, slug: string, is_home: bool, blocks: array}> */
    private static function atelierPages(string $studioName): array
    {
        $blush = ['background' => '#f8f1ee'];

        return [
            [
                'title' => 'Home', 'slug' => 'home', 'is_home' => true,
                'blocks' => [
                    self::block('hero', [
                        'heading' => $studioName, 'subheading' => self::LOREM_LEAD, 'image_url' => self::img('portrait-sheer'),
                        'cta_label' => 'Book a session', 'cta_link' => '/contact', 'overlay' => 30,
                        'height' => 'full', 'title_size' => 'xl', 'text_shadow' => 'soft',
                    ]),
                    self::block('text', ['heading' => 'Portraiture as fine art', 'heading_level' => 'h2', 'body' => self::LOREM, 'align' => 'center'], $blush + ['padding' => 'xl']),
                    self::block('gallery', ['heading' => '', 'columns' => 3, 'layout' => 'portrait', 'lightbox' => true, 'images' => [
                        self::img('portrait-blush'), self::img('portrait-beauty'), self::img('portrait-warm'),
                        self::img('white-dress'), self::img('boudoir'), self::img('portrait-wall'),
                    ]]),
                    self::block('testimonials', ['heading' => 'From my clients', 'items' => [
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'C. M.', 'role' => 'Portrait session'],
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'R. L.', 'role' => 'Boudoir session'],
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'H. B.', 'role' => 'Motherhood session'],
                    ]], $blush),
                    self::block('cta', ['heading' => 'You belong in front of the lens', 'subheading' => self::LOREM_LEAD, 'button_label' => 'Begin here', 'button_link' => '/contact']),
                ],
            ],
            [
                'title' => 'Portfolio', 'slug' => 'portfolio', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Portfolio', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('gallery', ['heading' => '', 'columns' => 3, 'layout' => 'portrait', 'lightbox' => true, 'images' => [
                        self::img('portrait-sheer'), self::img('white-dress'), self::img('portrait-blush'),
                        self::img('boudoir'), self::img('portrait-warm'), self::img('portrait-beauty'),
                        self::img('rose-still'), self::img('portrait-wall'), self::img('bw-headwrap'),
                    ]]),
                ],
            ],
            [
                'title' => 'Investment', 'slug' => 'investment', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Investment', 'heading_level' => 'h1', 'body' => self::LOREM, 'align' => 'center']),
                    self::block('about', ['heading' => 'The Collection', 'body' => self::LOREM."\n\n".self::LOREM_BULLETS, 'image_url' => self::img('rose-still'), 'image_side' => 'left'], $blush),
                    self::block('about', ['heading' => 'The Heirloom', 'body' => self::LOREM."\n\n".self::LOREM_BULLETS, 'image_url' => self::img('white-dress'), 'image_side' => 'right']),
                    self::block('newsletter', ['heading' => 'Session dates & offers', 'subheading' => self::LOREM_SENTENCE, 'placeholder' => 'Your email address', 'button_label' => 'Keep me posted', 'success_message' => "You're on the list — thank you!", 'show_name' => false], $blush),
                ],
            ],
            [
                'title' => 'Journal', 'slug' => 'journal', 'is_home' => false, 'is_blog' => true,
                'blocks' => [
                    self::block('text', ['heading' => 'Journal', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('blog', ['heading' => '', 'columns' => 3, 'limit' => 0, 'per_page' => 9, 'show_categories' => true]),
                ],
            ],
            [
                'title' => 'Contact', 'slug' => 'contact', 'is_home' => false,
                'blocks' => [
                    self::block('text', ['heading' => 'Enquire', 'heading_level' => 'h1', 'body' => self::LOREM_LEAD, 'align' => 'center']),
                    self::block('contact', ['heading' => 'Tell me about your session', 'subheading' => self::LOREM_SENTENCE, 'submit_label' => 'Send enquiry', 'show_phone' => true, 'show_event_date' => true, 'show_event_type' => true]),
                ],
            ],
        ];
    }

    /**
     * Heirloom — a light, timeless wedding template modelled on the classic
     * Pixieset look: slider hero, centred serif intros, soft grey bands, a
     * three-gallery portfolio and info pages (experience/services/testimonials).
     *
     * @return list<array{title: string, slug: string, is_home: bool, blocks: array}>
     */
    private static function heirloomPages(string $studioName): array
    {
        $band = ['background' => '#f5f4f2'];

        // The recurring "Ready to connect? / Get in touch" band that closes most
        // pages: a centred heading + an outline button on one soft-grey strip.
        $ctaBand = fn (): array => [
            self::block('text', [
                'heading' => 'Get in touch',
                'heading_level' => 'h2',
                'body' => 'Ready to connect?',
                'align' => 'center',
            ], $band + ['pad_top' => 'xl', 'pad_bottom' => 'none']),
            self::block('button', [
                'label' => 'Contact me',
                'link' => '/contact',
                'align' => 'center',
                'style' => 'outline',
            ], $band + ['pad_top' => 'sm', 'pad_bottom' => 'xl']),
        ];

        // A "Title / tagline / View more" teaser column (used in the 3-up rows
        // that cross-link the portfolio, testimonials and services pages).
        $teaser = fn (string $title, string $tagline, string $link): array => [
            self::block('text', [
                'heading' => $title,
                'heading_level' => 'h3',
                'body' => $tagline,
                'align' => 'center',
            ], ['pad_bottom' => 'none']),
            self::block('button', [
                'label' => 'View more',
                'link' => $link,
                'align' => 'center',
                'style' => 'outline',
            ], ['pad_top' => 'sm']),
        ];

        // A gallery page (Weddings / Couples / Engagements): title + masonry.
        $galleryPage = fn (string $title, string $slug, array $images): array => [
            'title' => $title,
            'slug' => $slug,
            'is_home' => false,
            'blocks' => [
                self::block('text', [
                    'heading' => $title,
                    'heading_level' => 'h1',
                    'body' => 'Scroll for more',
                    'align' => 'center',
                ], ['pad_bottom' => 'sm']),
                self::block('gallery', ['heading' => '', 'columns' => 3, 'layout' => 'masonry', 'lightbox' => true, 'images' => $images]),
            ],
        ];

        return [
            // ── Home ──
            [
                'title' => 'Home', 'slug' => 'home', 'is_home' => true,
                'blocks' => [
                    // Full-width photo carousel with no copy — the images speak.
                    self::block('slider', [
                        'slides' => [
                            ['image_url' => self::img('bride-bouquet'), 'heading' => '', 'subheading' => '', 'cta_label' => '', 'cta_link' => '', 'focal_x' => 50, 'focal_y' => 50, 'alt' => '', 'title' => ''],
                            ['image_url' => self::img('arch-flowers'), 'heading' => '', 'subheading' => '', 'cta_label' => '', 'cta_link' => '', 'focal_x' => 50, 'focal_y' => 50, 'alt' => '', 'title' => ''],
                            ['image_url' => self::img('table-florals'), 'heading' => '', 'subheading' => '', 'cta_label' => '', 'cta_link' => '', 'focal_x' => 50, 'focal_y' => 50, 'alt' => '', 'title' => ''],
                        ],
                        'autoplay' => true, 'speed' => 5, 'transition' => 'slide',
                        'show_arrows' => true, 'show_dots' => false,
                        'overlay' => 0, 'text_shadow' => 'none', 'title_size' => 'md',
                        'height' => 'custom', 'height_value' => '560px',
                    ]),
                    // Centred serif intro: kicker, big uppercase headline, tagline.
                    self::block('text', [
                        'heading' => '',
                        'body' => 'Fine-art wedding photography, available worldwide',
                        'align' => 'center',
                    ], ['pad_top' => 'lg', 'pad_bottom' => 'none']),
                    self::block('text', [
                        'heading' => 'Authentic, heartfelt wedding photography',
                        'heading_level' => 'h1',
                        'body' => 'Capturing moments since 2005',
                        'align' => 'center',
                    ], ['pad_top' => 'sm', 'pad_bottom' => 'none']),
                    self::block('button', [
                        'label' => 'More about me',
                        'link' => '/about',
                        'align' => 'center',
                        'style' => 'outline',
                    ], ['pad_top' => 'sm', 'pad_bottom' => 'lg']),
                    self::block('gallery', ['heading' => '', 'columns' => 2, 'layout' => 'portrait', 'lightbox' => true, 'images' => [
                        self::img('aisle-gold'), self::img('rings-hands'),
                    ]]),
                    // 3-up teasers cross-linking the info pages.
                    self::block('grid', ['columns' => 3, 'gap' => 'md'], ['pad_top' => 'md', 'pad_bottom' => 'md'], [
                        $teaser('Portfolio', 'See my latest work', '/portfolio'),
                        $teaser('Testimonials', 'Read client reviews', '/testimonials'),
                        $teaser('Services', 'View offerings', '/services'),
                    ]),
                    ...$ctaBand(),
                ],
            ],

            // ── About ──
            [
                'title' => 'About', 'slug' => 'about', 'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => "Hello, I'm so glad you're here",
                        'heading_level' => 'h1',
                        'body' => '',
                        'align' => 'center',
                    ], ['pad_bottom' => 'none']),
                    self::block('about', [
                        'heading' => '',
                        'body' => self::LOREM,
                        'image_url' => self::img('portrait-outdoor'),
                        'image_side' => 'left',
                    ]),
                    self::block('about', [
                        'heading' => 'My approach',
                        'body' => self::LOREM,
                        'image_url' => self::img('table-florals'),
                        'image_side' => 'right',
                    ]),
                    self::block('logos', ['heading' => 'Vendors and partners', 'images' => []], $band),
                    self::block('testimonials', ['heading' => 'Kind words', 'items' => [
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'K. S.', 'role' => 'Married 2026'],
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'A & M', 'role' => 'Married 2025'],
                    ]]),
                    ...$ctaBand(),
                ],
            ],

            // ── Experience ──
            [
                'title' => 'Experience', 'slug' => 'experience', 'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Experience',
                        'heading_level' => 'h1',
                        'body' => 'Working with '.$studioName,
                        'align' => 'center',
                    ]),
                    self::block('text', [
                        'heading' => '',
                        'body' => self::LOREM."\n\n".self::LOREM,
                        'align' => 'center',
                    ], $band + ['padding' => 'lg']),
                    self::block('gallery', ['heading' => 'Portfolio highlights', 'columns' => 2, 'layout' => 'landscape', 'lightbox' => true, 'images' => [
                        self::img('autumn-couple'), self::img('veil-field'),
                    ]]),
                    self::block('button', [
                        'label' => 'View my work',
                        'link' => '/portfolio',
                        'align' => 'center',
                        'style' => 'outline',
                    ], ['pad_top' => 'none', 'pad_bottom' => 'lg']),
                    self::block('faq', ['heading' => 'FAQ', 'items' => [
                        ['q' => '01. How do we book you for the wedding?', 'a' => self::LOREM],
                        ['q' => '02. Do you travel for destination weddings?', 'a' => self::LOREM],
                        ['q' => '03. How do you handle family photos on the day?', 'a' => self::LOREM],
                        ['q' => '04. Do you offer engagement sessions?', 'a' => self::LOREM],
                    ]], $band),
                    ...$ctaBand(),
                ],
            ],

            // ── Services ──
            [
                'title' => 'Services', 'slug' => 'services', 'is_home' => false,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'My service & offerings',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('lawn-ceremony'),
                        'cta_label' => '', 'cta_link' => '',
                        'overlay' => 25, 'title_size' => 'md', 'text_shadow' => 'soft',
                        'height' => 'custom', 'height_value' => '480px',
                    ]),
                    // A big centred pull-quote between the hero and the packages.
                    self::block('text', [
                        'heading' => self::LOREM_SENTENCE,
                        'heading_level' => 'h2',
                        'body' => '',
                        'align' => 'center',
                    ], ['pad_top' => 'xl', 'pad_bottom' => 'sm']),
                    self::block('pricing', ['heading' => 'Packages & offerings', 'plans' => [
                        ['name' => 'Wedding — half day', 'price' => '$1,500', 'period' => '', 'features' => self::LOREM_FEATURES, 'button_label' => 'Inquire today', 'button_link' => '/contact', 'featured' => false],
                        ['name' => 'Wedding — full day', 'price' => '$2,500', 'period' => '', 'features' => self::LOREM_FEATURES, 'button_label' => 'Inquire today', 'button_link' => '/contact', 'featured' => true],
                        ['name' => 'Wedding — full pack', 'price' => '$3,500', 'period' => '', 'features' => self::LOREM_FEATURES, 'button_label' => 'Inquire today', 'button_link' => '/contact', 'featured' => false],
                    ]]),
                    self::block('testimonials', ['heading' => 'Testimonials', 'items' => [
                        ['quote' => self::LOREM_SENTENCE, 'author' => 'J & S', 'role' => 'Married 2026'],
                    ]], $band),
                    ...$ctaBand(),
                ],
            ],

            // ── Testimonials ──
            [
                'title' => 'Testimonials', 'slug' => 'testimonials', 'is_home' => false,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Testimonials',
                        'heading_level' => 'h1',
                        'body' => 'Love letters and kind words from my wonderful clients.',
                        'align' => 'center',
                    ], $band + ['padding' => 'lg']),
                    self::block('about', ['heading' => 'Kind words from K & E', 'body' => self::LOREM, 'image_url' => self::img('autumn-couple'), 'image_side' => 'left']),
                    self::block('about', ['heading' => 'Kind words from A & M', 'body' => self::LOREM, 'image_url' => self::img('veil-field'), 'image_side' => 'right']),
                    self::block('about', ['heading' => 'Kind words from J & S', 'body' => self::LOREM, 'image_url' => self::img('beach-fire'), 'image_side' => 'left']),
                    ...$ctaBand(),
                ],
            ],

            // ── Portfolio (three stacked gallery banners) ──
            [
                'title' => 'Portfolio', 'slug' => 'portfolio', 'is_home' => false,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'Weddings', 'subheading' => '', 'image_url' => self::img('bride-bouquet'),
                        'cta_label' => 'View gallery', 'cta_link' => '/weddings',
                        'overlay' => 20, 'title_size' => 'lg', 'text_shadow' => 'soft',
                        'height' => 'custom', 'height_value' => '380px',
                    ]),
                    self::block('hero', [
                        'heading' => 'Couples', 'heading_level' => 'h2', 'subheading' => '', 'image_url' => self::img('couple-sunset'),
                        'cta_label' => 'View gallery', 'cta_link' => '/couples',
                        'overlay' => 20, 'title_size' => 'lg', 'text_shadow' => 'soft',
                        'height' => 'custom', 'height_value' => '380px',
                    ]),
                    self::block('hero', [
                        'heading' => 'Engagements', 'heading_level' => 'h2', 'subheading' => '', 'image_url' => self::img('rings-hands'),
                        'cta_label' => 'View gallery', 'cta_link' => '/engagements',
                        'overlay' => 20, 'title_size' => 'lg', 'text_shadow' => 'soft',
                        'height' => 'custom', 'height_value' => '380px',
                    ]),
                ],
            ],

            $galleryPage('Weddings', 'weddings', [
                self::img('beach-veil'), self::img('veil-field'), self::img('bride-bouquet'),
                self::img('arch-flowers'), self::img('confetti'), self::img('aisle-gold'),
            ]),
            $galleryPage('Couples', 'couples', [
                self::img('couple-sunset'), self::img('beach-fire'), self::img('bikes-sunset'),
                self::img('autumn-couple'), self::img('field-walk'), self::img('palm-night'),
            ]),
            $galleryPage('Engagements', 'engagements', [
                self::img('rings-hands'), self::img('rings-roses'), self::img('roses-candles'),
                self::img('place-settings'), self::img('lawn-ceremony'), self::img('table-florals'),
            ]),

            // ── Blog ──
            [
                'title' => 'Blog', 'slug' => 'blog', 'is_home' => false, 'is_blog' => true,
                'blocks' => [
                    self::block('text', [
                        'heading' => 'Blog',
                        'heading_level' => 'h1',
                        'body' => self::LOREM_LEAD,
                        'align' => 'center',
                    ], ['pad_bottom' => 'none']),
                    self::block('blog', ['heading' => '', 'columns' => 2, 'limit' => 0, 'per_page' => 6, 'show_categories' => true]),
                ],
            ],

            // ── Contact ──
            [
                'title' => 'Contact', 'slug' => 'contact', 'is_home' => false,
                'blocks' => [
                    self::block('gallery', ['heading' => '', 'columns' => 4, 'layout' => 'square', 'lightbox' => false, 'images' => [
                        self::img('roses-candles'), self::img('white-dress'), self::img('rings-roses'), self::img('portrait-warm'),
                    ]], ['pad_bottom' => 'none']),
                    self::block('text', [
                        'heading' => "Let's connect",
                        'heading_level' => 'h1',
                        'body' => self::LOREM_LEAD,
                        'align' => 'center',
                    ], ['pad_bottom' => 'none']),
                    self::block('contact', [
                        'heading' => '',
                        'subheading' => '',
                        'submit_label' => 'Send message',
                        'show_phone' => true,
                        'show_event_date' => true,
                        'show_event_type' => true,
                    ]),
                ],
            ],
        ];
    }

    public static function posts(string $key): array
    {
        return [
            [
                'title' => 'A spring wedding by the sea',
                'slug' => 'a-spring-wedding-by-the-sea',
                'excerpt' => self::LOREM_SENTENCE,
                'cover_image' => self::img('beach-veil'),
                'status' => 'published',
                'days_ago' => 4,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'A spring wedding by the sea',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('beach-veil'),
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('text', [
                        'heading' => '',
                        'body' => self::LOREM,
                        'align' => 'left',
                    ]),
                    self::block('gallery', ['heading' => 'A few favourites', 'columns' => 3, 'images' => [
                        self::img('veil-field'), self::img('rings-hands'), self::img('table-florals'),
                    ]]),
                ],
            ],
            [
                'title' => 'Why I love golden hour portraits',
                'slug' => 'why-i-love-golden-hour-portraits',
                'excerpt' => self::LOREM_SENTENCE,
                'cover_image' => self::img('autumn-couple'),
                'status' => 'published',
                'days_ago' => 12,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'Why I love golden hour portraits',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => self::img('autumn-couple'),
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('text', [
                        'heading' => '',
                        'body' => self::LOREM,
                        'align' => 'left',
                    ]),
                ],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $settings  Optional block style (background, text_color, padding…)
     * @param  list<list<array>>  $children  For grid blocks: one list of child blocks per column.
     */
    private static function block(string $type, array $data, array $settings = [], array $children = []): array
    {
        $block = [
            'id' => (string) Str::uuid(),
            'type' => $type,
            'data' => $data,
        ];

        if ($settings !== []) {
            $block['settings'] = $settings;
        }

        if ($children !== []) {
            $block['children'] = $children;
        }

        return $block;
    }
}
