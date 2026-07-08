import { SiteBlock } from '@/types';
import { useEffect, useState } from 'react';
import { BlockEditing } from './registry';
import { GoogleG, Stars, containerW } from './ui';

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

export function ReviewsBlock({ block, d, primary, editing }: { block: SiteBlock; d: Record<string, any>; primary: string; editing?: BlockEditing }) {
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
