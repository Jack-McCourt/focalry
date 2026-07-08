import type { SiteCategory } from '@/types';
import type { GoogleBusiness, GoogleReview } from './ReviewsBlock';
import type { GalleryImage } from './ui';

/**
 * Typed data shapes for every block. `BLOCK_LIBRARY`'s make() functions are
 * annotated against these, so a renamed/removed key fails the build instead of
 * silently drifting between the editor and the renderer.
 *
 * Deliberately `type` aliases (not interfaces): aliases get an implicit index
 * signature, so they stay assignable to the loose `Record<string, unknown>`
 * the block JSON pipeline uses. Legacy keys kept for saved sites are marked.
 */

/** Shared visual-formatting keys of the hero banner (hero block, slider slides,
 *  and the blog post header all use HeroSection). */
export type HeroDesign = {
    overlay: number;
    content_x: 'left' | 'center' | 'right';
    content_y: 'top' | 'center' | 'bottom';
    text_align: 'left' | 'center' | 'right';
    text_shadow: 'none' | 'soft' | 'medium' | 'strong';
    title_size: 'sm' | 'md' | 'lg' | 'xl';
    height: 'default' | 'full' | 'custom';
    height_value: string;
    text_bg: 'none' | 'gradient' | 'panel';
    text_bg_color: string;
    text_bg_opacity: number;
    text_bg_extent: number;
};

export type HeroData = HeroDesign & {
    heading: string;
    /** 'h2' demotes the title tag (extra hero banners on one page); default h1. */
    heading_level?: 'h1' | 'h2';
    subheading: string;
    image_url: string;
    /** Optional looping muted background video (mp4/webm); image = poster. */
    video_url?: string;
    cta_label: string;
    cta_link: string;
    focal_x: number;
    focal_y: number;
    alt?: string;
    title?: string;
    /** Legacy single alignment field, superseded by content_x/text_align. */
    align?: string;
};

/**
 * The post-header block: a blog post's cover hero. Only the visual design is
 * stored on the block — the heading, cover image, date and categories come from
 * the post itself (via PostMeta context), so they can never drift out of sync.
 */
export type PostHeaderData = HeroDesign;

/** A blog post's own data, supplied to the post-header block through context. */
export interface PostMeta {
    author?: string | null;
    reading_minutes?: number;
    title: string;
    cover_image: string | null;
    cover_focal?: { x: number; y: number } | null;
    published_at: string | null;
    categories: SiteCategory[];
}

export type SliderSlide = {
    image_url: string;
    heading: string;
    subheading: string;
    cta_label: string;
    cta_link: string;
    focal_x: number;
    focal_y: number;
    alt: string;
    title: string;
};

export type SliderData = HeroDesign & {
    slides: SliderSlide[];
    autoplay: boolean;
    speed: number;
    transition: 'slide' | 'fade';
    show_arrows: boolean;
    show_dots: boolean;
};

export type AboutData = {
    heading: string;
    body: string;
    image_url: string;
    image_side: 'left' | 'right';
    image_ratio?: string;
    alt?: string;
    title?: string;
};

export type CardData = {
    image_url: string;
    heading: string;
    body: string;
    image_ratio: string;
    alt?: string;
    title?: string;
};

export type ServicesData = {
    heading: string;
    items: { title: string; description: string; price: string }[];
};

export type GalleryData = {
    heading: string;
    columns: number;
    images: GalleryImage[];
    /** Live-link: mirror a client-gallery Collection (images become managed). */
    linked_collection_id?: number | null;
    linked_title?: string;
    layout: 'square' | 'landscape' | 'portrait' | 'masonry';
    lightbox: boolean;
    full_width: boolean;
};

export type BlogData = {
    heading: string;
    columns: number;
    /** 0 = show all. */
    limit: number;
    show_categories: boolean;
    /** 0 = no pagination; >0 paginates (server-side on the live site). */
    per_page?: number;
};

