import { SiteTheme } from '@/types';
import { HERO_TEXT_SHADOWS, HERO_TITLE_SIZES, InlineText, RetryImg, containerW, heroHeight, hexToRgba } from './ui';

/**
 * The hero banner: a full-bleed image with an overlaid heading/sub/CTA. Shared
 * by the `hero` block and the auto-generated blog post header (PostHeader) so
 * both offer the exact same formatting options.
 *
 * `d` carries the same loose keys the hero block uses: image_url, focal_x/y,
 * overlay, text_bg(+color/opacity/extent), content_x/y, text_align, title_size,
 * text_shadow, height(+height_value), heading, subheading, cta_label/cta_link.
 *
 * `headingLevel` lets consumers demote the title tag — e.g. a slider's 2nd+
 * slides render h2 so one carousel doesn't emit several h1s.
 */
export function HeroSection({ d, theme, width, sectionId, children, onEditHeading, onEditSubheading, headingLevel = 'h1' }: { d: Record<string, any>; theme: SiteTheme; width?: string; sectionId?: string; children?: React.ReactNode; onEditHeading?: (v: string) => void; onEditSubheading?: (v: string) => void; headingLevel?: 'h1' | 'h2' }) {
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
            {d.video_url && (
                // Looping background video over the image (which doubles as the
                // poster/fallback while it loads and where autoplay is blocked).
                <video
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: `${focalX}% ${focalY}%` }}
                    src={d.video_url}
                    poster={d.image_url || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden
                />
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
                        <InlineText as={headingLevel} value={d.heading ?? ''} placeholder="Add a headline" onChange={onEditHeading} className={`block font-semibold tracking-tight text-white ${HERO_TITLE_SIZES[d.title_size as string] ?? HERO_TITLE_SIZES.md}`} />
                    ) : (
                        // No empty <h1>/<h2> on the live site when a slide/hero is image-only.
                        d.heading && (() => { const H = headingLevel; return <H className={`font-semibold tracking-tight text-white ${HERO_TITLE_SIZES[d.title_size as string] ?? HERO_TITLE_SIZES.md}`}>{d.heading}</H>; })()
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
