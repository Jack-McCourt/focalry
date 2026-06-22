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
    ];

    public const DEFAULT = 'portfolio';

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

    /** @return array{primary_color: string, font: string} */
    public static function theme(string $key): array
    {
        return match ($key) {
            'editorial' => ['primary_color' => '#b0654f', 'font' => 'serif'],
            'studio' => ['primary_color' => '#4f46e5', 'font' => 'sans'],
            default => ['primary_color' => '#171717', 'font' => 'sans'],
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
                        'subheading' => 'Timeless photography for the moments that matter most.',
                        'image_url' => '',
                        'cta_label' => 'Enquire now',
                        'cta_link' => '/contact',
                        'overlay' => 35,
                        'align' => 'center',
                    ]),
                    self::block('services', [
                        'heading' => 'What I offer',
                        'items' => [
                            ['title' => 'Weddings', 'description' => 'Full-day coverage telling the story of your celebration.', 'price' => 'From $2,400'],
                            ['title' => 'Portraits', 'description' => 'Relaxed individual, couple and family sessions.', 'price' => 'From $350'],
                            ['title' => 'Events', 'description' => 'Corporate and private events, candid and considered.', 'price' => 'From $600'],
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
                        'subheading' => 'A little about who I am and how I work.',
                        'image_url' => '',
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => "Hi, I'm a photographer",
                        'body' => "I love telling stories through light and emotion. Whether it's a wedding, a portrait "
                            .'session or a special event, my goal is to capture authentic moments you can relive for years to come.',
                        'image_url' => '',
                        'image_side' => 'left',
                    ]),
                    self::block('services', [
                        'heading' => 'How it works',
                        'items' => [
                            ['title' => '1. Get in touch', 'description' => 'Tell me about your day and what you have in mind.', 'price' => ''],
                            ['title' => '2. The shoot', 'description' => 'Relaxed, unobtrusive and fun — just be yourselves.', 'price' => ''],
                            ['title' => '3. Your gallery', 'description' => 'A beautifully edited online gallery to keep forever.', 'price' => ''],
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
                        'body' => 'Recent shoots, stories and behind-the-scenes.',
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
                        'body' => "Tell me about your day and I'll be in touch within 48 hours.",
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
                        'subheading' => 'Fine-art wedding photography for couples who love timeless, editorial imagery.',
                        'image_url' => '',
                        'cta_label' => 'Enquire',
                        'cta_link' => '/contact',
                        'overlay' => 35,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => 'A storyteller at heart',
                        'body' => 'I photograph weddings the way they feel — unhurried, emotive and full of light. '
                            ."Every collection is crafted to feel like a piece of art you'll return to for a lifetime.",
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
                            ['title' => 'Weddings', 'description' => 'Full-day, narrative coverage from prep to the last dance.', 'price' => 'From $3,200'],
                            ['title' => 'Elopements', 'description' => 'Intimate ceremonies, captured with care and intention.', 'price' => 'From $1,800'],
                            ['title' => 'Engagements', 'description' => 'A relaxed session to celebrate the year before the day.', 'price' => 'From $500'],
                        ],
                    ], ['background' => '#f7efe9']),
                    self::block('blog', [
                        'heading' => 'From the journal',
                        'columns' => 3,
                        'limit' => 3,
                    ]),
                    self::block('text', [
                        'heading' => "Let's tell your story",
                        'body' => 'Now booking a limited number of weddings each season.',
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
                        'body' => 'A selection of recent weddings, elopements and portraits.',
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
                        'subheading' => 'The person behind the camera.',
                        'image_url' => '',
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('about', [
                        'heading' => "Hello, I'm so glad you're here",
                        'body' => 'I believe the best photographs come from genuine connection. When we work together '
                            ."you won't be posed and prodded — you'll be free to simply be with the people you love, while "
                            .'I quietly capture it all.',
                        'image_url' => '',
                        'image_side' => 'left',
                    ]),
                    self::block('services', [
                        'heading' => 'How we work together',
                        'items' => [
                            ['title' => '01 — Enquire', 'description' => 'Share your date and vision, and we’ll see if we’re a fit.', 'price' => ''],
                            ['title' => '02 — Plan', 'description' => 'A relaxed consultation to map out your day together.', 'price' => ''],
                            ['title' => '03 — Relive', 'description' => 'A beautifully edited gallery, delivered with care.', 'price' => ''],
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
                        'body' => 'Thoughtfully designed collections, tailored to your day.',
                        'align' => 'center',
                        'heading_level' => 'h1',
                    ]),
                    self::block('packages', [
                        'heading' => 'Wedding collections',
                        'subheading' => 'Every collection can be customised — these are a starting point.',
                        'columns' => 3,
                    ]),
                    self::block('services', [
                        'heading' => 'Always included',
                        'items' => [
                            ['title' => 'Pre-wedding consult', 'description' => 'We plan your timeline so the day flows effortlessly.', 'price' => ''],
                            ['title' => 'A second photographer', 'description' => 'Two perspectives on every meaningful moment.', 'price' => ''],
                            ['title' => 'Private online gallery', 'description' => 'High-resolution images, ready to download and share.', 'price' => ''],
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
                        'body' => 'Real weddings, gentle advice and moments from behind the camera.',
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
                        'body' => "Tell me about your day and I'll be in touch within 48 hours.",
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
                        'subheading' => 'Modern wedding & portrait photography — clean, candid and full of life.',
                        'image_url' => '',
                        'cta_label' => 'Book a call',
                        'cta_link' => '/contact',
                        'overlay' => 40,
                        'align' => 'left',
                    ]),
                    self::block('services', [
                        'heading' => 'Services',
                        'items' => [
                            ['title' => 'Weddings', 'description' => 'Documentary coverage of your whole day.', 'price' => 'From $2,800'],
                            ['title' => 'Portraits', 'description' => 'Individuals, couples and families.', 'price' => 'From $400'],
                            ['title' => 'Brand & events', 'description' => 'Editorial imagery for people and businesses.', 'price' => 'From $700'],
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
                        'body' => 'I’m a photographer who cares less about stiff poses and more about real moments. '
                            .'Expect a relaxed, easy experience and images that actually look like you.',
                        'image_url' => '',
                        'image_side' => 'left',
                    ]),
                    self::block('packages', [
                        'heading' => 'Packages',
                        'subheading' => 'Simple, transparent pricing.',
                        'columns' => 3,
                    ]),
                    self::block('blog', [
                        'heading' => 'Latest stories',
                        'columns' => 3,
                        'limit' => 3,
                    ]),
                    self::block('text', [
                        'heading' => 'Ready when you are',
                        'body' => 'Tell me about your project and let’s make something great.',
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
                        'body' => 'A look at recent shoots.',
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
                        'body' => 'Recent shoots, stories and the occasional tip.',
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
                        'body' => 'Tell me a little about what you have in mind.',
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
                'excerpt' => 'A radiant coastal celebration full of colour, salt air and happy tears.',
                'cover_image' => '',
                'status' => 'published',
                'days_ago' => 4,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'A spring wedding by the sea',
                        'subheading' => 'Coastal vows, golden light and a day to remember.',
                        'image_url' => '',
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('text', [
                        'heading' => '',
                        'body' => "There's something magical about a wedding by the water. The light is soft, the air is "
                            .'fresh, and every frame feels effortless. We spent the golden hour wandering the dunes while '
                            .'the couple soaked in their first moments as newlyweds.',
                        'align' => 'left',
                    ]),
                    self::block('gallery', ['heading' => 'A few favourites', 'columns' => 3, 'images' => []]),
                ],
            ],
            [
                'title' => 'Why I love golden hour portraits',
                'slug' => 'why-i-love-golden-hour-portraits',
                'excerpt' => 'The last hour of light is pure magic — here is how I make the most of it.',
                'cover_image' => '',
                'status' => 'published',
                'days_ago' => 12,
                'blocks' => [
                    self::block('hero', [
                        'heading' => 'Why I love golden hour portraits',
                        'subheading' => 'Chasing the best light of the day.',
                        'image_url' => '',
                        'cta_label' => '',
                        'cta_link' => '',
                        'overlay' => 30,
                        'align' => 'center',
                    ]),
                    self::block('text', [
                        'heading' => '',
                        'body' => 'Golden hour — that fleeting window just after sunrise or before sunset — gives portraits a '
                            .'warmth and softness that no studio light can quite match. Here are a few reasons it remains my '
                            .'favourite time to photograph people.',
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
