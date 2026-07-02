import { BlogPostCard, PackageCard, SiteBlock, SiteBlockType, SiteCategory, SiteTheme } from '@/types';
import { formatMoney } from '@/lib/money';
import { buildSrcSet } from '@/lib/responsiveImage';
import LazyRichTextEditor from '@/Components/LazyRichTextEditor';
import { useForm } from '@inertiajs/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Event types offered in the contact form. These match the studio's default
// ProjectType labels so a submitted enquiry links straight to the right type.
export const EVENT_TYPES = ['Wedding', 'Couples Shoot', 'Corporate', 'Portrait', 'Event', 'Other'];

export interface BlockMeta {
    type: SiteBlockType;
    label: string;
    hint: string;
    make: () => Record<string, unknown>;
}

// The palette of blocks a studio can add. Add an entry here (+ a case in
// BlockView and BlockEditor) to introduce a new modular block type.
export const BLOCK_LIBRARY: BlockMeta[] = [
    {
        type: 'hero',
        label: 'Hero',
        hint: 'Large banner with a headline and call-to-action',
        make: () => ({ heading: 'Your headline', subheading: 'A short supporting line', image_url: '', cta_label: 'Get in touch', cta_link: '#contact', overlay: 35, content_x: 'center', content_y: 'center', text_align: 'center', text_shadow: 'none', title_size: 'md', height: 'default', height_value: '600px', focal_x: 50, focal_y: 50, text_bg: 'none', text_bg_color: '#000000', text_bg_opacity: 60, text_bg_extent: 65 }),
    },
    {
        type: 'slider',
        label: 'Slider / carousel',
        hint: 'A rotating banner of image slides, each with its own text',
        make: () => ({
            slides: [
                { image_url: '', heading: 'Your first slide', subheading: 'A short supporting line', cta_label: '', cta_link: '', focal_x: 50, focal_y: 50, alt: '', title: '' },
                { image_url: '', heading: 'Your second slide', subheading: 'Tell another part of the story', cta_label: '', cta_link: '', focal_x: 50, focal_y: 50, alt: '', title: '' },
            ],
            autoplay: true,
            speed: 5,
            transition: 'slide',
            show_arrows: true,
            show_dots: true,
            overlay: 35,
            content_x: 'center',
            content_y: 'center',
            text_align: 'center',
            text_shadow: 'soft',
            title_size: 'lg',
            height: 'default',
            height_value: '600px',
            text_bg: 'none',
            text_bg_color: '#000000',
            text_bg_opacity: 60,
            text_bg_extent: 65,
        }),
    },
    {
        type: 'about',
        label: 'Image/text',
        hint: 'Image alongside a block of text',
        make: () => ({ heading: 'About', body: 'Tell visitors who you are and what you do.', image_url: '', image_side: 'left' }),
    },
    {
        type: 'card',
        label: 'Card',
        hint: 'Image card with a title and text',
        make: () => ({ image_url: '', heading: 'Card title', body: 'Add a short bit of text about this card.', image_ratio: 'none' }),
    },
    {
        type: 'services',
        label: 'Services',
        hint: 'A grid of offerings with prices',
        make: () => ({ heading: 'Services', items: [{ title: 'Service', description: 'What it includes', price: 'From $0' }] }),
    },
    {
        type: 'gallery',
        label: 'Gallery',
        hint: 'A responsive grid of images',
        make: () => ({ heading: 'Gallery', columns: 3, images: [], layout: 'square', lightbox: true, full_width: false }),
    },
    {
        type: 'blog',
        label: 'Blog posts',
        hint: 'A grid of your latest blog posts',
        make: () => ({ heading: 'From the journal', columns: 3, limit: 0, show_categories: true }),
    },
    {
        type: 'packages',
        label: 'Packages',
        hint: 'A grid of your bookable packages with a Book button',
        make: () => ({ heading: 'Packages', subheading: '', columns: 3 }),
    },
    {
        type: 'reviews',
        label: 'Google Reviews',
        hint: 'Show your Google business reviews — connect to load them',
        make: () => ({
            heading: 'What our clients say',
            subheading: '',
            place_id: '',
            layout: 'carousel',
            columns: 3,
            per_view: 3,
            autoplay: true,
            summary_inline: false,
            speed: 5,
            max: 5,
            min_rating: 0,
            show_avatar: true,
            show_date: true,
            show_summary: true,
            link_to_google: true,
            business: null,
            reviews: [],
        }),
    },
    {
        type: 'text',
        label: 'Text',
        hint: 'A simple heading and paragraph',
        make: () => ({ heading: 'Heading', heading_level: 'h2', body: 'Write something here.', align: 'left' }),
    },
    {
        type: 'image',
        label: 'Image',
        hint: 'A single full-width image with a caption',
        make: () => ({ image_url: '', caption: '', alt: '' }),
    },
    {
        type: 'video',
        label: 'Video',
        hint: 'Embed a YouTube or Vimeo video',
        make: () => ({ url: '', caption: '' }),
    },
    {
        type: 'button',
        label: 'Button',
        hint: 'A call-to-action button',
        make: () => ({ label: 'Learn more', link: '#contact', align: 'center', style: 'solid' }),
    },
    {
        type: 'cta',
        label: 'Call to action',
        hint: 'A bold banner with a heading and button',
        make: () => ({ heading: 'Ready to book?', subheading: "Let's create something beautiful together.", button_label: 'Get in touch', button_link: '#contact' }),
    },
    {
        type: 'faq',
        label: 'FAQ',
        hint: 'A list of expandable questions & answers',
        make: () => ({ heading: 'Frequently asked questions', items: [{ q: 'A question?', a: 'The answer.' }] }),
    },
    {
        type: 'testimonials',
        label: 'Testimonials',
        hint: 'Quotes from happy clients',
        make: () => ({ heading: 'Kind words', items: [{ quote: 'An absolute dream to work with.', author: 'A. Client', role: '' }] }),
    },
    {
        type: 'pricing',
        label: 'Pricing table',
        hint: 'Columns of plans with features',
        make: () => ({ heading: 'Pricing', plans: [{ name: 'Essential', price: '$1,500', period: '', features: 'Up to 6 hours\nOnline gallery\n200+ edited photos', button_label: 'Enquire', button_link: '#contact', featured: false }] }),
    },
    {
        type: 'logos',
        label: 'Logo bar',
        hint: 'A row of partner / "as seen in" logos',
        make: () => ({ heading: 'As featured in', images: [] }),
    },
    {
        type: 'map',
        label: 'Map',
        hint: 'An embedded map of your location',
        make: () => ({ query: '', height: 360 }),
    },
    {
        type: 'embed',
        label: 'Embed / HTML',
        hint: 'Paste an embed code or custom HTML',
        make: () => ({ html: '' }),
    },
    {
        type: 'divider',
        label: 'Divider / spacer',
        hint: 'A horizontal line or blank space',
        make: () => ({ style: 'line', size: 'md' }),
    },
    {
        type: 'contact',
        label: 'Contact form',
        hint: 'Capture enquiries — creates a lead in your CRM',
        make: () => ({ heading: "Let's talk", subheading: '', submit_label: 'Send enquiry', show_phone: true, show_event_date: true, show_event_type: true, custom_fields: [], allow_file: false, file_label: 'Attach a file (optional)', redirect_url: '', autoresponder: false, autoresponder_subject: 'Thanks for your enquiry', autoresponder_message: "Thanks for getting in touch — we've received your enquiry and will reply as soon as we can.", tracking_event: '', conversion_code: '' }),
    },
    {
        type: 'grid',
        label: 'Grid / columns',
        hint: 'A multi-column container — drop other blocks inside each column',
        make: () => ({ columns: 2, gap: 'md' }),
    },
];

export function blockLabel(type: SiteBlockType): string {
    return BLOCK_LIBRARY.find((b) => b.type === type)?.label ?? type;
}

function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Deep-clone a block subtree, assigning fresh ids throughout (for duplicate). */
export function cloneBlock(block: SiteBlock): SiteBlock {
    const data = typeof structuredClone === 'function' ? structuredClone(block.data) : JSON.parse(JSON.stringify(block.data));
    return {
        ...block,
        id: newId(),
        data,
        settings: block.settings ? { ...block.settings } : undefined,
        children: block.children?.map((col) => col.map((c) => cloneBlock(c))),
    };
}

/** Move a block to a new index within the top-level list (drag reorder). */
export function reorderTopLevel(blocks: SiteBlock[], from: number, to: number): SiteBlock[] {
    if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
    const copy = [...blocks];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
}

export function makeBlock(type: SiteBlockType): SiteBlock {
    const meta = BLOCK_LIBRARY.find((b) => b.type === type)!;
    const block: SiteBlock = { id: newId(), type, data: meta.make() };
    // A grid starts with one empty column array per column.
    if (type === 'grid') {
        const cols = Number((block.data as any).columns) || 2;
        block.children = Array.from({ length: cols }, () => []);
    }
    return block;
}

export function fontClass(theme: SiteTheme): string {
    return theme.font === 'serif' ? 'font-serif' : 'font-sans';
}

/** Hero title (h1) size presets (key → responsive Tailwind classes). */
export const HERO_TITLE_SIZES: Record<string, string> = {
    sm: 'text-3xl sm:text-4xl',
    md: 'text-3xl sm:text-5xl',
    lg: 'text-4xl sm:text-6xl',
    xl: 'text-5xl sm:text-7xl',
};

/** Text-shadow presets for the hero block (key → CSS text-shadow). */
export const HERO_TEXT_SHADOWS: Record<string, string> = {
    soft: '0 1px 3px rgba(0,0,0,0.45)',
    medium: '0 2px 6px rgba(0,0,0,0.55)',
    strong: '0 3px 14px rgba(0,0,0,0.75)',
};