export type PackagesData = {
    heading: string;
    subheading: string;
    columns: number;
};

export type ReviewsData = {
    heading: string;
    subheading: string;
    place_id: string;
    layout: 'grid' | 'list' | 'carousel' | 'badge';
    columns: number;
    per_view: number;
    autoplay: boolean;
    summary_inline: boolean;
    speed: number;
    max: number;
    min_rating: number;
    show_avatar: boolean;
    show_date: boolean;
    show_summary: boolean;
    link_to_google: boolean;
    /** Snapshot cached from Google — the public site never calls the API. */
    business: GoogleBusiness | null;
    reviews: GoogleReview[];
    fetched_at?: string;
};

export type TextData = {
    heading: string;
    heading_level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    /** Plain text (legacy) or HTML from the WYSIWYG editor. */
    body: string;
    align: 'left' | 'center' | 'right';
};

export type ImageData = {
    image_url: string;
    caption: string;
    alt: string;
    title?: string;
};

export type VideoData = { url: string; caption: string };

export type ButtonData = {
    label: string;
    link: string;
    align: 'left' | 'center' | 'right';
    style: 'solid' | 'outline';
};

export type CtaData = {
    heading: string;
    subheading: string;
    button_label: string;
    button_link: string;
};

export type FaqData = { heading: string; items: { q: string; a: string }[] };

export type TestimonialsData = {
    heading: string;
    items: { quote: string; author: string; role: string }[];
};

export type PricingData = {
    heading: string;
    plans: {
        name: string;
        price: string;
        period: string;
        /** One feature per line. */
        features: string;
        button_label: string;
        button_link: string;
        featured: boolean;
    }[];
};

export type LogosData = { heading: string; images: GalleryImage[] };

export type MapData = { query: string; height: number };

export type EmbedData = { html: string };

export type DividerData = { style: 'line' | 'space'; size: 'sm' | 'md' | 'lg' };

export type ContactCustomField = {
    label: string;
    type: string;
    required?: boolean;
    options?: string;
};

export type ContactData = {
    heading: string;
    subheading: string;
    submit_label: string;
    show_phone: boolean;
    show_event_date: boolean;
    show_event_type: boolean;
    custom_fields: ContactCustomField[];
    allow_file: boolean;
    file_label: string;
    /** '' = inline thank-you · 'home' · a page slug · a full URL/path. */
    redirect_url: string;
    /** Read server-side on submit — never trusted from the visitor's request. */
    autoresponder: boolean;
    autoresponder_subject: string;
    autoresponder_message: string;
    tracking_event: string;
    conversion_code: string;
    /** Require Cloudflare Turnstile (verified server-side; needs platform keys). */
    captcha?: boolean;
};

export type NewsletterData = {
    heading: string;
    subheading: string;
    placeholder: string;
    button_label: string;
    success_message: string;
    show_name: boolean;
};

export type InstagramItem = {
    id: string;
    /** Mirrored to our bucket — Instagram CDN URLs expire. */
    image: string;
    permalink: string;
    caption: string;
};

export type InstagramData = {
    heading: string;
    columns: number;
    limit: number;
    show_captions: boolean;
    /** Snapshot loaded in the builder — the public site never calls Instagram. */
    items: InstagramItem[];
    username?: string | null;
    fetched_at?: string;
};

export type BeforeAfterData = {
    heading: string;
    before_url: string;
    after_url: string;
    before_label: string;
    after_label: string;
    alt?: string;
};

export type CountdownData = {
    heading: string;
    subheading: string;
    /** ISO date (or datetime) counted down to. */
    target: string;
    /** Shown once the date passes. */
    finished_message: string;
};

export type BookingData = {
    heading: string;
    subheading: string;
    /** iframe height in px. */
    height: number;
};

export type GridData = {
    columns: number;
    gap: 'sm' | 'md' | 'lg';
    heading?: string;
    body?: string;
};
