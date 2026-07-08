import { formatMoney } from '@/lib/money';
import { BlogPostCard, BlogState, PackageCard, SiteBlock, SiteBlockType, SiteCategory, SiteTheme } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { BLOCK_LIBRARY, BlockEditing, blockLabel } from './registry';
import { BeforeAfterBlock } from './BeforeAfterBlock';
import { BlogBlock } from './BlogBlock';
import { BookingBlock } from './BookingBlock';
import { CountdownBlock } from './CountdownBlock';
import { ContactBlock } from './ContactBlock';
import { GalleryBlock } from './GalleryBlock';
import { HeroSection } from './HeroSection';
import { InstagramBlock } from './InstagramBlock';
import { NewsletterBlock } from './NewsletterBlock';
import { PostHeaderBlock } from './PostHeaderBlock';
import { ReviewsBlock } from './ReviewsBlock';
import { SliderBlock } from './SliderBlock';
import { GalleryImage, InlineRichText, InlineText, RetryImg, Stars, containerW, galleryAlt, galleryThumb, galleryTitle, videoEmbedUrl } from './ui';

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
    /** Server-side pagination state for a paginating `blog` block (live site). */
    blogState?: BlogState | null;
    /** The studio's public scheduling page URL, for `booking` blocks. */
    bookingUrl?: string | null;
    /** Builder-only editing affordances (click-to-select, chrome, nesting). */
    editing?: BlockEditing;
}