/** Hex (#rgb / #rrggbb) → rgba() string at the given 0–1 alpha. */
export function hexToRgba(hex: string | undefined, alpha: number): string {
    const h = (hex || '#000000').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Normalise a hero "custom height" value: `%` is read as viewport height. */
export function heroHeight(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '68vh';
    if (raw.endsWith('%')) return `${parseFloat(raw)}vh`;
    if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}px`;
    return raw; // already has a unit (px, vh, rem, …)
}

/** Turn a YouTube/Vimeo watch URL into an embeddable iframe URL. */
export function videoEmbedUrl(url: string | undefined): string | null {
    const u = (url ?? '').trim();
    if (!u) return null;
    const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return null;
}

// ─── Recursive block-tree helpers (blocks may be nested inside grid columns) ──

export function findBlock(blocks: SiteBlock[], id: string): SiteBlock | null {
    for (const b of blocks) {
        if (b.id === id) return b;
        if (b.children) {
            for (const col of b.children) {
                const found = findBlock(col, id);
                if (found) return found;
            }
        }
    }
    return null;
}

export function updateBlockInTree(blocks: SiteBlock[], id: string, fn: (b: SiteBlock) => SiteBlock): SiteBlock[] {
    return blocks.map((b) => {
        if (b.id === id) return fn(b);
        if (b.children) return { ...b, children: b.children.map((col) => updateBlockInTree(col, id, fn)) };
        return b;
    });
}

export function removeBlockFromTree(blocks: SiteBlock[], id: string): SiteBlock[] {
    return blocks
        .filter((b) => b.id !== id)
        .map((b) => (b.children ? { ...b, children: b.children.map((col) => removeBlockFromTree(col, id)) } : b));
}

export function addChildToGrid(blocks: SiteBlock[], gridId: string, col: number, child: SiteBlock): SiteBlock[] {
    return blocks.map((b) => {
        if (b.id === gridId) {
            const children = (b.children ?? []).map((c) => [...c]);
            while (children.length <= col) children.push([]);
            children[col] = [...children[col], child];
            return { ...b, children };
        }
        if (b.children) return { ...b, children: b.children.map((c) => addChildToGrid(c, gridId, col, child)) };
        return b;
    });
}

/** Move a block one step within its own sibling list (top-level or a grid column). */
export function moveBlockInTree(blocks: SiteBlock[], id: string, dir: -1 | 1): SiteBlock[] {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx !== -1) {
        const next = idx + dir;
        if (next < 0 || next >= blocks.length) return blocks;
        const copy = [...blocks];
        [copy[idx], copy[next]] = [copy[next], copy[idx]];
        return copy;
    }
    return blocks.map((b) => (b.children ? { ...b, children: b.children.map((col) => moveBlockInTree(col, id, dir)) } : b));
}

// Editing affordances passed down to BlockView in the builder preview.
export interface BlockEditing {
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onAddChild: (gridId: string, col: number, type: SiteBlockType) => void;
    /** Open the larger configuration popup for a block (e.g. Google Reviews). */
    onConfigure?: (id: string) => void;
    /** Commit an in-place text edit: replaces the block's data object. */
    onEditData?: (id: string, data: Record<string, unknown>) => void;
}

// ─── Renderer ───────────────────────────────────────────────────────────────

interface BlockViewProps {
    block: SiteBlock;
    theme: SiteTheme;
    slug: string;
    /** URL prefix for in-site links/forms ("/site/{slug}" or "" on a custom domain). */
    basePath?: string;
    /** true on the live public site (forms post); false in the builder preview. */
    interactive: boolean;
    /** Published blog posts, injected for `blog` blocks. */
    posts?: BlogPostCard[];
    /** The site's full category tree, injected for `blog` blocks (filter). */
    categories?: SiteCategory[];
    /** Active packages, injected for `packages` blocks. */
    packages?: PackageCard[];
    /** Builder-only editing affordances (click-to-select, chrome, nesting). */
    editing?: BlockEditing;
}

/**
 * Maps a block's "Container width" style setting to a Tailwind max-w-* class,
 * falling back to the block's own default when the setting is unset.
 */
export function containerW(width: string | undefined, fallback: string): string {
    switch (width) {
        case 'sm': return 'max-w-3xl';
        case 'md': return 'max-w-5xl';
        case 'lg': return 'max-w-7xl';
        case 'full': return 'max-w-none';
        default: return fallback;
    }
}

/**
 * The hero banner: a full-bleed image with an overlaid heading/sub/CTA. Shared
 * by the `hero` block and the auto-generated blog post header (PostHeader) so
 * both offer the exact same formatting options.
 *
 * `d` carries the same loose keys the hero block uses: image_url, focal_x/y,
 * overlay, text_bg(+color/opacity/extent), content_x/y, text_align, title_size,
 * text_shadow, height(+height_value), heading, subheading, cta_label/cta_link.
 */
export function HeroSection({ d, theme, width, sectionId, children, onEditHeading, onEditSubheading }: { d: Record<string, any>; theme: SiteTheme; width?: string; sectionId?: string; children?: React.ReactNode; onEditHeading?: (v: string) => void; onEditSubheading?: (v: string) => void }) {
    const primary = theme.primary_color;
    const cw = (fallback: string) => containerW(width, fallback);

    // Back-compat: the old single `align` field meant left/centered. It now
    // maps onto the new horizontal-position + text-alignment controls.
    const cx = d.content_x ?? (d.align === 'left' ? 'left' : 'center');
    const cy = d.content_y ?? 'center';
    const ta = d.text_align ?? d.align ?? 'center';
    const vCls = cy === 'top' ? 'justify-start' : cy === 'bottom' ? 'justify-end' : 'justify-center';
    const hCls = cx === 'left' ? 'items-start' : cx === 'right' ? 'items-end' : 'items-center';
    const tCls = ta === 'left' ? 'text-left' : ta === 'right' ? 'text-right' : 'text-center';
    // Height: default banner, full viewport, or a custom px/% value. "Full" fills
    // the viewport minus the sticky header so it doesn't overflow past one screen.
    const heightMode = d.height ?? 'default';
    const heightCls = heightMode === 'full' || heightMode === 'custom' ? '' : 'min-h-[68vh]';
    const heightStyle =
        heightMode === 'full'
            ? { minHeight: 'calc(100svh - var(--site-header-h, 4rem))' }
            : heightMode === 'custom'
                ? { minHeight: heroHeight(d.height_value) }
                : undefined;
    const focalX = d.focal_x ?? 50;
    const focalY = d.focal_y ?? 50;
    const textShadow = HERO_TEXT_SHADOWS[d.text_shadow as string] ?? undefined;
    return (
        <section id={sectionId} className={`relative flex ${heightCls} flex-col ${vCls} overflow-hidden px-6 py-24 sm:px-10`} style={heightStyle}>
            {d.image_url ? (
                // The hero is the usual LCP element — hint the browser to fetch it first.
                <RetryImg src={d.image_url} alt={d.alt || ''} title={d.title || undefined} fetchPriority="high" sizes="100vw" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${focalX}% ${focalY}%` }} />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
            )}
            <div className="absolute inset-0 bg-black" style={{ opacity: (Number(d.overlay) || 0) / 100 }} />
            {d.text_bg === 'gradient' && (
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 top-0"
                    style={{
                        background: `linear-gradient(to top, ${hexToRgba(d.text_bg_color, (Number(d.text_bg_opacity) ?? 60) / 100)} 0%, transparent ${Number(d.text_bg_extent) || 65}%)`,
                    }}
                />
            )}
            <div className={`relative mx-auto flex w-full ${cw('max-w-6xl')} flex-col ${hCls} ${tCls}`} style={textShadow ? { textShadow } : undefined}>
                <div
                    className={d.text_bg === 'panel' ? 'rounded-2xl px-8 py-7 sm:px-10 sm:py-8' : ''}
                    style={d.text_bg === 'panel' ? { backgroundColor: hexToRgba(d.text_bg_color, (Number(d.text_bg_opacity) ?? 55) / 100) } : undefined}
                >
                    {onEditHeading ? (
                        <InlineText as="h1" value={d.heading ?? ''} placeholder="Add a headline" onChange={onEditHeading} className={`block font-semibold tracking-tight text-white ${HERO_TITLE_SIZES[d.title_size as string] ?? HERO_TITLE_SIZES.md}`} />
                    ) : (
                        <h1 className={`font-semibold tracking-tight text-white ${HERO_TITLE_SIZES[d.title_size as string] ?? HERO_TITLE_SIZES.md}`}>{d.heading}</h1>
                    )}
                    {onEditSubheading ? (
                        <InlineText as="p" value={d.subheading ?? ''} placeholder="Add a supporting line" onChange={onEditSubheading} className="mt-5 block max-w-2xl text-lg text-white/80" />
                    ) : (
                        d.subheading && <p className="mt-5 max-w-2xl text-lg text-white/80">{d.subheading}</p>
                    )}
                    {d.cta_label && (
                        <a href={d.cta_link || '#contact'} className="mt-8 inline-flex rounded-full px-7 py-3 text-sm font-medium text-white shadow-lg transition hover:opacity-90" style={{ backgroundColor: primary }}>
                            {d.cta_label}
                        </a>
                    )}
                    {children}
                </div>
            </div>
        </section>
    );
}

/**
 * Slider / carousel: a rotating banner of slides. Each slide reuses HeroSection
 * (so it offers the same image + text layout options), while autoplay, arrows,
 * dots and the transition are configured once at the block level. Block-level
 * design keys (overlay, content position, title size, height, …) are merged into
 * every slide; per-slide keys carry the image, focal point and copy.
 */
function SliderBlock({ block, d, theme, editing }: { block: SiteBlock; d: Record<string, any>; theme: SiteTheme; editing?: BlockEditing }) {
    const slides: any[] = Array.isArray(d.slides) ? d.slides.filter(Boolean) : [];
    const count = slides.length;
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    // Don't autoplay inside the builder so text stays put while it's edited.
    const autoplay = d.autoplay !== false && !editing;
    const speed = Number(d.speed) > 0 ? Number(d.speed) : 5;
    const fade = d.transition === 'fade';
    const showArrows = d.show_arrows !== false;
    const showDots = d.show_dots !== false;

    const cur = count ? Math.min(index, count - 1) : 0;
    const go = (i: number) => count && setIndex(((i % count) + count) % count);

    useEffect(() => {
        if (!autoplay || paused || count <= 1) return;
        const id = window.setInterval(() => setIndex((i) => (i + 1) % count), speed * 1000);
        return () => window.clearInterval(id);
    }, [autoplay, paused, speed, count]);

    if (count === 0) {
        if (!editing) return null;
        return (
            <section className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
                    <h3 className="text-lg font-semibold text-neutral-900">Slider</h3>
                    <p className="mt-1 max-w-sm text-sm text-neutral-500">Add slides in the block settings — each slide can have its own image, heading and button.</p>
                </div>
            </section>
        );
    }

    // Merge block-level design with a slide's own content into one hero `d`.
    const slideD = (s: any) => ({
        overlay: d.overlay, content_x: d.content_x, content_y: d.content_y, text_align: d.text_align,
        text_shadow: d.text_shadow, title_size: d.title_size, height: d.height, height_value: d.height_value,
        text_bg: d.text_bg, text_bg_color: d.text_bg_color, text_bg_opacity: d.text_bg_opacity, text_bg_extent: d.text_bg_extent,
        image_url: s.image_url, heading: s.heading, subheading: s.subheading, cta_label: s.cta_label, cta_link: s.cta_link,
        focal_x: s.focal_x ?? 50, focal_y: s.focal_y ?? 50, alt: s.alt, title: s.title,
    });

    const editData = editing?.onEditData;
    const editSlide = (i: number, partial: Record<string, unknown>) =>
        editData?.(block.id, { ...d, slides: slides.map((s, idx) => (idx === i ? { ...s, ...partial } : s)) });

    const slideEl = (s: any, i: number) => (
        <HeroSection
            d={slideD(s)}
            theme={theme}
            onEditHeading={editData ? (v) => editSlide(i, { heading: v }) : undefined}
            onEditSubheading={editData ? (v) => editSlide(i, { subheading: v }) : undefined}
        />
    );

    // Builder-only: arrows/dots must not bubble up and select/open the block.
    const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

    // The "Container width" style setting constrains the whole carousel (default
    // is full-bleed, like a hero banner); narrower values centre it on the page.
    return (
        <section
            className={`relative mx-auto overflow-hidden ${containerW(block.settings?.width, 'max-w-none')}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {fade ? (
                <div className="relative">
                    {slides.map((s, i) => (
                        <div key={i} className={`transition-opacity duration-700 ${i === cur ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}`}>
                            {slideEl(s, i)}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${cur * 100}%)` }}>
                    {slides.map((s, i) => (
                        <div key={i} className="w-full shrink-0">{slideEl(s, i)}</div>
                    ))}
                </div>
            )}

            {showArrows && count > 1 && (
                <>
                    <button type="button" onClick={(e) => { stop(e); go(cur - 1); }} aria-label="Previous slide" className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 sm:left-5">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <button type="button" onClick={(e) => { stop(e); go(cur + 1); }} aria-label="Next slide" className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 sm:right-5">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </>
            )}

            {showDots && count > 1 && (
                <div className="absolute inset-x-0 bottom-5 z-10 flex justify-center gap-2">
                    {slides.map((_, i) => (
                        <button key={i} type="button" onClick={(e) => { stop(e); go(i); }} aria-label={`Go to slide ${i + 1}`} className="h-2 rounded-full bg-white transition-all" style={{ width: i === cur ? 24 : 8, opacity: i === cur ? 1 : 0.5 }} />
                    ))}
                </div>
            )}
        </section>
    );
}

