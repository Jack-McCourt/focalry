import { SiteBlock, SiteBlockType } from '@/types';
import type {
    AboutData, BeforeAfterData, BookingData, CountdownData, BlogData, ButtonData, CardData, ContactData, CtaData, DividerData,
    EmbedData, FaqData, GalleryData, GridData, HeroData, ImageData, LogosData,
    InstagramData, MapData, NewsletterData, PackagesData, PostHeaderData, PricingData, ReviewsData, ServicesData, SliderData,
    TestimonialsData, TextData, VideoData,
} from './data';

/**
 * Block types that only make sense on a blog post page (they render the post's
 * own content). The picker hides these on ordinary pages.
 */
export const POST_ONLY_BLOCK_TYPES: SiteBlockType[] = ['post_header'];

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
        make: (): HeroData => ({ heading: 'Your headline', subheading: 'A short supporting line', image_url: '', cta_label: 'Get in touch', cta_link: '#contact', overlay: 35, content_x: 'center', content_y: 'center', text_align: 'center', text_shadow: 'none', title_size: 'md', height: 'default', height_value: '600px', focal_x: 50, focal_y: 50, text_bg: 'none', text_bg_color: '#000000', text_bg_opacity: 60, text_bg_extent: 65 }),
    },
    {
        type: 'slider',
        label: 'Slider / carousel',
        hint: 'A rotating banner of image slides, each with its own text',
        make: (): SliderData => ({
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
        make: (): AboutData => ({ heading: 'About', body: 'Tell visitors who you are and what you do.', image_url: '', image_side: 'left' }),
    },
    {
        type: 'card',
        label: 'Card',
        hint: 'Image card with a title and text',
        make: (): CardData => ({ image_url: '', heading: 'Card title', body: 'Add a short bit of text about this card.', image_ratio: 'none' }),
    },
    {
        type: 'services',
        label: 'Services',
        hint: 'A grid of offerings with prices',
        make: (): ServicesData => ({ heading: 'Services', items: [{ title: 'Service', description: 'What it includes', price: 'From $0' }] }),
    },
    {
        type: 'gallery',
        label: 'Gallery',
        hint: 'A responsive grid of images',
        make: (): GalleryData => ({ heading: 'Gallery', columns: 3, images: [], layout: 'square', lightbox: true, full_width: false }),
    },
    {
        type: 'blog',
        label: 'Blog posts',
        hint: 'A grid of your latest blog posts',
        make: (): BlogData => ({ heading: 'From the journal', columns: 3, limit: 0, show_categories: true }),
    },
    {
        type: 'packages',
        label: 'Packages',
        hint: 'A grid of your bookable packages with a Book button',
        make: (): PackagesData => ({ heading: 'Packages', subheading: '', columns: 3 }),
    },
    {
        type: 'reviews',
        label: 'Google Reviews',
        hint: 'Show your Google business reviews — connect to load them',
        make: (): ReviewsData => ({
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
        make: (): TextData => ({ heading: 'Heading', heading_level: 'h2', body: 'Write something here.', align: 'left' }),
    },
    {
        type: 'image',
        label: 'Image',
        hint: 'A single full-width image with a caption',
        make: (): ImageData => ({ image_url: '', caption: '', alt: '' }),
    },
    {
        type: 'video',
        label: 'Video',
        hint: 'Embed a YouTube or Vimeo video',
        make: (): VideoData => ({ url: '', caption: '' }),
    },
    {
        type: 'button',
        label: 'Button',
        hint: 'A call-to-action button',
        make: (): ButtonData => ({ label: 'Learn more', link: '#contact', align: 'center', style: 'solid' }),
    },
    {
        type: 'cta',
        label: 'Call to action',
        hint: 'A bold banner with a heading and button',
        make: (): CtaData => ({ heading: 'Ready to book?', subheading: "Let's create something beautiful together.", button_label: 'Get in touch', button_link: '#contact' }),
    },
    {
        type: 'faq',
        label: 'FAQ',
        hint: 'A list of expandable questions & answers',
        make: (): FaqData => ({ heading: 'Frequently asked questions', items: [{ q: 'A question?', a: 'The answer.' }] }),
    },
    {
        type: 'testimonials',
        label: 'Testimonials',
        hint: 'Quotes from happy clients',
        make: (): TestimonialsData => ({ heading: 'Kind words', items: [{ quote: 'An absolute dream to work with.', author: 'A. Client', role: '' }] }),
    },
    {
        type: 'pricing',
        label: 'Pricing table',
        hint: 'Columns of plans with features',
        make: (): PricingData => ({ heading: 'Pricing', plans: [{ name: 'Essential', price: '$1,500', period: '', features: 'Up to 6 hours\nOnline gallery\n200+ edited photos', button_label: 'Enquire', button_link: '#contact', featured: false }] }),
    },
    {
        type: 'logos',
        label: 'Logo bar',
        hint: 'A row of partner / "as seen in" logos',
        make: (): LogosData => ({ heading: 'As featured in', images: [] }),
    },
    {
        type: 'map',
        label: 'Map',
        hint: 'An embedded map of your location',
        make: (): MapData => ({ query: '', height: 360 }),
    },
    {
        type: 'embed',
        label: 'Embed / HTML',
        hint: 'Paste an embed code or custom HTML',
        make: (): EmbedData => ({ html: '' }),
    },
    {
        type: 'divider',
        label: 'Divider / spacer',
        hint: 'A horizontal line or blank space',
        make: (): DividerData => ({ style: 'line', size: 'md' }),
    },
    {
        type: 'contact',
        label: 'Contact form',
        hint: 'Capture enquiries — creates a lead in your CRM',
        make: (): ContactData => ({ heading: "Let's talk", subheading: '', submit_label: 'Send enquiry', show_phone: true, show_event_date: true, show_event_type: true, custom_fields: [], allow_file: false, file_label: 'Attach a file (optional)', redirect_url: '', autoresponder: false, autoresponder_subject: 'Thanks for your enquiry', autoresponder_message: "Thanks for getting in touch — we've received your enquiry and will reply as soon as we can.", tracking_event: '', conversion_code: '' }),
    },
    {
        type: 'instagram',
        label: 'Instagram feed',
        hint: 'A grid of your latest Instagram posts — connect to load them',
        make: (): InstagramData => ({ heading: 'Follow along', columns: 4, limit: 8, show_captions: false, items: [], username: null }),
    },
    {
        type: 'beforeafter',
        label: 'Before / after',
        hint: 'Two images with a draggable comparison slider',
        make: (): BeforeAfterData => ({ heading: '', before_url: '', after_url: '', before_label: 'Before', after_label: 'After', alt: '' }),
    },
    {
        type: 'countdown',
        label: 'Countdown',
        hint: 'Days/hours/minutes until a date — weddings, launches, offers',
        make: (): CountdownData => ({ heading: 'The big day', subheading: '', target: '', finished_message: 'The day is here!' }),
    },
    {
        type: 'booking',
        label: 'Book a call',
        hint: 'Embed your scheduling page — visitors pick a time right on the site',
        make: (): BookingData => ({ heading: 'Book a call', subheading: "Pick a time that suits you — we'll take it from there.", height: 900 }),
    },
    {
        type: 'newsletter',
        label: 'Newsletter signup',
        hint: 'Collect email subscribers — export them for any email tool',
        make: (): NewsletterData => ({ heading: 'Join the newsletter', subheading: 'Session dates, offers and new work — straight to your inbox.', placeholder: 'Your email address', button_label: 'Subscribe', success_message: "You're on the list — thank you!", show_name: false }),
    },
    {
        type: 'grid',
        label: 'Grid / columns',
        hint: 'A multi-column container — drop other blocks inside each column',
        make: (): GridData => ({ columns: 2, gap: 'md' }),
    },
    {
        type: 'post_header',
        label: 'Post header',
        hint: "A blog post's cover image + title, date & categories (posts only)",
        make: (): PostHeaderData => ({ overlay: 35, content_x: 'center', content_y: 'center', text_align: 'center', text_shadow: 'soft', title_size: 'lg', height: 'default', height_value: '600px', text_bg: 'none', text_bg_color: '#000000', text_bg_opacity: 60, text_bg_extent: 65 }),
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
    /** Move a block one step up/down within its sibling list. */
    onMove?: (id: string, dir: -1 | 1) => void;
    /** Open the block picker to insert a new top-level block at this index. */
    onInsertAt?: (index: number) => void;
}
