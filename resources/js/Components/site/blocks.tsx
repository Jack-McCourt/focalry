import { BlogPostCard, SiteBlock, SiteBlockType, SiteTheme } from '@/types';
import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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
        make: () => ({ heading: 'Your headline', subheading: 'A short supporting line', image_url: '', cta_label: 'Get in touch', cta_link: '#contact', overlay: 35, align: 'center' }),
    },
    {
        type: 'about',
        label: 'About',
        hint: 'Image alongside a block of text',
        make: () => ({ heading: 'About', body: 'Tell visitors who you are and what you do.', image_url: '', image_side: 'left' }),
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
        make: () => ({ heading: 'Gallery', columns: 3, images: [], layout: 'square', lightbox: true }),
    },
    {
        type: 'blog',
        label: 'Blog posts',
        hint: 'A grid of your latest blog posts',
        make: () => ({ heading: 'From the journal', columns: 3, limit: 0 }),
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
        make: () => ({ image_url: '', caption: '' }),
    },
    {
        type: 'contact',
        label: 'Contact form',
        hint: 'Capture enquiries — creates a lead in your CRM',
        make: () => ({ heading: "Let's talk", subheading: '', submit_label: 'Send enquiry', show_phone: true, show_event_date: true, show_event_type: true }),
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
}

// ─── Renderer ───────────────────────────────────────────────────────────────

interface BlockViewProps {
    block: SiteBlock;
    theme: SiteTheme;
    slug: string;
    /** true on the live public site (forms post); false in the builder preview. */
    interactive: boolean;
    /** Published blog posts, injected for `blog` blocks. */
    posts?: BlogPostCard[];
    /** Builder-only editing affordances (click-to-select, chrome, nesting). */
    editing?: BlockEditing;
}

