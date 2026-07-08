import { SiteBlock, SiteTheme } from '@/types';
import { useEffect, useState } from 'react';
import { BlockEditing } from './registry';
import { HeroSection } from './HeroSection';
import { containerW } from './ui';

/**
 * Slider / carousel: a rotating banner of slides. Each slide reuses HeroSection
 * (so it offers the same image + text layout options), while autoplay, arrows,
 * dots and the transition are configured once at the block level. Block-level
 * design keys (overlay, content position, title size, height, …) are merged into
 * every slide; per-slide keys carry the image, focal point and copy.
 */
export function SliderBlock({ block, d, theme, editing }: { block: SiteBlock; d: Record<string, any>; theme: SiteTheme; editing?: BlockEditing }) {
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
            // Only the first slide gets the page's h1; later slides demote to h2
            // so one carousel doesn't flood the page with h1 headings.
            headingLevel={i === 0 ? 'h1' : 'h2'}
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