/**
 * Single-line click-to-edit text (builder only). Edits commit on blur so React
 * never re-renders mid-keystroke (which would jump the caret). Shows a dashed
 * outline on hover and a placeholder when empty.
 */
function InlineText({ as: Tag = 'div', value, onChange, className, placeholder, style }: { as?: React.ElementType; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; style?: React.CSSProperties }) {
    return (
        <Tag
            contentEditable
            suppressContentEditableWarning
            data-ph={placeholder}
            title="Click to edit"
            style={style}
            className={`inline-editable cursor-text rounded outline-dashed outline-1 outline-transparent transition focus:outline-blue-400 hover:outline-blue-300 ${className ?? ''}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            onBlur={(e: React.FocusEvent<HTMLElement>) => { const t = e.currentTarget.innerText.replace(/\n$/, ''); if (t !== value) onChange(t); }}
        >
            {value}
        </Tag>
    );
}

/**
 * Click-to-edit rich text (builder only): renders the HTML, and on click swaps
 * in the WYSIWYG editor in place. The heavy editor only loads on first edit.
 */
function InlineRichText({ html, onChange, className }: { html: string; onChange: (html: string) => void; className?: string }) {
    const [editing, setEditing] = useState(false);

    if (editing) {
        return (
            <div className={className} onClick={(e) => e.stopPropagation()}>
                <LazyRichTextEditor value={html} onChange={onChange} minHeightClass="min-h-[4rem]" />
                <div className="mt-1 text-right">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="rounded bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">Done</button>
                </div>
            </div>
        );
    }

    return (
        <div
            title="Click to edit"
            className={`inline-editable cursor-text rounded outline-dashed outline-1 outline-transparent transition hover:outline-blue-300 ${className ?? ''}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditing(true); }}
            dangerouslySetInnerHTML={{ __html: html?.trim() ? html : '<p class="text-neutral-400">Click to add text…</p>' }}
        />
    );
}