function BlockInner({ block, theme, slug, interactive, posts, editing }: BlockViewProps) {
    // Block data is intentionally loose (modular/extensible), read with fallbacks.
    const d = block.data as Record<string, any>;
    const primary = theme.primary_color;

    switch (block.type) {
        case 'hero': {
            const align = d.align === 'left' ? 'items-start text-left' : 'items-center text-center';
            return (
                <section id="top" className="relative flex min-h-[68vh] flex-col justify-center overflow-hidden px-6 py-24 sm:px-10">
                    {d.image_url ? (
                        <img src={d.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
                    )}
                    <div className="absolute inset-0 bg-black" style={{ opacity: (Number(d.overlay) || 0) / 100 }} />
                    <div className={`relative mx-auto flex max-w-3xl flex-col ${align}`}>
                        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">{d.heading}</h1>
                        {d.subheading && <p className="mt-5 max-w-xl text-lg text-white/80">{d.subheading}</p>}
                        {d.cta_label && (
                            <a href={d.cta_link || '#contact'} className="mt-8 inline-flex rounded-full px-7 py-3 text-sm font-medium text-white shadow-lg transition hover:opacity-90" style={{ backgroundColor: primary }}>
                                {d.cta_label}
                            </a>
                        )}
                    </div>
                </section>
            );
        }

        case 'about': {
            const reverse = d.image_side === 'right';
            return (
                <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
                    <div className={`flex flex-col gap-10 md:items-center ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                        <div className="md:w-1/2">
                            {d.image_url ? (
                                <img src={d.image_url} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" />
                            ) : (
                                <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">Image</div>
                            )}
                        </div>
                        <div className="md:w-1/2">
                            {d.heading && <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                            <p className="mt-4 whitespace-pre-line leading-relaxed text-neutral-600">{d.body}</p>
                        </div>
                    </div>
                </section>
            );
        }

        case 'services': {
            const items: any[] = Array.isArray(d.items) ? d.items : [];
            return (
                <section className="bg-neutral-50 px-6 py-20 sm:px-10">
                    <div className="mx-auto max-w-6xl">
                        {d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((it, i) => (
                                <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-7 shadow-sm">
                                    <h3 className="text-lg font-semibold text-neutral-900">{it.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{it.description}</p>
                                    {it.price && <p className="mt-4 text-sm font-medium" style={{ color: primary }}>{it.price}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            );
        }

        case 'gallery':
            return <GalleryBlock d={d} interactive={interactive} />;

        case 'blog': {
            const limit = Number(d.limit) || 0;
            const all = posts ?? [];
            const list = limit > 0 ? all.slice(0, limit) : all;
            const cols = Number(d.columns) === 2 ? 'sm:grid-cols-2' : Number(d.columns) === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
            const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

            return (
                <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
                    {d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                    {list.length === 0 ? (
                        <p className="text-center text-sm text-neutral-400">No posts published yet.</p>
                    ) : (
                        <div className={`grid grid-cols-1 gap-8 ${cols}`}>
                            {list.map((p) => {
                                const href = p.url ?? `/site/${slug}/blog/${p.slug}`;
                                const inner = (
                                    <>
                                        {p.cover_image ? (
                                            <img src={p.cover_image} alt="" className="aspect-[3/2] w-full rounded-xl object-cover" />
                                        ) : (
                                            <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-300">Cover</div>
                                        )}
                                        {p.published_at && <p className="mt-3 text-xs uppercase tracking-wider text-neutral-400">{fmt(p.published_at)}</p>}
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
                </section>
            );
        }

        case 'text': {
            const align = d.align === 'center' ? 'text-center' : d.align === 'right' ? 'text-right' : 'text-left';
            const heading = (d.heading ?? '').trim();
            const level = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(d.heading_level) ? d.heading_level : 'h2';
            const Heading = level as React.ElementType;
            const headingSize: Record<string, string> = { h1: 'text-4xl sm:text-5xl', h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl', h5: 'text-lg', h6: 'text-base uppercase tracking-wide' };
            return (
                <section className={`mx-auto max-w-3xl px-6 py-16 sm:px-10 ${align}`}>
                    {heading && <Heading className={`font-semibold tracking-tight text-neutral-900 ${headingSize[level]}`}>{heading}</Heading>}
                    {d.body && <p className={`whitespace-pre-line leading-relaxed text-neutral-600 ${heading ? 'mt-4' : ''}`}>{d.body}</p>}
                </section>
            );
        }

        case 'image': {
            return (
                <section className="mx-auto max-w-5xl px-6 py-12 sm:px-10">
                    {d.image_url ? (
                        <img src={d.image_url} alt={d.caption || ''} className="w-full rounded-2xl object-cover" />
                    ) : (
                        <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">Image</div>
                    )}
                    {d.caption && <p className="mt-3 text-center text-sm text-neutral-400">{d.caption}</p>}
                </section>
            );
        }

        case 'grid': {
            const cols = Math.min(Math.max(Number(d.columns) || 2, 1), 4);
            const gap = d.gap === 'sm' ? 'gap-3' : d.gap === 'lg' ? 'gap-10' : 'gap-6';
            const colsClass = cols === 1 ? '' : cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
            const children = block.children ?? [];

            return (
                <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
                    <div className={`grid grid-cols-1 ${colsClass} ${gap}`}>
                        {Array.from({ length: cols }).map((_, col) => (
                            <div key={col} className="min-w-0">
                                {(children[col] ?? []).map((child) => (
                                    <BlockView key={child.id} block={child} theme={theme} slug={slug} interactive={interactive} posts={posts} editing={editing} />
                                ))}
                                {editing && <GridCellAdder onAdd={(type) => editing.onAddChild(block.id, col, type)} />}
                            </div>
                        ))}
                    </div>
                </section>
            );
        }

        case 'contact':
            return <ContactBlock data={d} theme={theme} slug={slug} interactive={interactive} />;

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
        s.background ? 'blk-bg' : '',
        s.text_color ? 'blk-text' : '',
        s.text_size && s.text_size !== 'base' ? `blk-size-${s.text_size}` : '',
        s.padding ? `blk-pad-${s.padding}` : '',
    ].filter(Boolean).join(' ');

    const frameStyle: React.CSSProperties = {};
    if (s.background) frameStyle.backgroundColor = s.background;
    if (s.text_color) frameStyle.color = s.text_color;

    const inner = <BlockInner {...props} />;
    const content = frameClasses || Object.keys(frameStyle).length ? (
        <div className={frameClasses} style={frameStyle}>{inner}</div>
    ) : inner;

    if (!editing) return content;

    const selected = editing.selectedId === block.id;
    return (
        <div
            className={`group/blk relative cursor-pointer ${selected ? 'z-10 ring-2 ring-inset ring-blue-500' : 'ring-1 ring-inset ring-transparent hover:ring-2 hover:ring-blue-300'}`}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); editing.onSelect(block.id); }}
        >
            {content}
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

// ─── Gallery block (layouts + optional lightbox) ──────────────────────────────

function GalleryBlock({ d, interactive }: { d: Record<string, any>; interactive: boolean }) {
    const images: string[] = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
    const cols = Math.min(Math.max(Number(d.columns) || 3, 2), 4);
    const layout = ['square', 'landscape', 'portrait', 'masonry'].includes(d.layout) ? d.layout : 'square';
    const lightbox = d.lightbox !== false;
    const [active, setActive] = useState<number | null>(null);

    const gridCols = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
    const masonryCols = cols === 2 ? 'sm:columns-2' : cols === 4 ? 'sm:columns-3 lg:columns-4' : 'sm:columns-2 lg:columns-3';
    const aspect = layout === 'landscape' ? 'aspect-[4/3]' : layout === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

    // Show placeholder tiles in the builder preview when there are no images yet.
    const tiles = images.length > 0 ? images : interactive ? [] : ['', '', '', '', '', ''];
    const canLightbox = interactive && lightbox && images.length > 0;
    const open = (i: number) => canLightbox && setActive(i);
    const zoom = canLightbox ? 'cursor-zoom-in' : '';

    return (
        <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
            {d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}

            {tiles.length === 0 ? (
                <p className="text-center text-sm text-neutral-400">No images yet.</p>
            ) : layout === 'masonry' ? (
                <div className={`columns-1 gap-3 ${masonryCols} [&>*]:mb-3`}>
                    {tiles.map((src, i) =>
                        src ? (
                            <img key={i} src={src} alt="" onClick={() => open(i)} className={`w-full rounded-lg ${zoom}`} />
                        ) : (
                            <div key={i} className="flex h-40 w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-300">Photo</div>
                        ),
                    )}
                </div>
            ) : (
                <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
                    {tiles.map((src, i) =>
                        src ? (
                            <img key={i} src={src} alt="" onClick={() => open(i)} className={`${aspect} w-full rounded-lg object-cover ${zoom}`} />
                        ) : (
                            <div key={i} className={`${aspect} flex w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-300`}>Photo</div>
                        ),
                    )}
                </div>
            )}

            {active !== null && <Lightbox images={images} index={active} onClose={() => setActive(null)} onIndex={setActive} />}
        </section>
    );
}

function Lightbox({ images, index, onClose, onIndex }: { images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
    const go = (delta: number) => onIndex((index + delta + images.length) % images.length);

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
            <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[92vw] rounded object-contain" />
            {images.length > 1 && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60">{index + 1} / {images.length}</div>}
        </div>,
        document.body,
    );
}

// ─── Contact form (the lead capture) ──────────────────────────────────────────

function ContactBlock({ data: d, theme, slug, interactive }: { data: Record<string, any>; theme: SiteTheme; slug: string; interactive: boolean }) {
    return (
        <section id="contact" className="bg-neutral-50 px-6 py-20 sm:px-10">
            <div className="mx-auto max-w-xl">
                {d.heading && <h2 className="text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                {d.subheading && <p className="mt-3 text-center text-neutral-600">{d.subheading}</p>}
                <div className="mt-10">
                    {interactive ? (
                        <ContactFormLive data={d} theme={theme} slug={slug} />
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

function ContactFormLive({ data: d, theme, slug }: { data: Record<string, any>; theme: SiteTheme; slug: string }) {
    const form = useForm({ name: '', email: '', phone: '', event_date: '', event_type: '', message: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('sites.public.lead', slug), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
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
            <div className="w-full rounded-full px-6 py-3 text-center text-sm font-medium text-white" style={{ backgroundColor: theme.primary_color }}>
                {d.submit_label || 'Send enquiry'}
            </div>
        </div>
    );
}
