import LazyRichTextEditor from '@/Components/LazyRichTextEditor';
import { buildSrcSet } from '@/lib/responsiveImage';
import { SiteTheme } from '@/types';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─── Shared rendering primitives used across the block modules ────────────────

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
 * Single-line click-to-edit text (builder only). Edits commit on blur so React
 * never re-renders mid-keystroke (which would jump the caret). Shows a dashed
 * outline on hover and a placeholder when empty.
 */
export function InlineText({ as: Tag = 'div', value, onChange, className, placeholder, style }: { as?: React.ElementType; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; style?: React.CSSProperties }) {
    return (
        <Tag
            contentEditable
            suppressContentEditableWarning
            data-ph={placeholder}
            title="Click to edit"
            style={style}
            className={`inline-editable cursor-text rounded outline-dashed outline-1 outline-transparent transition focus:outline-brand-400 hover:outline-brand-300 ${className ?? ''}`}
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
export function InlineRichText({ html, onChange, className }: { html: string; onChange: (html: string) => void; className?: string }) {
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
            className={`inline-editable cursor-text rounded outline-dashed outline-1 outline-transparent transition hover:outline-brand-300 ${className ?? ''}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditing(true); }}
            dangerouslySetInnerHTML={{ __html: html?.trim() ? html : '<p class="text-neutral-400">Click to add text…</p>' }}
        />
    );
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
export function MasonryGrid({ cols, gap = 16, children }: { cols: number; gap?: number; children: React.ReactNode[] }) {
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
export interface LightboxImage { src: string; alt?: string; title?: string; caption?: string }

export function Lightbox({ images, index, onClose, onIndex }: { images: LightboxImage[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
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