function BlockInner({ block, theme, slug, basePath, interactive, posts, categories, packages, editing }: BlockViewProps) {
    const base = basePath ?? `/site/${slug}`;
    // Block data is intentionally loose (modular/extensible), read with fallbacks.
    const d = block.data as Record<string, any>;
    const primary = theme.primary_color;
    // Container width from the block's style settings (falls back per block).
    const cw = (fallback: string) => containerW(block.settings?.width, fallback);

    // Builder-only: commit an in-place text edit (merges into the block's data).
    const edit = editing?.onEditData;
    const commit = (partial: Record<string, unknown>) => edit?.(block.id, { ...d, ...partial });

    switch (block.type) {
        case 'hero':
            return (
                <HeroSection
                    d={d}
                    theme={theme}
                    width={block.settings?.width}
                    sectionId="top"
                    onEditHeading={editing?.onEditData ? (v) => editing.onEditData!(block.id, { ...d, heading: v }) : undefined}
                    onEditSubheading={editing?.onEditData ? (v) => editing.onEditData!(block.id, { ...d, subheading: v }) : undefined}
                />
            );

        case 'slider':
            return <SliderBlock block={block} d={d} theme={theme} editing={editing} />;

        case 'about': {
            const reverse = d.image_side === 'right';
            // Image aspect ratio; "none" keeps the image's natural ratio (no crop).
            const ratio = d.image_ratio ?? '4/5';
            const ratioClass = ratio === '1/1' ? 'aspect-square'
                : ratio === '3/2' ? 'aspect-[3/2]'
                : ratio === '16/9' ? 'aspect-video'
                : ratio === 'none' ? ''
                : 'aspect-[4/5]';
            return (
                <section className={`mx-auto ${cw('max-w-6xl')} px-6 py-20 sm:px-10`}>
                    <div className={`flex flex-col gap-10 md:items-center ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                        <div className="md:w-1/2">
                            {d.image_url ? (
                                <RetryImg src={d.image_url} alt={d.alt || ''} title={d.title || undefined} loading="lazy" sizes="(min-width:768px) 50vw, 100vw" className={`w-full rounded-2xl ${ratioClass ? `${ratioClass} object-cover` : 'h-auto'}`} />
                            ) : (
                                <div className={`flex w-full items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400 ${ratioClass || 'aspect-[4/5]'}`}>Image</div>
                            )}
                        </div>
                        <div className="md:w-1/2">
                            {edit ? (
                                <>
                                    <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={(v) => commit({ heading: v })} className="block text-3xl font-semibold tracking-tight text-neutral-900" />
                                    <InlineText as="p" value={d.body ?? ''} placeholder="Add some text…" onChange={(v) => commit({ body: v })} className="mt-4 block whitespace-pre-line leading-relaxed text-neutral-600" />
                                </>
                            ) : (
                                <>
                                    {d.heading && <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                                    <p className="mt-4 whitespace-pre-line leading-relaxed text-neutral-600">{d.body}</p>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            );
        }

        case 'services': {
            const items: any[] = Array.isArray(d.items) ? d.items : [];
            return (
                <section className="bg-neutral-50 px-6 py-20 sm:px-10">
                    <div className={`mx-auto ${cw('max-w-6xl')}`}>
                        {edit
                            ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading" onChange={(v) => commit({ heading: v })} className="mb-12 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                            : d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((it, i) => {
                                const setItem = (partial: Record<string, unknown>) => commit({ items: items.map((x, idx) => (idx === i ? { ...x, ...partial } : x)) });
                                return (
                                    <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-7 shadow-sm">
                                        {edit ? (
                                            <>
                                                <InlineText as="h3" value={it.title ?? ''} placeholder="Title" onChange={(v) => setItem({ title: v })} className="block text-lg font-semibold text-neutral-900" />
                                                <InlineText as="p" value={it.description ?? ''} placeholder="Description" onChange={(v) => setItem({ description: v })} className="mt-2 block text-sm leading-relaxed text-neutral-600" />
                                                <InlineText as="p" value={it.price ?? ''} placeholder="Price (optional)" onChange={(v) => setItem({ price: v })} className="mt-4 block text-sm font-medium" />
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="text-lg font-semibold text-neutral-900">{it.title}</h3>
                                                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{it.description}</p>
                                                {it.price && <p className="mt-4 text-sm font-medium" style={{ color: primary }}>{it.price}</p>}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            );
        }

        case 'card': {
            const ratio = d.image_ratio ?? 'none';
            const ratioClass = ratio === '1/1' ? 'aspect-square'
                : ratio === '3/2' ? 'aspect-[3/2]'
                : ratio === '4/5' ? 'aspect-[4/5]'
                : ratio === '16/9' ? 'aspect-video'
                : '';
            return (
                <section className={`mx-auto ${cw('max-w-md')} px-6 py-12 sm:px-10`}>
                    <div className="overflow-hidden rounded-lg bg-white shadow">
                        {d.image_url ? (
                            <RetryImg src={d.image_url} alt={d.alt || ''} title={d.title || undefined} loading="lazy" sizes="(min-width:768px) 50vw, 100vw" className={`w-full ${ratioClass ? `${ratioClass} object-cover` : 'h-auto'}`} />
                        ) : (
                            <div className={`flex w-full items-center justify-center bg-neutral-100 text-sm text-neutral-400 ${ratioClass || 'aspect-[3/2]'}`}>Image</div>
                        )}
                        <div className="p-6">
                            {edit ? (
                                <>
                                    <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={(v) => commit({ heading: v })} className="mb-2 block text-xl font-semibold text-neutral-900" />
                                    <InlineText as="p" value={d.body ?? ''} placeholder="Add some text…" onChange={(v) => commit({ body: v })} className="block whitespace-pre-line leading-relaxed text-neutral-600" />
                                </>
                            ) : (
                                <>
                                    {d.heading && <h2 className="mb-2 text-xl font-semibold text-neutral-900">{d.heading}</h2>}
                                    {d.body && <p className="whitespace-pre-line leading-relaxed text-neutral-600">{d.body}</p>}
                                </>
                            )}
                        </div>
                    </div>
                </section>
            );
        }

        case 'gallery':
            return <GalleryBlock d={d} interactive={interactive} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} />;

        case 'reviews':
            return <ReviewsBlock block={block} d={d} primary={primary} editing={editing} />;

        case 'blog':
            return <BlogBlock d={d} posts={posts} categories={categories} slug={slug} interactive={interactive} primary={primary} width={block.settings?.width} />;

        case 'packages': {
            const list = packages ?? [];
            const cols = Number(d.columns) === 2 ? 'sm:grid-cols-2' : Number(d.columns) === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

            return (
                <section className={`mx-auto ${cw('max-w-6xl')} px-6 py-20 sm:px-10`}>
                    {edit ? (
                        <>
                            <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading" onChange={(v) => commit({ heading: v })} className="block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                            <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={(v) => commit({ subheading: v })} className="mx-auto mt-3 block max-w-2xl text-center text-neutral-500" />
                        </>
                    ) : (
                        <>
                            {d.heading && <h2 className="text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                            {d.subheading && <p className="mx-auto mt-3 max-w-2xl text-center text-neutral-500">{d.subheading}</p>}
                        </>
                    )}
                    {list.length === 0 ? (
                        <p className="mt-12 text-center text-sm text-neutral-400">No packages available yet.</p>
                    ) : (
                        <div className={`mt-12 grid grid-cols-1 gap-8 ${cols}`}>
                            {list.map((p) => (
                                <div key={p.slug} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200">
                                    {p.image_url ? (
                                        <RetryImg src={p.image_url} alt="" loading="lazy" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="aspect-[3/2] w-full object-cover" />
                                    ) : (
                                        <div className="flex aspect-[3/2] w-full items-center justify-center bg-neutral-100 text-xs text-neutral-300">{p.name}</div>
                                    )}
                                    <div className="flex flex-1 flex-col p-5">
                                        <h3 className="text-lg font-semibold text-neutral-900">{p.name}</h3>
                                        {p.description && <p className="mt-1 line-clamp-3 text-sm text-neutral-500">{p.description}</p>}
                                        <div className="mt-4 flex items-end justify-between pt-2">
                                            <div>
                                                <p className="text-lg font-semibold text-neutral-900">{formatMoney(p.price_cents, p.currency)}</p>
                                                {p.deposit_cents ? <p className="text-xs text-neutral-500">or {formatMoney(p.deposit_cents, p.currency)} deposit</p> : null}
                                            </div>
                                            {interactive && p.url ? (
                                                <a href={p.url} className="rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: primary }}>Pay</a>
                                            ) : (
                                                <span className="rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: primary }}>Pay</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            );
        }

        case 'text': {
            const align = d.align === 'center' ? 'text-center' : d.align === 'right' ? 'text-right' : 'text-left';
            const heading = (d.heading ?? '').trim();
            const level = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(d.heading_level) ? d.heading_level : 'h2';
            const Heading = level as React.ElementType;
            const headingSize: Record<string, string> = { h1: 'text-4xl sm:text-5xl', h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl', h5: 'text-lg', h6: 'text-base uppercase tracking-wide' };
            const headingCls = `font-semibold tracking-tight text-neutral-900 ${headingSize[level]}`;
            const bodyHtmlCls = `leading-relaxed text-neutral-600 [&_a]:underline [&_h1]:my-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-xl [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5`;

            // Builder: click-to-edit the heading + body in place.
            if (editing?.onEditData) {
                const commit = (partial: Record<string, unknown>) => editing.onEditData!(block.id, { ...d, ...partial });
                return (
                    <section className={`mx-auto ${cw('max-w-3xl')} px-6 py-16 sm:px-10 ${align}`}>
                        <InlineText as={Heading} value={heading} placeholder="Heading (optional)" onChange={(v) => commit({ heading: v })} className={`block ${headingCls}`} />
                        <InlineRichText html={/<\/?[a-z][\s\S]*>/i.test(d.body ?? '') ? d.body : (d.body ? `<p>${d.body}</p>` : '')} onChange={(html) => commit({ body: html })} className={`${bodyHtmlCls} mt-4`} />
                    </section>
                );
            }

            return (
                <section className={`mx-auto ${cw('max-w-3xl')} px-6 py-16 sm:px-10 ${align}`}>
                    {heading && <Heading className={headingCls}>{heading}</Heading>}
                    {d.body && (/<\/?[a-z][\s\S]*>/i.test(d.body)
                        ? <div className={`${bodyHtmlCls} ${heading ? 'mt-4' : ''}`} dangerouslySetInnerHTML={{ __html: d.body }} />
                        : <p className={`whitespace-pre-line leading-relaxed text-neutral-600 ${heading ? 'mt-4' : ''}`}>{d.body}</p>
                    )}
                </section>
            );
        }

        case 'image': {
            return (
                <section className={`mx-auto ${cw('max-w-5xl')} px-6 py-12 sm:px-10`}>
                    {d.image_url ? (
                        <RetryImg src={d.image_url} alt={d.alt || d.caption || ''} title={d.title || undefined} loading="lazy" sizes="(min-width:1024px) 1024px, 100vw" className="w-full rounded-2xl object-cover" />
                    ) : (
                        <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">Image</div>
                    )}
                    {edit
                        ? <InlineText as="p" value={d.caption ?? ''} placeholder="Caption (optional)" onChange={(v) => commit({ caption: v })} className="mt-3 block text-center text-sm text-neutral-400" />
                        : d.caption && <p className="mt-3 text-center text-sm text-neutral-400">{d.caption}</p>}
                </section>
            );
        }

        case 'video': {
            const src = videoEmbedUrl(d.url);
            return (
                <section className={`mx-auto ${cw('max-w-4xl')} px-6 py-12 sm:px-10`}>
                    {src ? (
                        <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ paddingTop: '56.25%' }}>
                            <iframe src={src} title={d.caption || 'Video'} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                    ) : (
                        <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">Paste a YouTube or Vimeo link</div>
                    )}
                    {edit
                        ? <InlineText as="p" value={d.caption ?? ''} placeholder="Caption (optional)" onChange={(v) => commit({ caption: v })} className="mt-3 block text-center text-sm text-neutral-400" />
                        : d.caption && <p className="mt-3 text-center text-sm text-neutral-400">{d.caption}</p>}
                </section>
            );
        }

        case 'button': {
            const align = d.align === 'left' ? 'justify-start' : d.align === 'right' ? 'justify-end' : 'justify-center';
            const outline = d.style === 'outline';
            const cls = outline
                ? 'rounded-full border-2 px-7 py-3 text-sm font-medium transition hover:opacity-80'
                : 'rounded-full px-7 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90';
            const style = outline ? { borderColor: primary, color: primary } : { backgroundColor: primary };
            const inner = <span className={cls} style={style}>{d.label || 'Button'}</span>;
            return (
                <section className={`mx-auto flex ${cw('max-w-6xl')} px-6 py-6 sm:px-10 ${align}`}>
                    {edit
                        ? <InlineText as="span" value={d.label ?? ''} placeholder="Button" onChange={(v) => commit({ label: v })} className={cls} style={style} />
                        : interactive && d.link ? <a href={d.link}>{inner}</a> : inner}
                </section>
            );
        }

        case 'cta':
            return (
                <section className="px-6 py-6 sm:px-10">
                    <div className={`mx-auto ${cw('max-w-5xl')} rounded-3xl px-8 py-14 text-center`} style={{ backgroundColor: primary }}>
                        {edit ? (
                            <>
                                <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={(v) => commit({ heading: v })} className="block text-3xl font-semibold tracking-tight text-white" />
                                <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={(v) => commit({ subheading: v })} className="mx-auto mt-3 block max-w-xl text-white/80" />
                                <InlineText as="span" value={d.button_label ?? ''} placeholder="Button label" onChange={(v) => commit({ button_label: v })} className="mt-7 inline-block rounded-full bg-white px-7 py-3 text-sm font-semibold" style={{ color: primary }} />
                            </>
                        ) : (<>
                        {d.heading && <h2 className="text-3xl font-semibold tracking-tight text-white">{d.heading}</h2>}
                        {d.subheading && <p className="mx-auto mt-3 max-w-xl text-white/80">{d.subheading}</p>}
                        {d.button_label && (
                            <span className="mt-7 inline-block">
                                {interactive && d.button_link ? (
                                    <a href={d.button_link} className="rounded-full bg-white px-7 py-3 text-sm font-semibold shadow-sm transition hover:opacity-90" style={{ color: primary }}>{d.button_label}</a>
                                ) : (
                                    <span className="rounded-full bg-white px-7 py-3 text-sm font-semibold" style={{ color: primary }}>{d.button_label}</span>
                                )}
                            </span>
                        )}
                        </>)}
                    </div>
                </section>
            );

        case 'faq': {
            const items: any[] = Array.isArray(d.items) ? d.items : [];
            return (
                <section className={`mx-auto ${cw('max-w-3xl')} px-6 py-20 sm:px-10`}>
                    {edit
                        ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading" onChange={(v) => commit({ heading: v })} className="mb-10 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                        : d.heading && <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                    <div className="divide-y divide-neutral-200 border-y border-neutral-200">
                        {items.map((it, i) => {
                            const setItem = (partial: Record<string, unknown>) => commit({ items: items.map((x, idx) => (idx === i ? { ...x, ...partial } : x)) });
                            if (edit) {
                                return (
                                    <div key={i} className="py-4">
                                        <InlineText as="p" value={it.q ?? ''} placeholder="Question" onChange={(v) => setItem({ q: v })} className="block text-base font-medium text-neutral-900" />
                                        <InlineText as="p" value={it.a ?? ''} placeholder="Answer" onChange={(v) => setItem({ a: v })} className="mt-3 block whitespace-pre-line leading-relaxed text-neutral-600" />
                                    </div>
                                );
                            }
                            return (
                                <details key={i} className="group py-4">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-neutral-900">
                                        {it.q}
                                        <svg className="h-5 w-5 shrink-0 text-neutral-400 transition group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    </summary>
                                    <p className="mt-3 whitespace-pre-line leading-relaxed text-neutral-600">{it.a}</p>
                                </details>
                            );
                        })}
                    </div>
                </section>
            );
        }

        case 'testimonials': {
            const items: any[] = Array.isArray(d.items) ? d.items : [];
            return (
                <section className="bg-neutral-50 px-6 py-20 sm:px-10">
                    <div className={`mx-auto ${cw('max-w-6xl')}`}>
                        {edit
                            ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading" onChange={(v) => commit({ heading: v })} className="mb-12 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                            : d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((it, i) => {
                                const setItem = (partial: Record<string, unknown>) => commit({ items: items.map((x, idx) => (idx === i ? { ...x, ...partial } : x)) });
                                return (
                                    <figure key={i} className="rounded-2xl border border-neutral-100 bg-white p-7 shadow-sm">
                                        <Stars value={5} className="h-4 w-4" />
                                        {edit ? (
                                            <>
                                                <InlineText as="blockquote" value={it.quote ?? ''} placeholder="Quote" onChange={(v) => setItem({ quote: v })} className="mt-3 block leading-relaxed text-neutral-700" />
                                                <InlineText as="p" value={it.author ?? ''} placeholder="Author" onChange={(v) => setItem({ author: v })} className="mt-4 block text-sm font-semibold text-neutral-900" />
                                                <InlineText as="p" value={it.role ?? ''} placeholder="Role (optional)" onChange={(v) => setItem({ role: v })} className="block text-sm text-neutral-400" />
                                            </>
                                        ) : (
                                            <>
                                                <blockquote className="mt-3 leading-relaxed text-neutral-700">“{it.quote}”</blockquote>
                                                <figcaption className="mt-4 text-sm font-semibold text-neutral-900">
                                                    {it.author}{it.role ? <span className="font-normal text-neutral-400"> · {it.role}</span> : null}
                                                </figcaption>
                                            </>
                                        )}
                                    </figure>
                                );
                            })}
                        </div>
                    </div>
                </section>
            );
        }

        case 'pricing': {
            const plans: any[] = Array.isArray(d.plans) ? d.plans : [];
            const cols = plans.length === 2 ? 'sm:grid-cols-2' : plans.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
            return (
                <section className={`mx-auto ${cw('max-w-6xl')} px-6 py-20 sm:px-10`}>
                    {edit
                        ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading" onChange={(v) => commit({ heading: v })} className="mb-12 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                        : d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                    <div className={`grid grid-cols-1 gap-6 ${cols}`}>
                        {plans.map((p, i) => {
                            const features = String(p.features || '').split('\n').map((f: string) => f.trim()).filter(Boolean);
                            const setPlan = (partial: Record<string, unknown>) => commit({ plans: plans.map((x, idx) => (idx === i ? { ...x, ...partial } : x)) });
                            if (edit) {
                                return (
                                    <div key={i} className={`flex flex-col rounded-2xl border p-7 ${p.featured ? 'shadow-lg' : 'border-neutral-200'}`} style={p.featured ? { borderColor: primary } : undefined}>
                                        <InlineText as="h3" value={p.name ?? ''} placeholder="Plan name" onChange={(v) => setPlan({ name: v })} className="block text-lg font-semibold text-neutral-900" />
                                        <p className="mt-3">
                                            <InlineText as="span" value={p.price ?? ''} placeholder="Price" onChange={(v) => setPlan({ price: v })} className="text-3xl font-bold text-neutral-900" />
                                            {' '}
                                            <InlineText as="span" value={p.period ?? ''} placeholder="period" onChange={(v) => setPlan({ period: v })} className="text-sm text-neutral-400" />
                                        </p>
                                        <InlineText as="p" value={p.features ?? ''} placeholder="One feature per line" onChange={(v) => setPlan({ features: v })} className="mt-6 block whitespace-pre-line text-sm leading-relaxed text-neutral-600" />
                                        <InlineText as="span" value={p.button_label ?? ''} placeholder="Button label (optional)" onChange={(v) => setPlan({ button_label: v })} className="mt-7 block rounded-full px-5 py-2.5 text-center text-sm font-medium text-white" style={{ backgroundColor: primary }} />
                                    </div>
                                );
                            }
                            return (
                                <div key={i} className={`flex flex-col rounded-2xl border p-7 ${p.featured ? 'shadow-lg' : 'border-neutral-200'}`} style={p.featured ? { borderColor: primary } : undefined}>
                                    <h3 className="text-lg font-semibold text-neutral-900">{p.name}</h3>
                                    <p className="mt-3"><span className="text-3xl font-bold text-neutral-900">{p.price}</span>{p.period ? <span className="text-sm text-neutral-400"> /{p.period}</span> : null}</p>
                                    <ul className="mt-6 flex-1 space-y-2 text-sm text-neutral-600">
                                        {features.map((f: string, fi: number) => (
                                            <li key={fi} className="flex gap-2"><svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{f}</li>
                                        ))}
                                    </ul>
                                    {p.button_label && (
                                        <span className="mt-7">
                                            {interactive && p.button_link ? (
                                                <a href={p.button_link} className="block rounded-full px-5 py-2.5 text-center text-sm font-medium text-white" style={{ backgroundColor: primary }}>{p.button_label}</a>
                                            ) : (
                                                <span className="block rounded-full px-5 py-2.5 text-center text-sm font-medium text-white" style={{ backgroundColor: primary }}>{p.button_label}</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            );
        }

        case 'logos': {
            const images: GalleryImage[] = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
            return (
                <section className={`mx-auto ${cw('max-w-6xl')} px-6 py-16 sm:px-10`}>
                    {edit
                        ? <InlineText as="p" value={d.heading ?? ''} placeholder="Heading (optional)" onChange={(v) => commit({ heading: v })} className="mb-8 block text-center text-xs font-medium uppercase tracking-widest text-neutral-400" />
                        : d.heading && <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-neutral-400">{d.heading}</p>}
                    {images.length === 0 ? (
                        <p className="text-center text-sm text-neutral-400">Add some logos.</p>
                    ) : (
                        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
                            {images.map((img, i) => (
                                <img key={i} src={galleryThumb(img)} alt={galleryAlt(img)} title={galleryTitle(img) || undefined} loading="lazy" className="h-10 w-auto object-contain opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0" />
                            ))}
                        </div>
                    )}
                </section>
            );
        }

        case 'map': {
            const q = String(d.query || '').trim();
            const height = Math.min(Math.max(Number(d.height) || 360, 160), 720);
            return (
                <section className={`mx-auto ${cw('max-w-6xl')} px-6 py-12 sm:px-10`}>
                    {q ? (
                        <iframe title="Map" className="w-full rounded-2xl border border-neutral-200" style={{ height }} loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`} />
                    ) : (
                        <div className="flex items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400" style={{ height }}>Enter an address or place</div>
                    )}
                </section>
            );
        }

        case 'embed':
            return (
                <section className={`mx-auto ${cw('max-w-4xl')} px-6 py-12 sm:px-10`}>
                    {d.html ? (
                        <div className="site-embed" dangerouslySetInnerHTML={{ __html: d.html }} />
                    ) : (
                        <div className="flex h-40 items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">Paste an embed code</div>
                    )}
                </section>
            );

        case 'divider': {
            const sizes: Record<string, string> = { sm: 'py-4', md: 'py-8', lg: 'py-16' };
            const pad = sizes[d.size as string] ?? sizes.md;
            return (
                <section className={`mx-auto ${cw('max-w-4xl')} px-6 sm:px-10 ${pad}`}>
                    {d.style !== 'space' && <hr className="border-neutral-200" />}
                </section>
            );
        }

        case 'grid': {
            const cols = Math.min(Math.max(Number(d.columns) || 2, 1), 4);
            const gap = d.gap === 'sm' ? 'gap-3' : d.gap === 'lg' ? 'gap-10' : 'gap-6';
            const colsClass = cols === 1 ? '' : cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
            const children = block.children ?? [];

            return (
                <section className={`mx-auto ${cw('max-w-6xl')} px-6 py-10 sm:px-10`}>
                    {edit ? (
                        <div className="mb-8 text-center">
                            <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading (optional)" onChange={(v) => commit({ heading: v })} className="block text-3xl font-semibold tracking-tight text-neutral-900" />
                            <InlineText as="p" value={d.body ?? ''} placeholder="Intro text (optional)" onChange={(v) => commit({ body: v })} className="mx-auto mt-3 block max-w-2xl text-neutral-600" />
                        </div>
                    ) : (d.heading || d.body) && (
                        <div className="mb-8 text-center">
                            {d.heading && <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                            {d.body && <p className="mx-auto mt-3 max-w-2xl text-neutral-600">{d.body}</p>}
                        </div>
                    )}
                    <div className={`grid grid-cols-1 ${colsClass} ${gap}`}>
                        {Array.from({ length: cols }).map((_, col) => (
                            <div key={col} className="min-w-0">
                                {(children[col] ?? []).map((child) => (
                                    <BlockView key={child.id} block={child} theme={theme} slug={slug} basePath={base} interactive={interactive} posts={posts} categories={categories} packages={packages} editing={editing} />
                                ))}
                                {editing && <GridCellAdder onAdd={(type) => editing.onAddChild(block.id, col, type)} />}
                            </div>
                        ))}
                    </div>
                </section>
            );
        }

        case 'contact':
            return <ContactBlock data={d} theme={theme} slug={slug} basePath={base} interactive={interactive} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} onEditSubheading={edit ? (v) => commit({ subheading: v }) : undefined} />;

        case 'footer':
            return (
                <footer className="bg-neutral-950 px-6 py-14 text-center text-neutral-300 sm:px-10">
                    <p className="text-lg font-semibold text-white">{d.business_name || 'Studio'}</p>
                    {d.tagline && <p className="mt-1 text-sm text-neutral-400">{d.tagline}</p>}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-neutral-400">
                        {d.email && <a href={`mailto:${d.email}`} className="hover:text-white">{d.email}</a>}
                        {d.phone && <span>{d.phone}</span>}
                        {d.instagram && <a href={d.instagram} target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a>}
                        {d.facebook && <a href={d.facebook} target="_blank" rel="noreferrer" className="hover:text-white">Facebook</a>}
                    </div>
                    <p className="mt-6 text-xs text-neutral-600">© {new Date().getFullYear()} {d.business_name || 'Studio'}</p>
                </footer>
            );

        default:
            return null;
    }
}

