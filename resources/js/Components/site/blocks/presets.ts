import { SiteBlock } from '@/types';
import { makeBlock } from './registry';

/**
 * Pre-designed sections: curated, styled combinations of existing blocks that
 * insert ready-to-edit (shown in the Add-block picker alongside the studio's
 * own saved sections). Each build() returns one or more fresh blocks.
 */
export interface SectionPreset {
    id: string;
    name: string;
    hint: string;
    build: () => SiteBlock[];
}

/** makeBlock + data/settings overrides, keeping fresh ids. */
function preset(type: Parameters<typeof makeBlock>[0], data: Record<string, unknown>, settings?: Record<string, unknown>): SiteBlock {
    const block = makeBlock(type);
    block.data = { ...block.data, ...data };
    if (settings) block.settings = { ...(block.settings ?? {}), ...settings };
    return block;
}

export const SECTION_PRESETS: SectionPreset[] = [
    {
        id: 'hero-cinematic',
        name: 'Cinematic hero',
        hint: 'Full-height hero, bottom-left text over a dark gradient',
        build: () => [preset('hero', { height: 'full', title_size: 'xl', overlay: 45, content_x: 'left', content_y: 'bottom', text_align: 'left', text_shadow: 'soft', text_bg: 'gradient', text_bg_opacity: 70, text_bg_extent: 55 })],
    },
    {
        id: 'hero-panel',
        name: 'Soft panel hero',
        hint: 'Centered headline on a translucent panel',
        build: () => [preset('hero', { overlay: 15, text_bg: 'panel', text_bg_color: '#ffffff', text_bg_opacity: 65, title_size: 'lg' })],
    },
    {
        id: 'stats-band',
        name: 'Stats band',
        hint: 'Three big numbers that build trust',
        build: () => [preset('services', {
            heading: '',
            items: [
                { title: '250+', description: 'Weddings photographed', price: '' },
                { title: '12', description: 'Years behind the camera', price: '' },
                { title: '5.0★', description: 'Average client rating', price: '' },
            ],
        }, { background: '#171717', text_color: '#ffffff', padding: 'lg' })],
    },
    {
        id: 'testimonial-trio',
        name: 'Testimonial trio',
        hint: 'Three client quotes on a soft background',
        build: () => [preset('testimonials', {
            heading: 'Kind words',
            items: [
                { quote: 'An absolute dream to work with from start to finish.', author: 'E & J', role: 'Wedding' },
                { quote: 'The photos made us cry — in the best way.', author: 'A & S', role: 'Elopement' },
                { quote: 'Every image feels like us. We could not be happier.', author: 'M & T', role: 'Engagement' },
            ],
        })],
    },
    {
        id: 'pricing-three',
        name: 'Three-tier pricing',
        hint: 'Three packages with the middle one featured',
        build: () => [preset('pricing', {
            heading: 'Collections',
            plans: [
                { name: 'Essential', price: '$1,800', period: '', features: 'Up to 6 hours\nOnline gallery\n300+ edited photos', button_label: 'Enquire', button_link: '#contact', featured: false },
                { name: 'Signature', price: '$2,900', period: '', features: 'Up to 9 hours\nEngagement session\nOnline gallery\n500+ edited photos', button_label: 'Enquire', button_link: '#contact', featured: true },
                { name: 'Legacy', price: '$4,200', period: '', features: 'Full-day coverage\nSecond photographer\nFine-art album\nOnline gallery', button_label: 'Enquire', button_link: '#contact', featured: false },
            ],
        })],
    },
    {
        id: 'faq-cta',
        name: 'FAQ + booking call-to-action',
        hint: 'Common questions followed by a booking band',
        build: () => [
            preset('faq', {
                heading: 'Questions, answered',
                items: [
                    { q: 'How far in advance should we book?', a: 'Most couples book 9–14 months ahead — but it is always worth asking about your date.' },
                    { q: 'How many photos will we receive?', a: 'A full wedding typically delivers 400–700 edited images in an online gallery.' },
                    { q: 'Do you travel?', a: 'Happily. Travel within the region is included; further afield is quoted per trip.' },
                ],
            }),
            preset('cta', { heading: 'Ready to check your date?', subheading: 'Tell us about your plans — we reply within one business day.', button_label: 'Get in touch', button_link: '#contact' }),
        ],
    },
    {
        id: 'split-intro',
        name: 'Split introduction',
        hint: 'Image beside a warm welcome, on a tinted band',
        build: () => [preset('about', { heading: 'Hello, and welcome', body: 'Introduce yourself here — who you are, how you work, and what it feels like to be photographed by you.', image_side: 'right' }, { background: '#faf6f2', padding: 'lg' })],
    },
    {
        id: 'masonry-showcase',
        name: 'Full-width masonry showcase',
        hint: 'Edge-to-edge masonry gallery with a lightbox',
        build: () => [preset('gallery', { layout: 'masonry', full_width: true, columns: 3 })],
    },
    {
        id: 'newsletter-band',
        name: 'Newsletter band',
        hint: 'Email capture on a soft tinted background',
        build: () => [preset('newsletter', {}, { background: '#f2f7fa' })],
    },
    {
        id: 'logo-strip',
        name: '"As featured in" strip',
        hint: 'A quiet row of publication/partner logos',
        build: () => [preset('logos', { heading: 'As featured in' })],
    },
];
