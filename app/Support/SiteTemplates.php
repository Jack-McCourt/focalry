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
        return [
            'primary_color' => '#171717',
            'font' => 'sans',
        ];
    }

    /** @return list<array{label: string, kind: string, target: string}> */
    public static function headerNav(string $key): array
    {
        return [
            ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
            ['label' => 'About', 'kind' => 'page', 'target' => 'about'],
            ['label' => 'Blog', 'kind' => 'page', 'target' => 'blog'],
            ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
        ];
    }

    /** @return list<array{label: string, kind: string, target: string}> */
    public static function footerNav(string $key): array
    {
        return [
            ['label' => 'Home', 'kind' => 'page', 'target' => 'home'],
            ['label' => 'About', 'kind' => 'page', 'target' => 'about'],
            ['label' => 'Blog', 'kind' => 'page', 'target' => 'blog'],
            ['label' => 'Contact', 'kind' => 'page', 'target' => 'contact'],
        ];
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

    /** @param array<string, mixed> $data */
    private static function block(string $type, array $data): array
    {
        return [
            'id' => (string) Str::uuid(),
            'type' => $type,
            'data' => $data,
        ];
    }
}