// ─── Settings frame + edit chrome wrapper ─────────────────────────────────────

/** Wraps a block: applies its style settings, and in the builder adds the
 *  click-to-select outline + a bottom bar (name / edit / delete). */
export function BlockView(props: BlockViewProps) {
    const { block, editing } = props;
    const s = block.settings ?? {};

    const frameClasses = [
        // Stable hooks for custom CSS: every block carries `site-block` plus a
        // type-specific class (e.g. `block-hero`, `block-gallery`).
        'site-block',
        `block-${block.type}`,
        s.background ? 'blk-bg' : '',
        s.text_color ? 'blk-text' : '',
        s.text_size && s.text_size !== 'base' ? `blk-size-${s.text_size}` : '',
        s.padding ? `blk-pad-${s.padding}` : '',
        s.pad_top ? `blk-pt-${s.pad_top}` : '',
        s.pad_bottom ? `blk-pb-${s.pad_bottom}` : '',
        s.pad_left ? `blk-pl-${s.pad_left}` : '',
        s.pad_right ? `blk-pr-${s.pad_right}` : '',
        s.class_name ?? '',
    ].filter(Boolean).join(' ');

    const frameStyle: React.CSSProperties = {};
    if (s.background) frameStyle.backgroundColor = s.background;
    if (s.text_color) frameStyle.color = s.text_color;

    const inner = <BlockInner {...props} />;
    // Always wrap so the block-type class is present in the DOM for every block.
    const content = <div className={frameClasses} style={frameStyle}>{inner}</div>;

    // On the live site a hidden block renders nothing; in the builder it stays
    // visible (dimmed) so it can be selected and toggled back on.
    if (!editing) return block.hidden ? null : content;

    const selected = editing.selectedId === block.id;
    return (
        <div
            className={`group/blk relative cursor-pointer ${selected ? 'z-10 ring-2 ring-inset ring-blue-500' : 'ring-1 ring-inset ring-transparent hover:ring-2 hover:ring-blue-300'}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onSelect(block.id); }}
        >
            <div className={block.hidden ? 'opacity-40 grayscale' : ''}>{content}</div>
            {block.hidden && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center py-1">
                    <span className="rounded-full bg-neutral-900/80 px-2 py-0.5 text-[11px] font-medium text-white shadow">Hidden — not shown on live site</span>
                </div>
            )}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 px-2 py-1 transition ${selected ? 'opacity-100' : 'opacity-0 group-hover/blk:opacity-100'}`}>
                <span className="pointer-events-auto rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow">{blockLabel(block.type)}</span>
                <span className="pointer-events-auto flex gap-1">
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onSelect(block.id); }} className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow hover:bg-blue-700">Edit</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onDelete(block.id); }} className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow hover:bg-red-700" title="Delete block">✕</button>
                </span>
            </div>
        </div>
    );
}

// ─── Grid cell "add block" palette (builder only) ─────────────────────────────