function BlockInner({ block, theme, slug, basePath, interactive, posts, categories, packages, blogState, bookingUrl, editing }: BlockViewProps) {
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
                    // Stacked banner pages (e.g. a portfolio of gallery links)
                    // demote 2nd+ heroes so the page keeps a single h1.
                    headingLevel={d.heading_level === 'h2' ? 'h2' : 'h1'}
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
            return <BlogBlock d={d} posts={posts} categories={categories} slug={slug} interactive={interactive} primary={primary} width={block.settings?.width} blogState={blogState} />;

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
                                    <BlockView key={child.id} block={child} theme={theme} slug={slug} basePath={base} interactive={interactive} posts={posts} categories={categories} packages={packages} blogState={blogState} bookingUrl={bookingUrl} editing={editing} />
                                ))}
                                {editing && <GridCellAdder onAdd={(type) => editing.onAddChild(block.id, col, type)} />}
                            </div>
                        ))}
                    </div>
                </section>
            );
        }

        case 'beforeafter':
            return <BeforeAfterBlock d={d} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} />;

        case 'countdown':
            return <CountdownBlock d={d} primary={primary} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} onEditSubheading={edit ? (v) => commit({ subheading: v }) : undefined} />;

        case 'instagram':
            return <InstagramBlock block={block} d={d} primary={primary} editing={editing} />;

        case 'booking':
            return <BookingBlock d={d} bookingUrl={bookingUrl} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} onEditSubheading={edit ? (v) => commit({ subheading: v }) : undefined} />;

        case 'newsletter':
            return <NewsletterBlock d={d} theme={theme} slug={slug} basePath={base} interactive={interactive} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} onEditSubheading={edit ? (v) => commit({ subheading: v }) : undefined} />;

        case 'contact':
            return <ContactBlock data={d} theme={theme} slug={slug} basePath={base} interactive={interactive} width={block.settings?.width} onEditHeading={edit ? (v) => commit({ heading: v }) : undefined} onEditSubheading={edit ? (v) => commit({ subheading: v }) : undefined} />;

        case 'post_header':
            return <PostHeaderBlock d={d} theme={theme} editing={editing} />;

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
        // Live-site-only responsive visibility (the builder always shows blocks
        // so they stay selectable — the Style tab explains this).
        ! editing && s.hide_mobile ? 'blk-hide-mobile' : '',
        ! editing && s.hide_desktop ? 'blk-hide-desktop' : '',
        s.class_name ?? '',
    ].filter(Boolean).join(' ');

    const frameStyle: React.CSSProperties = {};
    if (s.background) frameStyle.backgroundColor = s.background;
    if (s.text_color) frameStyle.color = s.text_color;

    const inner = <BlockInner {...props} />;
    // Scroll-in animation (live site only): tag + observe after mount so no-JS
    // visitors and crawlers always get visible content.
    const animate = ! editing && s.animate && s.animate !== 'none' ? s.animate : null;
    const frameRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = frameRef.current;
        if (! el || ! animate) return;
        el.classList.add('blk-anim', `blk-anim-${animate}`);
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    el.classList.add('blk-anim-in');
                    io.disconnect();
                }
            });
        }, { rootMargin: '0px 0px -10% 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [animate]);

    // Always wrap so the block-type class is present in the DOM for every block.
    const content = <div ref={frameRef} className={frameClasses} style={frameStyle}>{inner}</div>;

    // On the live site a hidden block renders nothing; in the builder it stays
    // visible (dimmed) so it can be selected and toggled back on.
    if (!editing) return block.hidden ? null : content;

    const selected = editing.selectedId === block.id;
    return (
        <div
            className={`group/blk relative cursor-pointer ${selected ? 'z-10 ring-2 ring-inset ring-brand-500' : 'ring-1 ring-inset ring-transparent hover:ring-2 hover:ring-brand-300'}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onSelect(block.id); }}
        >
            <div className={block.hidden ? 'opacity-40 grayscale' : ''}>{content}</div>
            {block.hidden && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center py-1">
                    <span className="rounded-full bg-neutral-900/80 px-2 py-0.5 text-[11px] font-medium text-white shadow">Hidden — not shown on live site</span>
                </div>
            )}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 px-2 py-1 transition ${selected ? 'opacity-100' : 'opacity-0 group-hover/blk:opacity-100'}`}>
                <span className="pointer-events-auto rounded bg-brand px-1.5 py-0.5 text-[11px] font-medium text-white shadow">{blockLabel(block.type)}</span>
                <span className="pointer-events-auto flex gap-1">
                    {editing.onMove && (
                        <>
                            <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onMove!(block.id, -1); }} className="flex items-center rounded bg-neutral-900/80 px-1.5 py-0.5 text-white shadow hover:bg-neutral-700" title="Move up" aria-label="Move block up">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onMove!(block.id, 1); }} className="flex items-center rounded bg-neutral-900/80 px-1.5 py-0.5 text-white shadow hover:bg-neutral-700" title="Move down" aria-label="Move block down">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                            </button>
                        </>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onSelect(block.id); }} className="rounded bg-brand px-1.5 py-0.5 text-[11px] font-medium text-white shadow hover:bg-brand-700">Edit</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onDelete(block.id); }} className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-medium text-white shadow hover:bg-red-700" title="Delete block">✕</button>
                </span>
            </div>
        </div>
    );
}

// ─── Between-block inserter (builder only) ────────────────────────────────────

/** Hover seam between two canvas blocks: reveals a "+" that opens the block
 *  picker at that position. `active` forces it visible (adjacent block hovered). */
export function CanvasInsertPoint({ index, active, onInsert }: { index: number; active?: boolean; onInsert: (index: number) => void }) {
    return (
        <div className="group/ins relative z-30 h-0">
            {/* Band is visual-only; just the "+" is clickable so the seam never
                steals clicks from the adjacent blocks' own chrome. */}
            <div
                className={`pointer-events-none absolute inset-x-0 -top-3.5 flex h-7 items-center transition-opacity duration-100 group-hover/ins:opacity-100 ${active ? 'opacity-100' : 'opacity-0'}`}
            >
                <div className="h-px flex-1 bg-brand-400" />
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onInsert(index); }}
                    className="pointer-events-auto mx-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white shadow-md transition hover:scale-110 hover:bg-brand-700"
                    title="Add a block here"
                    aria-label="Add a block here"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
                <div className="h-px flex-1 bg-brand-400" />
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
                className="flex w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 py-3 text-xs font-medium text-neutral-500 hover:border-brand-400 hover:text-brand"
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
