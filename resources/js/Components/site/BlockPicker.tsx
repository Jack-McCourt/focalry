import { SiteBlock, SiteBlockType } from '@/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BLOCK_LIBRARY, POST_ONLY_BLOCK_TYPES, SECTION_PRESETS, SectionPreset } from './blocks';

interface SavedSection { id: string; name: string; block: SiteBlock }

/**
 * A searchable "Add block" popup. Shows every block as a card with a small
 * visual mock of what it produces, plus the studio's saved reusable sections.
 */
export default function BlockPicker({
    open,
    onClose,
    onAdd,
    onInsertPreset,
    savedSections = [],
    onInsertSection,
    onDeleteSection,
    isPost = false,
}: {
    open: boolean;
    onClose: () => void;
    onAdd: (type: SiteBlockType) => void;
    /** Insert a pre-designed section (one or more styled blocks). */
    onInsertPreset?: (preset: SectionPreset) => void;
    savedSections?: SavedSection[];
    onInsertSection?: (id: string) => void;
    onDeleteSection?: (id: string) => void;
    /** The page being edited is a blog post — enables post-only blocks. */
    isPost?: boolean;
}) {
    const [q, setQ] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQ('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const blocks = useMemo(() => {
        const term = q.trim().toLowerCase();
        // Post-only blocks (e.g. the post header) appear on blog posts only.
        const available = isPost ? BLOCK_LIBRARY : BLOCK_LIBRARY.filter((b) => !POST_ONLY_BLOCK_TYPES.includes(b.type));
        if (!term) return available;
        return available.filter((b) => b.label.toLowerCase().includes(term) || b.hint.toLowerCase().includes(term));
    }, [q, isPost]);

    const sections = useMemo(() => {
        const term = q.trim().toLowerCase();
        return term ? savedSections.filter((s) => s.name.toLowerCase().includes(term)) : savedSections;
    }, [q, savedSections]);

    const presets = useMemo(() => {
        const term = q.trim().toLowerCase();
        return term ? SECTION_PRESETS.filter((p) => p.name.toLowerCase().includes(term) || p.hint.toLowerCase().includes(term)) : SECTION_PRESETS;
    }, [q]);

    if (!open) return null;

    const pick = (type: SiteBlockType) => { onAdd(type); onClose(); };

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="mt-[6vh] flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 px-5 py-3">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search blocks…"
                        className="flex-1 border-0 p-0 text-sm focus:outline-none focus:ring-0"
                    />
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="overflow-y-auto p-4">
                    {sections.length > 0 && (
                        <div className="mb-5">
                            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Saved sections</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {sections.map((s) => (
                                    <div key={s.id} className="group relative">
                                        <button
                                            onClick={() => { onInsertSection?.(s.id); onClose(); }}
                                            className="flex w-full flex-col overflow-hidden rounded-xl border border-neutral-200 text-left transition hover:border-neutral-900 hover:shadow-sm"
                                        >
                                            <div className="flex h-24 items-center justify-center bg-neutral-50">
                                                <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-500 shadow-sm ring-1 ring-neutral-200">Saved section</span>
                                            </div>
                                            <span className="truncate px-3 py-2 text-sm font-medium text-neutral-800">{s.name}</span>
                                        </button>
                                        {onDeleteSection && (
                                            <button onClick={() => onDeleteSection(s.id)} className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-neutral-400 opacity-0 shadow ring-1 ring-neutral-200 transition hover:text-red-600 group-hover:opacity-100" title="Delete saved section">
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {onInsertPreset && presets.length > 0 && (
                        <div className="mb-5">
                            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Pre-designed sections</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {presets.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { onInsertPreset(p); onClose(); }}
                                        className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 text-left transition hover:border-neutral-900 hover:shadow-sm"
                                    >
                                        <div className="flex h-24 items-center justify-center border-b border-neutral-100 bg-gradient-to-br from-neutral-50 to-neutral-100">
                                            <span className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-neutral-500 shadow-sm ring-1 ring-neutral-200">{p.build().length > 1 ? `${p.build().length} blocks` : 'Styled section'}</span>
                                        </div>
                                        <div className="px-3 py-2">
                                            <span className="block text-sm font-medium text-neutral-800">{p.name}</span>
                                            <span className="mt-0.5 block text-xs leading-snug text-neutral-400">{p.hint}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p className="mb-2 mt-5 px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Blocks</p>
                        </div>
                    )}

                    {blocks.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {blocks.map((b) => (
                                <button
                                    key={b.type}
                                    onClick={() => pick(b.type)}
                                    className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 text-left transition hover:border-neutral-900 hover:shadow-sm"
                                >
                                    <div className="h-24 border-b border-neutral-100 bg-neutral-50 p-3">
                                        <BlockThumb type={b.type} />
                                    </div>
                                    <div className="px-3 py-2">
                                        <span className="block text-sm font-medium text-neutral-800">{b.label}</span>
                                        <span className="mt-0.5 block text-xs leading-snug text-neutral-400">{b.hint}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="py-12 text-center text-sm text-neutral-400">No blocks match “{q}”.</p>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

// ─── Tiny visual mocks of each block type ─────────────────────────────────────

const bar = (w: string, h = 'h-1.5') => <span className={`block ${h} ${w} rounded-full bg-neutral-300`} />;
const box = 'rounded bg-neutral-200';

function Frame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-white ring-1 ring-neutral-200 ${className}`}>{children}</div>;
}

function BlockThumb({ type }: { type: SiteBlockType }) {
    switch (type) {
        case 'hero':
            return <Frame className="items-center justify-center gap-1.5 bg-neutral-700 ring-neutral-700"><span className="h-2 w-20 rounded-full bg-white/90" /><span className="h-1.5 w-14 rounded-full bg-white/50" /><span className="mt-1 h-3 w-12 rounded-full bg-white/80" /></Frame>;
        case 'post_header':
            return <Frame className="flex-col p-0"><span className="flex flex-1 flex-col items-center justify-center gap-1 bg-neutral-700"><span className="h-2 w-20 rounded-full bg-white/90" /><span className="h-1 w-12 rounded-full bg-white/50" /></span><span className="flex items-center justify-center gap-1 py-1.5"><span className="h-1 w-6 rounded-full bg-neutral-300" /><span className="h-1 w-1 rounded-full bg-neutral-300" /><span className="h-1 w-8 rounded-full bg-neutral-300" /></span></Frame>;
        case 'slider':
            return <Frame className="relative items-center justify-center gap-1.5 bg-neutral-700 ring-neutral-700"><span className="h-2 w-16 rounded-full bg-white/90" /><span className="h-1.5 w-12 rounded-full bg-white/50" /><span className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white/40" /><span className="absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white/40" /><span className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1"><span className="h-1 w-1 rounded-full bg-white/90" /><span className="h-1 w-1 rounded-full bg-white/50" /><span className="h-1 w-1 rounded-full bg-white/50" /></span></Frame>;
        case 'about':
            return <Frame className="flex-row items-center gap-2 p-2"><span className={`h-full w-1/2 ${box}`} /><span className="flex w-1/2 flex-col gap-1">{bar('w-full')}{bar('w-5/6')}{bar('w-2/3')}</span></Frame>;
        case 'services':
            return <Frame className="flex-row items-stretch gap-1.5 p-2">{[0, 1, 2].map((i) => <span key={i} className={`flex-1 ${box}`} />)}</Frame>;
        case 'gallery':
            return <Frame className="p-2"><span className="grid h-full grid-cols-3 gap-1">{Array.from({ length: 6 }).map((_, i) => <span key={i} className={box} />)}</span></Frame>;
        case 'card':
            return <Frame className="p-2"><span className={`h-1/2 w-full ${box}`} /><span className="mt-1.5 flex flex-col gap-1"><span className="h-2 w-10 rounded-full bg-neutral-400" />{bar('w-full', 'h-1')}{bar('w-5/6', 'h-1')}</span></Frame>;
        case 'blog':
            return <Frame className="flex-row gap-1.5 p-2">{[0, 1, 2].map((i) => <span key={i} className="flex flex-1 flex-col gap-1"><span className={`h-8 ${box}`} />{bar('w-full', 'h-1')}</span>)}</Frame>;
        case 'packages':
        case 'pricing':
            return <Frame className="flex-row items-stretch gap-1.5 p-2">{[0, 1, 2].map((i) => <span key={i} className="flex flex-1 flex-col items-center justify-center gap-1 rounded bg-neutral-100 py-1"><span className="h-2 w-2 rounded-full bg-neutral-300" />{bar('w-2/3', 'h-1')}<span className="mt-1 h-2.5 w-5 rounded-full bg-neutral-300" /></span>)}</Frame>;
        case 'reviews':
        case 'testimonials':
            return <Frame className="items-center justify-center gap-1 p-2"><span className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rotate-45 bg-amber-400" />)}</span>{bar('w-3/4', 'h-1')}{bar('w-2/3', 'h-1')}{bar('w-16')}</Frame>;
        case 'text':
            return <Frame className="justify-center gap-1.5 p-3"><span className="h-2 w-16 rounded-full bg-neutral-400" />{bar('w-full', 'h-1')}{bar('w-5/6', 'h-1')}{bar('w-3/4', 'h-1')}</Frame>;
        case 'image':
            return <Frame className="p-2"><span className={`h-full w-full ${box}`} /></Frame>;
        case 'video':
            return <Frame className="items-center justify-center bg-neutral-700 ring-neutral-700"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90"><span className="ml-0.5 h-0 w-0 border-y-4 border-l-[7px] border-y-transparent border-l-neutral-700" /></span></Frame>;
        case 'button':
            return <Frame className="items-center justify-center"><span className="h-4 w-16 rounded-full bg-neutral-800" /></Frame>;
        case 'cta':
            return <Frame className="items-center justify-center gap-1.5 bg-neutral-800 ring-neutral-800"><span className="h-2 w-20 rounded-full bg-white/90" /><span className="h-3 w-12 rounded-full bg-white" /></Frame>;
        case 'faq':
            return <Frame className="justify-center gap-1.5 p-2">{[0, 1, 2].map((i) => <span key={i} className="flex items-center justify-between"><span className={`h-1.5 w-2/3 rounded-full bg-neutral-300`} /><span className="text-[10px] leading-none text-neutral-400">＋</span></span>)}</Frame>;
        case 'logos':
            return <Frame className="flex-row items-center justify-center gap-2 p-2">{[0, 1, 2, 3].map((i) => <span key={i} className="h-3 w-8 rounded bg-neutral-200" />)}</Frame>;
        case 'map':
            return <Frame className="items-center justify-center bg-neutral-100"><svg className="h-7 w-7 text-neutral-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" /></svg></Frame>;
        case 'embed':
            return <Frame className="items-center justify-center bg-neutral-100"><span className="font-mono text-sm text-neutral-400">{'</>'}</span></Frame>;
        case 'divider':
            return <Frame className="items-center justify-center p-3"><span className="h-px w-full bg-neutral-300" /></Frame>;
        case 'grid':
            return <Frame className="flex-row gap-1.5 p-2"><span className="flex-1 rounded border border-dashed border-neutral-300" /><span className="flex-1 rounded border border-dashed border-neutral-300" /></Frame>;
        case 'instagram':
            return <Frame className="p-2"><span className="grid h-full grid-cols-4 gap-1">{Array.from({ length: 8 }).map((_, i) => <span key={i} className={box} />)}</span></Frame>;

        case 'beforeafter':
            return <Frame className="relative p-0"><span className="absolute inset-y-0 left-0 w-1/2 bg-neutral-300" /><span className="absolute inset-y-0 right-0 w-1/2 bg-neutral-100" /><span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow" /><span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-neutral-200" /></Frame>;
        case 'countdown':
            return <Frame className="flex-row items-center justify-center gap-1.5 p-3">{['12', '08', '45'].map((n, i) => <span key={i} className="rounded bg-neutral-100 px-1.5 py-1 text-[10px] font-bold text-neutral-600 ring-1 ring-neutral-200">{n}</span>)}</Frame>;

        case 'booking':
            return <Frame className="flex-row gap-1.5 p-2"><span className="flex w-1/3 flex-col gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-3 rounded bg-neutral-100 ring-1 ring-neutral-200" />)}</span><span className="grid flex-1 grid-cols-4 gap-0.5">{Array.from({ length: 12 }).map((_, i) => <span key={i} className={`rounded-sm ${i === 5 ? 'bg-neutral-700' : 'bg-neutral-100'}`} />)}</span></Frame>;

        case 'newsletter':
            return <Frame className="items-center justify-center gap-1.5 p-3"><span className="h-2 w-16 rounded-full bg-neutral-400" /><span className="flex w-full gap-1"><span className="h-3 flex-1 rounded-full bg-neutral-100 ring-1 ring-neutral-200" /><span className="h-3 w-8 rounded-full bg-neutral-700" /></span></Frame>;

        case 'contact':
            return <Frame className="justify-center gap-1.5 p-2"><span className={`h-3 w-full ${box}`} /><span className={`h-3 w-full ${box}`} /><span className="mt-0.5 h-3 w-14 rounded-full bg-neutral-800" /></Frame>;
        default:
            return <Frame className="items-center justify-center"><span className="h-6 w-6 rounded bg-neutral-200" /></Frame>;
    }
}