function GridCellAdder({ onAdd }: { onAdd: (type: SiteBlockType) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative m-3" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                className="flex w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 py-3 text-xs font-medium text-neutral-500 hover:border-blue-400 hover:text-blue-600"
            >
                + Add block here
            </button>
            {open && (
                <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                    {BLOCK_LIBRARY.filter((b) => b.type !== 'grid').map((b) => (
                        <button
                            key={b.type}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAdd(b.type); setOpen(false); }}
                            className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                        >
                            {b.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Google Reviews block ─────────────────────────────────────────────────────

export interface GoogleReview {
    author: string;
    avatar?: string | null;
    profile_url?: string | null;
    rating: number;
    text: string;
    relative_time?: string;
    time?: string | null;
}

export interface GoogleBusiness {
    place_id: string;
    name: string;
    rating: number | null;
    total: number;
    url: string | null;
}

/** A row of five stars, filled to `value` (supports halves). */
export function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
    return (
        <span className="inline-flex items-center gap-0.5 align-middle">
            {[0, 1, 2, 3, 4].map((i) => {
                const fill = Math.max(0, Math.min(1, value - i));
                return (
                    <span key={i} className={`relative inline-block ${className}`}>
                        {/* Grey base star */}
                        <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full text-neutral-200" fill="currentColor"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.36 4.18a1 1 0 00.95.69h4.4c.97 0 1.37 1.24.59 1.81l-3.56 2.59a1 1 0 00-.36 1.12l1.36 4.18c.3.92-.75 1.69-1.54 1.12l-3.56-2.59a1 1 0 00-1.18 0l-3.56 2.59c-.78.57-1.83-.2-1.53-1.12l1.36-4.18a1 1 0 00-.36-1.12L1.16 9.61c-.79-.57-.38-1.81.58-1.81h4.4a1 1 0 00.95-.69L8.45 2.93z" /></svg>
                        {/* Gold fill on top, clipped from the right to `fill` */}
                        <svg viewBox="0 0 20 20" className="absolute inset-0 z-10 h-full w-full text-amber-400" fill="currentColor" style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.36 4.18a1 1 0 00.95.69h4.4c.97 0 1.37 1.24.59 1.81l-3.56 2.59a1 1 0 00-.36 1.12l1.36 4.18c.3.92-.75 1.69-1.54 1.12l-3.56-2.59a1 1 0 00-1.18 0l-3.56 2.59c-.78.57-1.83-.2-1.53-1.12l1.36-4.18a1 1 0 00-.36-1.12L1.16 9.61c-.79-.57-.38-1.81.58-1.81h4.4a1 1 0 00.95-.69L8.45 2.93z" /></svg>
                    </span>
                );
            })}
        </span>
    );
}

/** The multicolour Google "G". */
export function GoogleG({ className = 'h-4 w-4' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

const REVIEW_CHAR_LIMIT = 220;

function ReviewCard({ r, primary, showAvatar, showDate }: { r: GoogleReview; primary: string; showAvatar: boolean; showDate: boolean }) {
    const initial = (r.author || '?').trim().charAt(0).toUpperCase();
    const [expanded, setExpanded] = useState(false);
    const text = r.text || '';
    const isLong = text.length > REVIEW_CHAR_LIMIT;
    const shown = expanded || !isLong ? text : text.slice(0, REVIEW_CHAR_LIMIT).trimEnd() + '…';
    return (
        <figure className="flex h-full flex-col rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
                {showAvatar && (
                    r.avatar ? (
                        <img src={r.avatar} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: primary }}>{initial}</span>
                    )
                )}
                <div className="min-w-0">
                    <figcaption className="truncate text-sm font-semibold text-neutral-900">{r.author}</figcaption>
                    {showDate && r.relative_time && <p className="text-xs text-neutral-400">{r.relative_time}</p>}
                </div>
                <GoogleG className="ml-auto h-5 w-5 shrink-0" />
            </div>
            <Stars value={r.rating} className="mt-3 h-4 w-4" />
            <blockquote className="mt-3 text-sm leading-relaxed text-neutral-600">
                {shown}
                {isLong && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded((v) => !v); }}
                        className="ml-1 font-medium hover:underline"
                        style={{ color: primary }}
                    >
                        {expanded ? 'Read less' : 'Read more'}
                    </button>
                )}
            </blockquote>
        </figure>
    );
}

/** A proper carousel: prev/next controls, dot pager, and optional autoplay at a
 *  configurable speed (seconds). Pauses on hover; loops. Cards-per-view adapts
 *  to the viewport (1 / 2 / 3). */
function ReviewsCarousel({
    reviews,
    primary,
    showAvatar,
    showDate,
    autoplay,
    speed,
    maxPerView = 3,
}: {
    reviews: GoogleReview[];
    primary: string;
    showAvatar: boolean;
    showDate: boolean;
    autoplay: boolean;
    speed: number;
    maxPerView?: number;
}) {
    const [perView, setPerView] = useState(Math.min(3, maxPerView));
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    // Adapt cards-per-view to the viewport width (capped by maxPerView, e.g. when
    // the carousel shares its row with an inline summary).
    useEffect(() => {
        const compute = () => {
            const w = window.innerWidth;
            setPerView(Math.min(w < 640 ? 1 : w < 1024 ? 2 : 3, maxPerView));
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [maxPerView]);

    const maxIndex = Math.max(0, reviews.length - perView);
    const current = Math.min(index, maxIndex);
    const next = () => setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    const prev = () => setIndex((i) => (i <= 0 ? maxIndex : i - 1));

    // Autoplay — restarts whenever speed / pause / size changes.
    useEffect(() => {
        if (!autoplay || paused || reviews.length <= perView) return;
        const id = window.setInterval(() => setIndex((i) => (i >= maxIndex ? 0 : i + 1)), Math.max(1, speed) * 1000);
        return () => window.clearInterval(id);
    }, [autoplay, paused, speed, perView, maxIndex, reviews.length]);

    const pages = maxIndex + 1;
    const canMove = reviews.length > perView;

    return (
        <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="overflow-hidden">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${current * (100 / perView)}%)` }}
                >
                    {reviews.map((r, i) => (
                        <div key={i} className="shrink-0 px-2.5" style={{ width: `${100 / perView}%` }}>
                            <ReviewCard r={r} primary={primary} showAvatar={showAvatar} showDate={showDate} />
                        </div>
                    ))}
                </div>
            </div>

            {canMove && (
                <>
                    <button
                        type="button"
                        onClick={prev}
                        aria-label="Previous reviews"
                        className="absolute -left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-50 sm:-left-5"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        aria-label="Next reviews"
                        className="absolute -right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-50 sm:-right-5"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>

                    <div className="mt-6 flex justify-center gap-2">
                        {Array.from({ length: pages }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setIndex(i)}
                                aria-label={`Go to slide ${i + 1}`}
                                className="h-2 rounded-full transition-all"
                                style={{ width: i === current ? 20 : 8, backgroundColor: i === current ? primary : '#d4d4d4' }}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function ReviewsSummary({ business, primary, inline = false }: { business: GoogleBusiness; primary: string; inline?: boolean }) {
    const rating = business.rating ?? 0;

    // Inline variant: left-aligned, sits in a column beside the carousel.
    if (inline) {
        return (
            <div className="flex flex-col items-start gap-3 text-left">
                <div className="flex items-center gap-2">
                    <GoogleG className="h-7 w-7" />
                    <span className="text-base font-semibold text-neutral-900">{business.name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-neutral-900">{rating.toFixed(1)}</span>
                    <Stars value={rating} className="h-5 w-5" />
                </div>
                {business.total > 0 && (
                    <p className="text-sm text-neutral-500">
                        Based on {business.total.toLocaleString()} Google review{business.total === 1 ? '' : 's'}
                    </p>
                )}
                {business.url && (
                    <a
                        href={business.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                        <GoogleG className="h-4 w-4" /> Review us on Google
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className="mb-10 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
                <GoogleG className="h-6 w-6" />
                <span className="text-lg font-semibold text-neutral-900">{business.name}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-neutral-900">{rating.toFixed(1)}</span>
                <Stars value={rating} className="h-5 w-5" />
            </div>
            {business.total > 0 && (
                <p className="text-sm text-neutral-500">
                    Based on {business.total.toLocaleString()} Google review{business.total === 1 ? '' : 's'}
                </p>
            )}
            {business.url && (
                <a href={business.url} target="_blank" rel="noreferrer" className="mt-1 text-sm font-medium hover:underline" style={{ color: primary }}>
                    Review us on Google →
                </a>
            )}
        </div>
    );
}

function ReviewsBlock({ block, d, primary, editing }: { block: SiteBlock; d: Record<string, any>; primary: string; editing?: BlockEditing }) {
    const business: GoogleBusiness | null = d.business ?? null;
    const all: GoogleReview[] = Array.isArray(d.reviews) ? d.reviews : [];
    const minRating = Number(d.min_rating) || 0;
    const max = Number(d.max) || 0;
    const layout = ['grid', 'list', 'carousel', 'badge'].includes(d.layout) ? d.layout : 'grid';
    const showAvatar = d.show_avatar !== false;
    const showDate = d.show_date !== false;
    // Inline summary is only meaningful for the carousel, when a summary + business exist.
    const summaryInline = layout === 'carousel' && !!d.summary_inline && d.show_summary !== false && !!business;
    // How many cards to show per slide on wide screens (1–3); narrower screens scale down.
    const perView = Math.min(3, Math.max(1, Number(d.per_view) || 3));

    let reviews = all.filter((r) => (r.text || '').trim() !== '' && r.rating >= minRating);
    // Newest first by publish date.
    reviews = reviews.sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime());
    if (max > 0) reviews = reviews.slice(0, max);

    // Unconfigured: in the builder show the "connect" call-to-action; on the live
    // site (or preview) render nothing so an empty section never ships.
    if (reviews.length === 0 && !(layout === 'badge' && business)) {
        if (editing?.onConfigure) {
            return (
                <section className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
                    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
                        <GoogleG className="h-9 w-9" />
                        <h3 className="mt-4 text-lg font-semibold text-neutral-900">Google Reviews</h3>
                        <p className="mt-1 max-w-sm text-sm text-neutral-500">Show off your star rating and latest reviews from Google.</p>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onConfigure!(block.id); }}
                            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                            style={{ backgroundColor: primary }}
                        >
                            Connect to Google Reviews
                        </button>
                    </div>
                </section>
            );
        }
        return null;
    }

    const cols = Number(d.columns) === 2 ? 'sm:grid-cols-2' : Number(d.columns) === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

    // Compact floating-style badge: just the overall rating.
    if (layout === 'badge') {
        const rating = business?.rating ?? 0;
        return (
            <section className="mx-auto max-w-md px-6 py-12 sm:px-10">
                <a
                    href={business?.url || undefined}
                    target={business?.url ? '_blank' : undefined}
                    rel="noreferrer"
                    className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                    <GoogleG className="h-9 w-9 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-neutral-900">{business?.name || 'Google Reviews'}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-lg font-bold text-neutral-900">{rating.toFixed(1)}</span>
                            <Stars value={rating} className="h-4 w-4" />
                        </div>
                        {business && business.total > 0 && <p className="text-xs text-neutral-500">{business.total.toLocaleString()} reviews</p>}
                    </div>
                </a>
            </section>
        );
    }

    return (
        <section className={`mx-auto ${containerW(block.settings?.width, 'max-w-6xl')} px-6 py-20 sm:px-10`}>
            {d.heading && <h2 className="text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
            {d.subheading && <p className="mx-auto mt-3 max-w-2xl text-center text-neutral-500">{d.subheading}</p>}
            <div className={d.heading || d.subheading ? 'mt-12' : ''}>
                {summaryInline ? (
                    // Summary sits beside the carousel (Pixieset / mccourtphotography style).
                    <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
                        <div className="lg:w-72 lg:shrink-0">
                            <ReviewsSummary business={business!} primary={primary} inline />
                        </div>
                        <div className="min-w-0 flex-1">
                            <ReviewsCarousel
                                reviews={reviews}
                                primary={primary}
                                showAvatar={showAvatar}
                                showDate={showDate}
                                autoplay={d.autoplay !== false}
                                speed={Number(d.speed) > 0 ? Number(d.speed) : 5}
                                maxPerView={Math.min(2, perView)}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        {d.show_summary !== false && business && <ReviewsSummary business={business} primary={primary} />}

                        {layout === 'list' ? (
                            <div className="mx-auto flex max-w-2xl flex-col gap-5">
                                {reviews.map((r, i) => <ReviewCard key={i} r={r} primary={primary} showAvatar={showAvatar} showDate={showDate} />)}
                            </div>
                        ) : layout === 'carousel' ? (
                            <ReviewsCarousel
                                reviews={reviews}
                                primary={primary}
                                showAvatar={showAvatar}
                                showDate={showDate}
                                autoplay={d.autoplay !== false}
                                speed={Number(d.speed) > 0 ? Number(d.speed) : 5}
                                maxPerView={perView}
                            />
                        ) : (
                            <div className={`grid grid-cols-1 gap-5 ${cols}`}>
                                {reviews.map((r, i) => <ReviewCard key={i} r={r} primary={primary} showAvatar={showAvatar} showDate={showDate} />)}
                            </div>
                        )}
                    </>
                )}

                {d.link_to_google !== false && business?.url && d.show_summary === false && (
                    <div className="mt-10 text-center">
                        <a href={business.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline" style={{ color: primary }}>
                            See all reviews on Google →
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── Blog block (post grid + optional category filter) ────────────────────────

function BlogBlock({ d, posts, categories, slug, interactive, primary, width }: { d: Record<string, any>; posts?: BlogPostCard[]; categories?: SiteCategory[]; slug: string; interactive: boolean; primary: string; width?: string }) {
    const all = posts ?? [];
    const cols = Number(d.columns) === 2 ? 'sm:grid-cols-2' : Number(d.columns) === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
    const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

    // Build the filter tree. Prefer the site's full category list (so empty parents
    // still appear); otherwise fall back to the categories the posts reference.
    const catList: SiteCategory[] = (categories && categories.length)
        ? categories
        : Array.from(new Map(all.flatMap((p) => p.categories ?? []).map((c) => [c.id, c])).values());
    const byId = new Map(catList.map((c) => [c.id, c]));
    // Only surface categories that actually have a (direct or descendant) post.
    const directIds = new Set(all.flatMap((p) => (p.categories ?? []).map((c) => c.id)));
    const ancestors = (id: number): number[] => {
        const out: number[] = [];
        let cur = byId.get(id)?.parent_id ?? null;
        while (cur != null) { out.push(cur); cur = byId.get(cur)?.parent_id ?? null; }
        return out;
    };
    // A category counts if a post sits in it or any of its descendants.
    const usableIds = new Set<number>();
    directIds.forEach((id) => { usableIds.add(id); ancestors(id).forEach((a) => usableIds.add(a)); });

    const tree = orderedCategoryTree(catList.filter((c) => usableIds.has(c.id)));
    const showFilter = d.show_categories !== false && tree.length > 1;
    const [active, setActive] = useState<number | null>(null);

    // Descendant ids of the active category (so a parent shows its children's posts).
    const descendantsOf = (id: number): Set<number> => {
        const set = new Set<number>([id]);
        let added = true;
        while (added) {
            added = false;
            for (const c of catList) {
                if (c.parent_id != null && set.has(c.parent_id) && !set.has(c.id)) { set.add(c.id); added = true; }
            }
        }
        return set;
    };
    const activeSet = active != null ? descendantsOf(active) : null;
    const filtered = activeSet ? all.filter((p) => (p.categories ?? []).some((c) => activeSet.has(c.id))) : all;
    const limit = Number(d.limit) || 0;
    const list = limit > 0 ? filtered.slice(0, limit) : filtered;

    // Optional pagination: "Posts per page" on the blog page (0 = show all).
    const perPage = Number(d.per_page) || 0;
    const [page, setPage] = useState(1);
    // Reset to the first page when the category filter changes.
    useEffect(() => setPage(1), [active]);
    const pageCount = perPage > 0 ? Math.max(1, Math.ceil(list.length / perPage)) : 1;
    const currentPage = Math.min(page, pageCount);
    const pageList = perPage > 0 ? list.slice((currentPage - 1) * perPage, currentPage * perPage) : list;

    return (
        <section className={`mx-auto ${containerW(width, 'max-w-6xl')} px-6 py-20 sm:px-10`}>
            {d.heading && <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}

            {showFilter && (
                <div className="mb-10 flex flex-wrap justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => interactive && setActive(null)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${active === null ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}
                        style={active === null ? { backgroundColor: primary } : undefined}
                    >
                        All
                    </button>
                    {tree.map(({ cat, depth }) => {
                        const isActive = active === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => interactive && setActive(cat.id)}
                                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${isActive ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}
                                style={isActive ? { backgroundColor: primary } : undefined}
                            >
                                {depth > 0 && <span className="mr-1 text-neutral-300">{'—'.repeat(depth)}</span>}
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            )}

            {list.length === 0 ? (
                <p className="text-center text-sm text-neutral-400">No posts published yet.</p>
            ) : (
                <div className={`grid grid-cols-1 gap-8 ${cols}`}>
                    {pageList.map((p) => {
                        const href = p.url ?? `/site/${slug}/blog/${p.slug}`;
                        const cats = p.categories ?? [];
                        const inner = (
                            <>
                                {p.cover_image ? (
                                    <img src={p.cover_image} srcSet={buildSrcSet(p.cover_image) ?? undefined} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" alt="" loading="lazy" decoding="async" className="aspect-[3/2] w-full rounded-xl object-cover" />
                                ) : (
                                    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-300">Cover</div>
                                )}
                                <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
                                    {cats.length > 0 && <span className="font-semibold" style={{ color: primary }}>{cats.map((c) => c.name).join(', ')}</span>}
                                    {cats.length > 0 && p.published_at && <span>·</span>}
                                    {p.published_at && <span>{fmt(p.published_at)}</span>}
                                </div>
                                <h3 className="mt-1 text-lg font-semibold text-neutral-900">{p.title}</h3>
                                {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{p.excerpt}</p>}
                            </>
                        );
                        return interactive ? (
                            <a key={p.slug} href={href} className="group block">{inner}</a>
                        ) : (
                            <div key={p.slug} className="block">{inner}</div>
                        );
                    })}
                </div>
            )}

            {perPage > 0 && pageCount > 1 && (
                <div className="mt-14 flex flex-wrap items-center justify-center gap-2">
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => interactive && setPage(currentPage - 1)}
                        className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-600 transition enabled:hover:border-neutral-300 disabled:opacity-30"
                    >
                        Prev
                    </button>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                        <button
                            key={n}
                            type="button"
                            onClick={() => interactive && setPage(n)}
                            className={`h-9 w-9 rounded-full border text-sm font-medium transition ${n === currentPage ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}
                            style={n === currentPage ? { backgroundColor: primary } : undefined}
                        >
                            {n}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={currentPage >= pageCount}
                        onClick={() => interactive && setPage(currentPage + 1)}
                        className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-600 transition enabled:hover:border-neutral-300 disabled:opacity-30"
                    >
                        Next
                    </button>
                </div>
            )}
        </section>
    );
}

/** Depth-first category ordering with depth, for indented filter rendering. */
function orderedCategoryTree(categories: SiteCategory[]): { cat: SiteCategory; depth: number }[] {
    const out: { cat: SiteCategory; depth: number }[] = [];
    const present = new Set(categories.map((c) => c.id));
    const walk = (parentId: number | null, depth: number) => {
        for (const cat of categories.filter((c) => (c.parent_id != null && present.has(c.parent_id) ? c.parent_id : null) === parentId)) {
            out.push({ cat, depth });
            walk(cat.id, depth + 1);
        }
    };
    walk(null, 0);
    return out;
}

// ─── Gallery block (layouts + optional lightbox) ──────────────────────────────

/**
 * <img> that retries on load error. Gallery images imported from a studio's
 * photos are converted by a queue worker (ImportSiteImage), so their URL 404s
 * for a few seconds until the worker writes the object — this retries until it
 * appears, instead of leaving a broken image until the next save/refresh.
 */
export function RetryImg({ src, className, style, sizes, ...rest }: React.ImgHTMLAttributes<HTMLImageElement> & { src?: string }) {
    const [attempt, setAttempt] = useState(0);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
        setAttempt(0);
        setErrored(false);
    }, [src]);

    // While the worker is still writing the image its URL 404s; on error, show a
    // loading placeholder (not a broken-image icon) and retry with backoff.
    useEffect(() => {
        if (!errored || attempt >= 12) return;
        const next = attempt + 1;
        const t = window.setTimeout(() => {
            setAttempt(next);
            setErrored(false);
        }, Math.min(700 * next, 3000));
        return () => clearTimeout(t);
    }, [errored, attempt]);

    if (!src) return <img {...rest} alt={rest.alt ?? ''} className={className} style={style} />;

    if (errored) {
        // Match the consumer's sizing; fall back to a sensible box when the class
        // list sets no height (e.g. masonry tiles) so the spinner is visible.
        const hasHeight = /(?:^|\s)(?:aspect-|h-)/.test(className ?? '');
        return (
            <div
                className={`flex items-center justify-center bg-neutral-100 ${hasHeight ? '' : 'aspect-[3/2]'} ${className ?? ''}`}
                style={style}
                aria-busy="true"
            >
                <svg className="h-5 w-5 animate-spin text-neutral-300" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
            </div>
        );
    }

    const url = attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src;
    // Serve right-sized derivatives when the caller declares `sizes` (skipped on a
    // retry so the cache-busted full image loads if a derivative is mid-write).
    const srcSet = sizes && attempt === 0 ? buildSrcSet(src) ?? undefined : undefined;

    return (
        <img
            decoding="async"
            {...rest}
            alt={rest.alt ?? ''}
            src={url}
            srcSet={srcSet}
            sizes={sizes}
            className={className}
            style={style}
            onError={() => setErrored(true)}
        />
    );
}

