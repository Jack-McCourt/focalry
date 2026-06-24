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
        'portfolio' => [
            'name' => 'Portfolio',
            'description' => 'A multi-page site: home, about, a blog and a contact page — with sensible blocks on each.',
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
    ];

    public const DEFAULT = 'portfolio';

    // Placeholder copy — the starter templates use lorem ipsum for all long-form
    // text so they ship anonymised (studios replace it with their own words).
    private const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure.';

    private const LOREM_LEAD = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

    private const LOREM_SENTENCE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor.';

    private const LOREM_FEATURES = "Lorem ipsum dolor sit\nConsectetur adipiscing elit\nSed do eiusmod tempor\nUt labore et dolore magna";

    private const LOREM_BULLETS = "• Lorem ipsum dolor sit amet\n• Consectetur adipiscing elit\n• Sed do eiusmod tempor incididunt\n• Ut labore et dolore magna";

    /** @return list<array{key: string, name: string, description: string}> */
    public static function all(): array
    {
        return collect(self::META)
            ->map(fn ($meta, $key) => ['key' => $key] + $meta)
            ->values()
            ->all();
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
                        'image_url' => '',
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
                        'images' => [],
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
                        'image_url' => '',
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => "Hi, I'm a photographer",
                        'body' => self::LOREM,
                        'image_url' => '',
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
                        'image_url' => '',
                        'cta_label' => 'Enquire',
                        'cta_link' => '/contact',
                        'overlay' => 35,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => 'A storyteller at heart',
                        'body' => self::LOREM,
                        'image_url' => '',
                        'image_side' => 'right',
                    ]),
                    self::block('gallery', [
                        'heading' => 'Selected work',
                        'columns' => 2,
                        'layout' => 'portrait',
                        'lightbox' => true,
                        'images' => [],
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
                        'images' => [],
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
                        'image_url' => '',
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => "Hello, I'm so glad you're here",
                        'body' => self::LOREM,
                        'image_url' => '',
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
                        'image_url' => '',
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
                        'images' => [],
                    ]),
                    self::block('about', [
                        'heading' => 'A little about me',
                        'body' => self::LOREM,
                        'image_url' => '',
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
                        'images' => [],
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
                        'image_url' => '',
                        'cta_label' => 'Enquire',
                        'cta_link' => '/contact',
                        'overlay' => 40,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => 'Candid moments, beautifully told',
                        'body' => self::LOREM,
                        'image_url' => '',
                        'image_side' => 'left',
                    ]),
                    self::block('gallery', [
                        'heading' => 'Recent weddings',
                        'columns' => 3,
                        'layout' => 'square',
                        'lightbox' => true,
                        'images' => [],
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
                        'image_url' => '',
                        'image_side' => 'right',
                    ]),
                    self::block('about', [
                        'heading' => 'Our approach',
                        'body' => self::LOREM,
                        'image_url' => '',
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
                        'images' => [],
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
                        'image_url' => '',
                        'image_side' => 'left',
                    ]),
                    self::block('about', [
                        'heading' => 'The Big One — £1,150',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => '',
                        'image_side' => 'right',
                    ]),
                    self::block('about', [
                        'heading' => 'Both of Us — £1,450',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => '',
                        'image_side' => 'left',
                    ]),
                    // The premium tier is featured with a soft background.
                    self::block('about', [
                        'heading' => 'All the Bells and Whistles — £1,850',
                        'body' => self::LOREM_BULLETS,
                        'image_url' => '',
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
    public static function posts(string $key): array
    {
        return [
            [
                'title' => 'A spring wedding by the sea',
                'slug' => 'a-spring-wedding-by-the-sea',
                'excerpt' => self::LOREM_SENTENCE,
                'cover_image' => '',
                'status' => 'published',
                'days_ago' => 4,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'A spring wedding by the sea',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => '',
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
                    self::block('gallery', ['heading' => 'A few favourites', 'columns' => 3, 'images' => []]),
                ],
            ],
            [
                'title' => 'Why I love golden hour portraits',
                'slug' => 'why-i-love-golden-hour-portraits',
                'excerpt' => self::LOREM_SENTENCE,
                'cover_image' => '',
                'status' => 'published',
                'days_ago' => 12,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'Why I love golden hour portraits',
                        'subheading' => self::LOREM_LEAD,
                        'image_url' => '',
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
     */
    private static function block(string $type, array $data, array $settings = []): array
    {
        $block = [
            'id' => (string) Str::uuid(),
            'type' => $type,
            'data' => $data,
        ];

        if ($settings !== []) {
            $block['settings'] = $settings;
        }

        return $block;
    }
}