/**
 * A gallery image is either a bare URL (hand-added in the builder) or a
 * `{ thumb, full }` pair produced by the WordPress importer: the small `thumb`
 * fills the grid tile, the large `full` opens in the lightbox. Helpers below
 * collapse both shapes so the renderer doesn't care which it got.
 */
export type GalleryImage = string | { thumb?: string; full?: string; src?: string; alt?: string; title?: string; caption?: string };

export function galleryThumb(img: GalleryImage): string {
    return typeof img === 'string' ? img : img?.thumb || img?.full || img?.src || '';
}

export function galleryFull(img: GalleryImage): string {
    return typeof img === 'string' ? img : img?.full || img?.src || img?.thumb || '';
}

/** Per-image SEO metadata. Plain-string images carry none until edited. */
export function galleryAlt(img: GalleryImage): string {
    return typeof img === 'string' ? '' : img?.alt || '';
}

export function galleryTitle(img: GalleryImage): string {
    return typeof img === 'string' ? '' : img?.title || '';
}

export function galleryCaption(img: GalleryImage): string {
    return typeof img === 'string' ? '' : img?.caption || '';
}

/**
 * JS masonry that mirrors the old WordPress site's `layoutMasonry`: each tile is
 * measured and absolutely positioned into the currently-shortest column, so a
 * late-loading image only grows its own column and never reshuffles the others.
 * The grid stays hidden until its images have loaded and been placed, so it
 * appears settled rather than "rushing into place" (CSS `columns` reflows as
 * lazy images load, which caused photos to swap positions mid-scroll).
 */
function MasonryGrid({ cols, gap = 16, children }: { cols: number; gap?: number; children: React.ReactNode[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [revealed, setRevealed] = useState(false);

    const layout = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const width = container.clientWidth;
        if (!width) return;

        let columns = cols;
        if (width <= 640) columns = 1;
        else if (width <= 1024) columns = Math.min(2, cols);
        columns = Math.max(1, columns);

        const columnWidth = (width - (columns - 1) * gap) / columns;
        const colHeights = new Array(columns).fill(0);

        itemRefs.current.forEach((el) => {
            if (!el) return;
            el.style.width = `${columnWidth}px`;
            const col = colHeights.indexOf(Math.min(...colHeights));
            el.style.left = `${col * (columnWidth + gap)}px`;
            el.style.top = `${colHeights[col]}px`;
            colHeights[col] += el.offsetHeight + gap;
        });

        container.style.height = `${Math.max(0, ...colHeights)}px`;
    }, [cols, gap]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        layout();

        const imgs = Array.from(container.querySelectorAll('img'));
        const total = imgs.length;
        let settled = imgs.filter((im) => im.complete).length;
        const maybeReveal = () => {
            if (total === 0 || settled >= total) setRevealed(true);
        };
        maybeReveal();

        // load/error don't bubble, so listen in the capture phase. Each image
        // that arrives re-runs the layout and counts toward revealing the grid.
        const onSettle = () => {
            settled++;
            layout();
            maybeReveal();
        };
        container.addEventListener('load', onSettle, true);
        container.addEventListener('error', onSettle, true);

        const onResize = () => layout();
        window.addEventListener('resize', onResize);

        // Never stay hidden forever if an image is slow or never loads.
        const fallback = window.setTimeout(() => setRevealed(true), 2500);
        const raf = requestAnimationFrame(layout);

        return () => {
            container.removeEventListener('load', onSettle, true);
            container.removeEventListener('error', onSettle, true);
            window.removeEventListener('resize', onResize);
            clearTimeout(fallback);
            cancelAnimationFrame(raf);
        };
    }, [layout, children.length]);

    return (
        <div ref={containerRef} className={`relative transition-opacity duration-500 ${revealed ? 'opacity-100' : 'opacity-0'}`}>
            {children.map((child, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        itemRefs.current[i] = el;
                    }}
                    className="absolute left-0 top-0"
                >
                    {child}
                </div>
            ))}
        </div>
    );
}

function GalleryBlock({ d, interactive, width, onEditHeading }: { d: Record<string, any>; interactive: boolean; width?: string; onEditHeading?: (v: string) => void }) {
    const images: GalleryImage[] = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
    const cols = Math.min(Math.max(Number(d.columns) || 3, 2), 4);
    const layout = ['square', 'landscape', 'portrait', 'masonry'].includes(d.layout) ? d.layout : 'square';
    const lightbox = d.lightbox !== false;
    const [active, setActive] = useState<number | null>(null);

    const gridCols = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
    const aspect = layout === 'landscape' ? 'aspect-[4/3]' : layout === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

    // Show placeholder tiles in the builder preview when there are no images yet.
    const tiles = images.length > 0 ? images : interactive ? [] : ['', '', '', '', '', ''];
    const canLightbox = interactive && lightbox && images.length > 0;
    const open = (i: number) => canLightbox && setActive(i);
    const zoom = canLightbox ? 'cursor-zoom-in' : '';

    // Full width breaks out of the usual centered container to span the viewport.
    const wrap = d.full_width ? 'w-full px-2 py-12 sm:px-3' : `mx-auto ${containerW(width, 'max-w-6xl')} px-6 py-20 sm:px-10`;

    return (
        <section className={wrap}>
            {onEditHeading
                ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading (optional)" onChange={onEditHeading} className="mb-12 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                : d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}

            {tiles.length === 0 ? (
                <p className="text-center text-sm text-neutral-400">No images yet.</p>
            ) : layout === 'masonry' ? (
                <MasonryGrid key={tiles.map(galleryThumb).join('|')} cols={cols} gap={12}>
                    {tiles.map((img, i) => {
                        const t = galleryThumb(img);
                        return t ? (
                            <RetryImg key={i} src={t} alt={galleryAlt(img)} title={galleryTitle(img) || undefined} loading="lazy" onClick={() => open(i)} className={`block w-full rounded-lg ${zoom}`} />
                        ) : (
                            <div key={i} className="flex h-40 w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-300">Photo</div>
                        );
                    })}
                </MasonryGrid>
            ) : (
                <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
                    {tiles.map((img, i) => {
                        const t = galleryThumb(img);
                        return t ? (
                            <RetryImg key={i} src={t} alt={galleryAlt(img)} title={galleryTitle(img) || undefined} loading="lazy" onClick={() => open(i)} className={`${aspect} w-full rounded-lg object-cover ${zoom}`} />
                        ) : (
                            <div key={i} className={`${aspect} flex w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-300`}>Photo</div>
                        );
                    })}
                </div>
            )}

            {active !== null && (
                <Lightbox
                    images={images.map((img) => ({ src: galleryFull(img), alt: galleryAlt(img), title: galleryTitle(img), caption: galleryCaption(img) }))}
                    index={active}
                    onClose={() => setActive(null)}
                    onIndex={setActive}
                />
            )}
        </section>
    );
}

interface LightboxImage { src: string; alt?: string; title?: string; caption?: string }

function Lightbox({ images, index, onClose, onIndex }: { images: LightboxImage[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
    const go = (delta: number) => onIndex((index + delta + images.length) % images.length);
    const current = images[index];

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, images.length]);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute right-4 top-4 text-white/70 transition hover:text-white" aria-label="Close">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {images.length > 1 && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-2 sm:left-6 text-white/70 transition hover:text-white" aria-label="Previous">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-2 sm:right-6 text-white/70 transition hover:text-white" aria-label="Next">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </>
            )}
            <img src={current.src} alt={current.alt || ''} title={current.title || undefined} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[92vw] rounded object-contain" />
            {current.caption && <div className="absolute bottom-12 left-1/2 max-w-[80vw] -translate-x-1/2 text-center text-sm text-white/80">{current.caption}</div>}
            {images.length > 1 && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60">{index + 1} / {images.length}</div>}
        </div>,
        document.body,
    );
}

// ─── Contact form (the lead capture) ──────────────────────────────────────────

function ContactBlock({ data: d, theme, slug, basePath, interactive, width, onEditHeading, onEditSubheading }: { data: Record<string, any>; theme: SiteTheme; slug: string; basePath?: string; interactive: boolean; width?: string; onEditHeading?: (v: string) => void; onEditSubheading?: (v: string) => void }) {
    return (
        <section id="contact" className="bg-neutral-50 px-6 py-20 sm:px-10">
            <div className={`mx-auto ${containerW(width, 'max-w-xl')}`}>
                {onEditHeading ? (
                    <>
                        <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={onEditHeading} className="block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                        <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={onEditSubheading!} className="mt-3 block text-center text-neutral-600" />
                    </>
                ) : (
                    <>
                        {d.heading && <h2 className="text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                        {d.subheading && <p className="mt-3 text-center text-neutral-600">{d.subheading}</p>}
                    </>
                )}
                <div className="mt-10">
                    {interactive ? (
                        <ContactFormLive data={d} theme={theme} slug={slug} basePath={basePath ?? `/site/${slug}`} />
                    ) : (
                        <ContactFormPreview data={d} theme={theme} />
                    )}
                </div>
            </div>
        </section>
    );
}

function fieldClass() {
    return 'block w-full rounded-lg border-neutral-200 bg-white text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-0';
}

/**
 * Resolves the contact form's "after submit" target to a URL, or null to keep
 * the inline thank-you message. Accepts a full URL / absolute path as-is, the
 * sentinel `home`, or a page slug (resolved against the current site).
 */
function resolveRedirect(target: string | undefined, base: string): string | null {
    const t = (target ?? '').trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t) || t.startsWith('/')) return t;
    if (t === 'home') return base || '/';
    return `${base}/${t}`;
}

/**
 * Fires the studio's conversion tracking when an enquiry is submitted.
 *  - `tracking_event`: the easy path — pushes a GTM dataLayer event and a GA4
 *    gtag event of that name (works with no code once their base tag is set).
 *  - `conversion_code`: advanced — runs a raw snippet (e.g. a Google Ads
 *    conversion gtag call) in page context.
 */
function fireConversion(d: Record<string, any>) {
    const event = (d.tracking_event ?? '').trim();
    if (event) {
        const w = window as any;
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push({ event });
        if (typeof w.gtag === 'function') w.gtag('event', event);
    }

    const code = (d.conversion_code ?? '').trim();
    if (code) {
        try {
            // eslint-disable-next-line no-new-func
            new Function(code)();
        } catch (e) {
            console.error('Conversion tracking error:', e);
        }
    }
}

function ContactFormLive({ data: d, theme, slug, basePath }: { data: Record<string, any>; theme: SiteTheme; slug: string; basePath: string }) {
    const customFields: any[] = Array.isArray(d.custom_fields) ? d.custom_fields : [];
    const form = useForm<Record<string, any>>({
        name: '', email: '', phone: '', event_date: '', event_type: '', message: '',
        company_website: '', // honeypot — must stay empty
        custom_values: customFields.map((f) => ({ label: f.label ?? '', value: '' })),
        attachment: null as File | null,
        autoresponder: !!d.autoresponder,
        autoresponder_subject: d.autoresponder_subject ?? '',
        autoresponder_message: d.autoresponder_message ?? '',
    });

    const setCustom = (i: number, value: string) =>
        form.setData('custom_values', form.data.custom_values.map((c: any, ci: number) => (ci === i ? { ...c, value } : c)));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`${basePath}/contact`, {
            preserveScroll: true,
            onSuccess: () => {
                fireConversion(d);
                const target = resolveRedirect(d.redirect_url, basePath);
                if (target) {
                    window.location.href = target;
                    return;
                }
                form.reset();
            },
        });
    };

    if (form.recentlySuccessful) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                <p className="text-lg font-medium text-emerald-800">Thank you!</p>
                <p className="mt-1 text-sm text-emerald-700">Your enquiry has been sent. We'll be in touch soon.</p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {/* Honeypot — hidden from real users, catches bots */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden" style={{ position: 'absolute' }}>
                <label>
                    Company website
                    <input type="text" tabIndex={-1} autoComplete="off" value={form.data.company_website} onChange={(e) => form.setData('company_website', e.target.value)} />
                </label>
            </div>
            <div>
                <input className={fieldClass()} placeholder="Your name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
            </div>
            <div>
                <input type="email" className={fieldClass()} placeholder="Email address" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                {form.errors.email && <p className="mt-1 text-xs text-red-600">{form.errors.email}</p>}
            </div>
            {d.show_phone && (
                <input className={fieldClass()} placeholder="Phone (optional)" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                {d.show_event_date && (
                    <input type="date" className={fieldClass()} value={form.data.event_date} onChange={(e) => form.setData('event_date', e.target.value)} />
                )}
                {d.show_event_type && (
                    <select className={fieldClass()} value={form.data.event_type} onChange={(e) => form.setData('event_type', e.target.value)}>
                        <option value="">What are you after?</option>
                        {EVENT_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                )}
            </div>
            <textarea className={fieldClass()} rows={4} placeholder="Tell us a little about your enquiry…" value={form.data.message} onChange={(e) => form.setData('message', e.target.value)} />

            {customFields.map((f, i) => {
                const val = form.data.custom_values[i]?.value ?? '';
                return (
                    <div key={i}>
                        {f.type !== 'checkbox' && <label className="mb-1 block text-sm text-neutral-600">{f.label}{f.required ? ' *' : ''}</label>}
                        {f.type === 'textarea' ? (
                            <textarea className={fieldClass()} rows={3} required={!!f.required} value={val} onChange={(e) => setCustom(i, e.target.value)} />
                        ) : f.type === 'select' ? (
                            <select className={fieldClass()} required={!!f.required} value={val} onChange={(e) => setCustom(i, e.target.value)}>
                                <option value="">Choose…</option>
                                {String(f.options || '').split('\n').map((o: string) => o.trim()).filter(Boolean).map((o: string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : f.type === 'checkbox' ? (
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input type="checkbox" required={!!f.required} checked={val === 'Yes'} onChange={(e) => setCustom(i, e.target.checked ? 'Yes' : '')} /> {f.label}{f.required ? ' *' : ''}
                            </label>
                        ) : (
                            <input className={fieldClass()} required={!!f.required} value={val} onChange={(e) => setCustom(i, e.target.value)} />
                        )}
                    </div>
                );
            })}

            {d.allow_file && (
                <div>
                    <label className="mb-1 block text-sm text-neutral-600">{d.file_label || 'Attach a file'}</label>
                    <input type="file" className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200" onChange={(e) => form.setData('attachment', e.target.files?.[0] ?? null)} />
                    {form.errors.attachment && <p className="mt-1 text-xs text-red-600">{form.errors.attachment}</p>}
                </div>
            )}

            <button type="submit" disabled={form.processing} className="w-full rounded-full px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: theme.primary_color }}>
                {form.processing ? 'Sending…' : d.submit_label || 'Send enquiry'}
            </button>
        </form>
    );
}

function ContactFormPreview({ data: d, theme }: { data: Record<string, any>; theme: SiteTheme }) {
    return (
        <div className="pointer-events-none space-y-4 opacity-90">
            <input className={fieldClass()} placeholder="Your name" disabled />
            <input className={fieldClass()} placeholder="Email address" disabled />
            {d.show_phone && <input className={fieldClass()} placeholder="Phone (optional)" disabled />}
            <div className="grid gap-4 sm:grid-cols-2">
                {d.show_event_date && <input className={fieldClass()} placeholder="Event date" disabled />}
                {d.show_event_type && <input className={fieldClass()} placeholder="What are you after?" disabled />}
            </div>
            <textarea className={fieldClass()} rows={4} placeholder="Tell us a little about your enquiry…" disabled />
            {(Array.isArray(d.custom_fields) ? d.custom_fields : []).map((f: any, i: number) => (
                <input key={i} className={fieldClass()} placeholder={`${f.label || 'Field'}${f.required ? ' *' : ''}`} disabled />
            ))}
            {d.allow_file && <input className={fieldClass()} placeholder={d.file_label || 'Attach a file'} disabled />}
            <div className="w-full rounded-full px-6 py-3 text-center text-sm font-medium text-white" style={{ backgroundColor: theme.primary_color }}>
                {d.submit_label || 'Send enquiry'}
            </div>
        </div>
    );
}
