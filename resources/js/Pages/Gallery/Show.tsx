import { GallerySet, PageProps } from '@/types';
import GalleryStore, { GalleryStoreHandle, StoreData } from '@/Components/gallery/GalleryStore';
import Lightbox from '@/Components/gallery/Lightbox';
import { CoverHero } from '@/lib/coverStyle';
import { galleryThemeVars } from '@/lib/galleryTheme';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Check, Download, Heart, ShoppingBag } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface PublicPhoto {
    id: number;
    filename: string;
    width: number | null;
    height: number | null;
    set_id: number | null;
    thumb_url: string | null;
    grid_url: string | null;
    web_url: string | null;
}

interface PublicCollection {
    id: number;
    title: string;
    slug: string;
    event_date: string | null;
    cover_style: Record<string, unknown> | null;
    theme: string;
    cover_url: string | null;
    cover_srcset: string | null;
}

interface VisitorList {
    id: number;
    name: string;
    photo_ids: number[];
    notes: Record<number, string>;
}

interface DownloadSettings {
    enabled: boolean;
    require_pin: boolean;
    pin_verified: boolean;
}

interface GalleryShowProps extends Record<string, unknown> {
    collection: PublicCollection;
    photos: PublicPhoto[];
    sets: GallerySet[];
    visitor_token: string | null;
    visitor: { name: string | null; email: string | null } | null;
    favourite_lists: VisitorList[];
    favourites_enabled: boolean;
    favourites_show_notes: boolean;
    downloads: DownloadSettings;
    store: StoreData | null;
}

function getCsrfToken(): string {
    return (
        document.cookie
            .split('; ')
            .find((r) => r.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] ?? ''
    );
}

const authHeaders = { headers: { 'X-XSRF-TOKEN': getCsrfToken() } };

function HeartIcon({ filled }: { filled: boolean }) {
    return filled ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
    ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 pb-4 text-xs uppercase tracking-[0.18em] transition-colors ${
                active
                    ? 'border-[var(--g-text)] text-[var(--g-text)]'
                    : 'border-transparent text-[var(--g-faint)] hover:text-[var(--g-muted)]'
            }`}
        >
            {children}
        </button>
    );
}

// ─── Name capture modal ───────────────────────────────────────────────────────

function NameModal({
    open,
    onClose,
    onSave,
    title = 'Save your favourites',
    subtitle = 'Enter your email so you can find your favourites again any time — even on another device.',
}: {
    open: boolean;
    onClose: () => void;
    onSave: (name: string, email: string) => Promise<void>;
    title?: string;
    subtitle?: string;
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

    const submit = async () => {
        if (!validEmail) return;
        setSaving(true);
        try {
            await onSave(name.trim(), email.trim());
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-lg p-7"
                style={{ background: 'var(--g-panel)', color: 'var(--g-text)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-light tracking-wide">{title}</h2>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--g-muted)' }}>
                    {subtitle}
                </p>

                <div className="mt-5 space-y-3">
                    <input
                        autoFocus
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        placeholder="Email address"
                        className="w-full border-b bg-transparent py-2 text-sm outline-none placeholder:text-neutral-600"
                        style={{ borderColor: 'var(--g-border)' }}
                    />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        placeholder="Your name (optional)"
                        className="w-full border-b bg-transparent py-2 text-sm outline-none placeholder:text-neutral-600"
                        style={{ borderColor: 'var(--g-border)' }}
                    />
                </div>

                <button
                    onClick={submit}
                    disabled={!validEmail || saving}
                    className="mt-6 w-full rounded-full bg-[var(--g-text)] py-2.5 text-xs font-medium uppercase tracking-widest text-[var(--g-bg)] transition hover:opacity-90 disabled:opacity-40"
                >
                    {saving ? 'Saving…' : 'Continue'}
                </button>
            </div>
        </div>
    );
}

// ─── Download PIN modal ───────────────────────────────────────────────────────

function PinModal({
    open,
    onClose,
    onVerify,
}: {
    open: boolean;
    onClose: () => void;
    onVerify: (pin: string) => Promise<boolean>;
}) {
    const [pin, setPin] = useState('');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(false);

    if (!open) return null;

    const submit = async () => {
        if (!pin.trim()) return;
        setChecking(true);
        setError(false);
        try {
            const ok = await onVerify(pin.trim());
            if (!ok) setError(true);
        } finally {
            setChecking(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-xs rounded-lg p-7 text-center"
                style={{ background: 'var(--g-panel)', color: 'var(--g-text)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-light tracking-wide">Enter download PIN</h2>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--g-muted)' }}>
                    The photographer protected downloads with a PIN.
                </p>

                <input
                    autoFocus
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(false); }}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="••••"
                    className="mt-5 w-full border-b bg-transparent py-2 text-center font-mono text-lg tracking-[0.4em] outline-none placeholder:text-neutral-700"
                    style={{ borderColor: error ? '#ef4444' : 'var(--g-border)' }}
                />
                {error && <p className="mt-2 text-xs text-red-400">Incorrect PIN. Try again.</p>}

                <button
                    onClick={submit}
                    disabled={!pin.trim() || checking}
                    className="mt-6 w-full rounded-full bg-[var(--g-text)] py-2.5 text-xs font-medium uppercase tracking-widest text-[var(--g-bg)] transition hover:opacity-90 disabled:opacity-40"
                >
                    {checking ? 'Checking…' : 'Unlock downloads'}
                </button>
            </div>
        </div>
    );
}

// ─── Favourite note modal ─────────────────────────────────────────────────────

function NoteModal({
    photo,
    initialNote,
    onClose,
    onSave,
}: {
    photo: PublicPhoto | null;
    initialNote: string;
    onClose: () => void;
    onSave: (note: string) => Promise<void>;
}) {
    const [note, setNote] = useState(initialNote);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setNote(initialNote);
    }, [initialNote, photo]);

    if (!photo) return null;

    const submit = async () => {
        setSaving(true);
        try {
            await onSave(note.trim());
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-lg p-6"
                style={{ background: 'var(--g-panel)', color: 'var(--g-text)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex gap-4">
                    {photo.thumb_url && (
                        <img
                            src={photo.thumb_url}
                            alt={photo.filename}
                            className="h-20 w-20 shrink-0 rounded object-cover"
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-medium tracking-wide">Add a note</h2>
                        <p className="truncate text-xs" style={{ color: 'var(--g-muted)' }}>
                            {photo.filename}
                        </p>
                    </div>
                </div>

                <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="e.g. Please retouch the background, love this one for the album…"
                    className="mt-4 w-full resize-none rounded-md border bg-transparent p-3 text-sm outline-none placeholder:text-neutral-600"
                    style={{ borderColor: 'var(--g-border)' }}
                />

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-full px-4 py-2 text-xs uppercase tracking-widest transition hover:bg-white/5"
                        style={{ color: 'var(--g-muted)' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="rounded-full bg-[var(--g-text)] px-5 py-2 text-xs font-medium uppercase tracking-widest text-[var(--g-bg)] transition hover:opacity-90 disabled:opacity-40"
                    >
                        {saving ? 'Saving…' : 'Save note'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── List selector bar ────────────────────────────────────────────────────────

function ListSelector({
    lists,
    activeListId,
    onSelect,
    onCreate,
    favouriteCount,
    canDownload,
    identified,
    onIdentify,
    onViewFavourites,
    onDownloadAll,
}: {
    lists: VisitorList[];
    activeListId: number | null;
    onSelect: (id: number) => void;
    onCreate: (name: string) => Promise<void>;
    favouriteCount: number;
    canDownload: boolean;
    identified: boolean;
    onIdentify: () => void;
    onViewFavourites: () => void;
    onDownloadAll: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setCreating(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const active = lists.find((l) => l.id === activeListId);

    const create = async () => {
        if (!newName.trim()) return;
        await onCreate(newName.trim());
        setNewName('');
        setCreating(false);
        setOpen(false);
    };

    return (
        <div className="relative inline-block" ref={ref}>
            <button
                onClick={() => (identified ? setOpen((v) => !v) : onIdentify())}
                className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs tracking-widest uppercase transition hover:border-neutral-500"
                style={{ borderColor: 'var(--g-border)', color: 'var(--g-text)' }}
            >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="var(--g-accent)">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                {active ? active.name : 'My Favourites'}
                <span style={{ color: 'var(--g-faint)' }}>{active ? `(${active.photo_ids.length})` : ''}</span>
                <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div
                    className="absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-lg border py-1.5 text-left shadow-xl"
                    style={{ background: 'var(--g-panel)', borderColor: 'var(--g-border)' }}
                >
                    {favouriteCount > 0 && (
                        <>
                            <button
                                onClick={() => { onViewFavourites(); setOpen(false); }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-xs transition hover:bg-white/5"
                                style={{ color: 'var(--g-text)' }}
                            >
                                <svg className="h-3.5 w-3.5 text-rose-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0z" /></svg>
                                View favourites tab
                            </button>
                            {canDownload && (
                                <button
                                    onClick={() => { onDownloadAll(); setOpen(false); }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-xs transition hover:bg-white/5"
                                    style={{ color: 'var(--g-text)' }}
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Download all favourites
                                </button>
                            )}
                            <div className="my-1 border-t" style={{ borderColor: 'var(--g-border)' }} />
                        </>
                    )}
                    {lists.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => { onSelect(l.id); setOpen(false); }}
                            className="flex w-full items-center justify-between px-4 py-2 text-xs transition hover:bg-white/5"
                            style={{ color: l.id === activeListId ? 'var(--g-text)' : 'var(--g-muted)' }}
                        >
                            <span className="flex items-center gap-2">
                                {l.id === activeListId && (
                                    <svg className="h-3 w-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                <span className={l.id === activeListId ? '' : 'pl-5'}>{l.name}</span>
                            </span>
                            <span style={{ color: 'var(--g-faint)' }}>{l.photo_ids.length}</span>
                        </button>
                    ))}

                    <div className="my-1 border-t" style={{ borderColor: 'var(--g-border)' }} />

                    {creating ? (
                        <div className="flex items-center gap-1 px-3 py-1.5">
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') create();
                                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                                }}
                                placeholder="List name"
                                className="w-full border-b bg-transparent py-1 text-xs outline-none placeholder:text-neutral-600"
                                style={{ borderColor: 'var(--g-border)', color: 'var(--g-text)' }}
                            />
                            <button onClick={create} className="text-xs text-rose-300 hover:text-rose-200">Add</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setCreating(true)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-xs transition hover:bg-white/5"
                            style={{ color: 'var(--g-muted)' }}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            New list
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Photo ────────────────────────────────────────────────────────────────────

// Memoized so that gallery-wide state changes (selecting a photo, opening the
// lightbox, toggling a favourite) only re-render the tiles that actually
// changed — critical for collections with hundreds/thousands of photos. All
// callback props are stable (useCallback / state setters), and `index` lets
// onOpen avoid a per-tile closure.
const GalleryPhoto = memo(function GalleryPhoto({
    photo,
    index,
    spanRows,
    isFavourited,
    showHeart,
    showDownload,
    showNote,
    hasNote,
    showBuy,
    selected,
    selectionActive,
    onToggle,
    onDownload,
    onNote,
    onOpen,
    onBuy,
    onSelect,
}: {
    photo: PublicPhoto;
    index: number;
    spanRows?: number;
    isFavourited: boolean;
    showHeart: boolean;
    showDownload: boolean;
    showNote: boolean;
    hasNote: boolean;
    showBuy: boolean;
    selected: boolean;
    selectionActive: boolean;
    onToggle: (photoId: number) => void;
    onDownload: (photoId: number) => void;
    onNote: (photoId: number) => void;
    onOpen: (index: number) => void;
    onBuy: (photoId: number) => void;
    onSelect: (photoId: number) => void;
}) {
    const [loaded, setLoaded] = useState(false);

    return (
        <div
            className={`group relative cursor-zoom-in overflow-hidden rounded-sm ${selected ? 'ring-2 ring-offset-2 ring-offset-[var(--g-bg)] ring-[var(--g-text)]' : ''}`}
            style={spanRows ? { gridRowEnd: `span ${spanRows}` } : undefined}
            onClick={() => onOpen(index)}
        >
            {/* Multi-select checkbox */}
            <button
                onClick={(e) => { e.stopPropagation(); onSelect(photo.id); }}
                className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-200
                    ${selected
                        ? 'border-white bg-white text-neutral-900 opacity-100'
                        : `border-white/60 bg-black/20 text-transparent hover:bg-black/40 ${selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
                    }`}
                title={selected ? 'Deselect' : 'Select'}
            >
                <Check className="h-4 w-4" strokeWidth={3} />
            </button>
            {photo.thumb_url ? (
                <img
                    src={photo.thumb_url ?? photo.grid_url ?? undefined}
                    srcSet={[photo.thumb_url ? `${photo.thumb_url} 300w` : '', photo.grid_url ? `${photo.grid_url} 600w` : ''].filter(Boolean).join(', ') || undefined}
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                    alt={photo.filename}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    className={`w-full transition-opacity duration-500 ${spanRows ? 'h-full object-cover' : ''} ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    style={!spanRows && photo.width && photo.height ? { aspectRatio: `${photo.width}/${photo.height}` } : undefined}
                    draggable={false}
                />
            ) : (
                <div className={`w-full bg-neutral-800 ${spanRows ? 'h-full' : ''}`} style={spanRows ? undefined : { aspectRatio: '3/2' }} />
            )}

            {showBuy && (
                <button
                    onClick={(e) => { e.stopPropagation(); onBuy(photo.id); }}
                    className="absolute right-2 top-2 rounded-full bg-black/20 p-1.5 text-white/70 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-black/40 hover:text-white group-hover:opacity-100"
                    title="Buy prints"
                >
                    <ShoppingBag className="h-5 w-5" />
                </button>
            )}

            {showDownload && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownload(photo.id);
                    }}
                    className="absolute bottom-2 left-2 rounded-full bg-black/20 p-1.5 text-white/70 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-black/40 hover:text-white group-hover:opacity-100"
                    title="Download photo"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                </button>
            )}

            {/* Note button — only on favourited photos when notes are enabled */}
            {showNote && isFavourited && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onNote(photo.id);
                    }}
                    className={`absolute bottom-2 right-12 rounded-full p-1.5 backdrop-blur-sm transition-all duration-200
                        ${hasNote
                            ? 'text-amber-300 bg-black/40 opacity-100'
                            : 'text-white/70 bg-black/20 opacity-0 hover:text-white hover:bg-black/40 group-hover:opacity-100'
                        }`}
                    title={hasNote ? 'Edit note' : 'Add a note'}
                >
                    <svg className="h-5 w-5" fill={hasNote ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                </button>
            )}

            {showHeart && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(photo.id);
                    }}
                    className={`absolute bottom-2 right-2 rounded-full p-1.5 backdrop-blur-sm transition-all duration-200
                        ${isFavourited
                            ? 'text-rose-400 bg-black/40 opacity-100'
                            : 'text-white/70 bg-black/20 opacity-0 hover:text-rose-300 hover:bg-black/40 group-hover:opacity-100'
                        }`}
                    title={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
                >
                    <HeartIcon filled={isFavourited} />
                </button>
            )}
        </div>
    );
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GalleryShow({
    collection,
    photos,
    sets,
    visitor_token,
    visitor,
    favourite_lists,
    favourites_enabled,
    favourites_show_notes,
    downloads,
    store,
}: PageProps<GalleryShowProps>) {
    const [activeSet, setActiveSet] = useState<number | null>(sets[0]?.id ?? null);
    const [visitorName, setVisitorName] = useState<string | null>(visitor?.name ?? null);
    const [lists, setLists] = useState<VisitorList[]>(favourite_lists);
    const [activeListId, setActiveListId] = useState<number | null>(favourite_lists[0]?.id ?? null);
    const [nameModalOpen, setNameModalOpen] = useState(false);
    const [pendingPhotoId, setPendingPhotoId] = useState<number | null>(null);

    const [pinVerified, setPinVerified] = useState(downloads.pin_verified);
    const [pinModalOpen, setPinModalOpen] = useState(false);
    // What to download once the PIN is satisfied: 'all' or a photo id.
    const [pendingDownload, setPendingDownload] = useState<'all' | number | number[] | null>(null);

    // Photo whose note is being edited
    const [notePhotoId, setNotePhotoId] = useState<number | null>(null);

    // Lightbox (index into the currently visible photos) + store handle
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const storeRef = useRef<GalleryStoreHandle>(null);

    // Favourites tab + multi-select
    const [showingFavourites, setShowingFavourites] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    // Identified = the visitor has given their email (the identifier used to find
    // their favourites later). A session without an email still needs to provide one.
    const [identified, setIdentified] = useState(!!visitor?.email);
    const canFavourite = favourites_enabled && identified;
    const canDownload = downloads.enabled;
    const storeEnabled = !!store?.enabled;
    const slug = collection.slug;

    const toggleSelect = useCallback((id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const triggerDownload = useCallback(
        (target: 'all' | number | number[]) => {
            const url =
                target === 'all'
                    ? `/g/${slug}/download`
                    : Array.isArray(target)
                    ? `/g/${slug}/download-selection?ids=${target.join(',')}`
                    : `/g/${slug}/download/${target}`;
            window.location.href = url;
        },
        [slug],
    );

    const requestDownload = useCallback(
        (target: 'all' | number | number[]) => {
            if (Array.isArray(target) && target.length === 0) return;
            if (downloads.require_pin && !pinVerified) {
                setPendingDownload(target);
                setPinModalOpen(true);
                return;
            }
            triggerDownload(target);
        },
        [downloads.require_pin, pinVerified, triggerDownload],
    );

    const verifyPin = useCallback(
        async (pin: string): Promise<boolean> => {
            try {
                await axios.post(`/g/${slug}/download/verify-pin`, { pin }, authHeaders);
            } catch {
                return false;
            }
            setPinVerified(true);
            setPinModalOpen(false);
            if (pendingDownload !== null) {
                triggerDownload(pendingDownload);
                setPendingDownload(null);
            }
            return true;
        },
        [slug, pendingDownload, triggerDownload],
    );

    const activeList = lists.find((l) => l.id === activeListId) ?? null;
    const favouritedSet = new Set(activeList?.photo_ids ?? []);
    const activeNotes = activeList?.notes ?? {};

    const doToggle = useCallback(
        (photoId: number) => {
            axios
                .post(`/g/${slug}/favourites/${photoId}`, { list_id: activeListId ?? undefined }, authHeaders)
                .then((res) => {
                    const { favourited, list } = res.data as {
                        favourited: boolean;
                        list: { id: number; name: string };
                    };
                    setLists((prev) => {
                        const found = prev.find((l) => l.id === list.id);
                        if (!found) {
                            return [
                                ...prev,
                                {
                                    id: list.id,
                                    name: list.name,
                                    photo_ids: favourited ? [photoId] : [],
                                    notes: {},
                                },
                            ];
                        }
                        return prev.map((l) => {
                            if (l.id !== list.id) return l;
                            const notes = { ...l.notes };
                            if (!favourited) delete notes[photoId];
                            return {
                                ...l,
                                photo_ids: favourited
                                    ? [...l.photo_ids, photoId]
                                    : l.photo_ids.filter((id) => id !== photoId),
                                notes,
                            };
                        });
                    });
                    setActiveListId((cur) => cur ?? list.id);
                })
                .catch((err) => {
                    if (err.response?.status === 422) {
                        alert(err.response.data.error ?? 'Selection limit reached.');
                    }
                });
        },
        [slug, activeListId],
    );

    const saveNote = useCallback(
        async (note: string) => {
            if (notePhotoId === null || activeListId === null) return;
            await axios.post(
                `/g/${slug}/favourites/${notePhotoId}/note`,
                { list_id: activeListId, note },
                authHeaders,
            );
            const photoId = notePhotoId;
            setLists((prev) =>
                prev.map((l) => {
                    if (l.id !== activeListId) return l;
                    const notes = { ...l.notes };
                    if (note) notes[photoId] = note;
                    else delete notes[photoId];
                    return { ...l, notes };
                }),
            );
            setNotePhotoId(null);
        },
        [slug, notePhotoId, activeListId],
    );

    const handleHeart = useCallback(
        (photoId: number) => {
            if (!identified) {
                setPendingPhotoId(photoId);
                setNameModalOpen(true);
                return;
            }
            doToggle(photoId);
        },
        [identified, doToggle],
    );

    const saveName = useCallback(
        async (name: string, email: string) => {
            const res = await axios.post(`/g/${slug}/visitor`, { name, email }, authHeaders);
            setVisitorName(res.data.visitor.name);
            setIdentified(true);
            // Retrieve any favourites already saved under this email.
            if (Array.isArray(res.data.lists)) {
                setLists(res.data.lists as VisitorList[]);
                setActiveListId((cur) => cur ?? res.data.lists[0]?.id ?? null);
            }
            setNameModalOpen(false);
            if (pendingPhotoId !== null) {
                doToggle(pendingPhotoId);
                setPendingPhotoId(null);
            }
        },
        [slug, pendingPhotoId, doToggle],
    );

    const createList = useCallback(
        async (name: string) => {
            const res = await axios.post(`/g/${slug}/lists`, { name }, authHeaders);
            const list = res.data.list as VisitorList;
            setLists((prev) => [...prev, list]);
            setActiveListId(list.id);
        },
        [slug],
    );

    // Photos in the active visitor list, for the Favourites tab.
    const favouritePhotos = photos.filter((p) => favouritedSet.has(p.id));
    const onFavView = showingFavourites && favouritePhotos.length > 0;

    // Photos always live in a set — render only the active set so large galleries
    // never paint every image at once. The Favourites tab cuts across all sets.
    const visiblePhotos = onFavView
        ? favouritePhotos
        : sets.length === 0
        ? photos
        : activeSet !== null
        ? photos.filter((p) => p.set_id === activeSet)
        : [];
    const totalFavourites = lists.reduce((sum, l) => sum + l.photo_ids.length, 0);

    // ─── Ordered (row-major) masonry ──────────────────────────────────────────
    // CSS `columns` fills each column top-to-bottom, so photos read vertically.
    // A CSS grid with per-tile row spans flows left-to-right, top-to-bottom so the
    // gallery reads in order while keeping the ragged masonry heights.
    const GRID_GAP = 6;
    const GRID_ROW = 8;
    const gridRef = useRef<HTMLDivElement>(null);
    const [gridWidth, setGridWidth] = useState(0);
    useLayoutEffect(() => {
        const el = gridRef.current;
        if (!el) return;
        const measure = () => setGridWidth(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [activeSet, onFavView]);
    const gridCols = gridWidth >= 1024 ? 5 : gridWidth >= 768 ? 4 : gridWidth >= 640 ? 3 : 2;
    const colWidth = gridWidth > 0 ? (gridWidth - (gridCols - 1) * GRID_GAP) / gridCols : 0;
    const spanFor = (photo: PublicPhoto) => {
        const ratio = photo.width && photo.height ? photo.width / photo.height : 3 / 2;
        const h = colWidth > 0 ? colWidth / ratio : 200;
        return Math.max(1, Math.round((h + GRID_GAP) / (GRID_ROW + GRID_GAP)));
    };
    // Stable so memoized tiles don't re-render every time the page does.
    const handleBuy = useCallback((photoId: number) => storeRef.current?.shopFor(photoId), []);
    const showFavTab = canFavourite && favouritePhotos.length > 0;

    return (
        <>
            <Head title={collection.title} />

            {store?.enabled && <GalleryStore ref={storeRef} slug={collection.slug} store={store} photos={photos} />}

            {lightboxIndex !== null && visiblePhotos[lightboxIndex] && (
                <Lightbox
                    photos={visiblePhotos}
                    index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onIndex={setLightboxIndex}
                    canFavourite={canFavourite}
                    isFavourited={favouritedSet.has(visiblePhotos[lightboxIndex].id)}
                    onToggleFavourite={handleHeart}
                    canDownload={canDownload}
                    onDownload={requestDownload}
                    storeEnabled={storeEnabled}
                    onBuy={(photoId) => { setLightboxIndex(null); storeRef.current?.shopFor(photoId); }}
                />
            )}

            {/* Bulk action bar for multi-selected photos */}
            {selected.size > 0 && (
                <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 shadow-xl ring-1 ring-white/10">
                    <span className="px-2 text-sm font-medium text-white">{selected.size} selected</span>
                    {storeEnabled && (
                        <button
                            onClick={() => storeRef.current?.shopForMany([...selected])}
                            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100"
                        >
                            <ShoppingBag className="h-3.5 w-3.5" /> Add to cart
                        </button>
                    )}
                    {canDownload && (
                        <button
                            onClick={() => requestDownload([...selected])}
                            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                        >
                            <Download className="h-3.5 w-3.5" /> Download
                        </button>
                    )}
                    <button onClick={() => setSelected(new Set())} className="rounded-full px-2 py-1.5 text-xs text-white/60 hover:text-white">
                        Clear
                    </button>
                </div>
            )}

            <div className="min-h-screen" style={{ ...galleryThemeVars(collection.theme), background: 'var(--g-bg)', color: 'var(--g-text)' }}>
                {/* Modals live inside the themed root so they inherit the --g-* CSS variables */}
                <NameModal
                    open={nameModalOpen}
                    onClose={() => { setNameModalOpen(false); setPendingPhotoId(null); }}
                    onSave={saveName}
                />

                <PinModal
                    open={pinModalOpen}
                    onClose={() => { setPinModalOpen(false); setPendingDownload(null); }}
                    onVerify={verifyPin}
                />

                <NoteModal
                    photo={notePhotoId !== null ? photos.find((p) => p.id === notePhotoId) ?? null : null}
                    initialNote={notePhotoId !== null ? activeNotes[notePhotoId] ?? '' : ''}
                    onClose={() => setNotePhotoId(null)}
                    onSave={saveNote}
                />

                <CoverHero
                    style={collection.cover_style}
                    coverUrl={collection.cover_url}
                    coverSrcset={collection.cover_srcset}
                    title={collection.title}
                    date={
                        collection.event_date
                            ? new Date(collection.event_date).toLocaleDateString(undefined, {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                              })
                            : null
                    }
                />

                {/* Favourites + download controls */}
                {(canDownload || favourites_enabled) && (
                    <header className="px-6 py-8 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {favourites_enabled && (
                                    <ListSelector
                                        lists={lists}
                                        activeListId={activeListId}
                                        onSelect={setActiveListId}
                                        onCreate={createList}
                                        favouriteCount={favouritePhotos.length}
                                        canDownload={canDownload}
                                        identified={identified}
                                        onIdentify={() => { setPendingPhotoId(null); setNameModalOpen(true); }}
                                        onViewFavourites={() => setShowingFavourites(true)}
                                        onDownloadAll={() => requestDownload(favouritePhotos.map((p) => p.id))}
                                    />
                                )}
                                {canDownload && (
                                    <button
                                        onClick={() => requestDownload('all')}
                                        className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition hover:border-neutral-500"
                                        style={{ borderColor: 'var(--g-border)', color: 'var(--g-text)' }}
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                        </svg>
                                        Download all
                                    </button>
                                )}
                            </div>
                            {canFavourite && totalFavourites > 0 && (
                                <p className="text-xs" style={{ color: 'var(--g-faint)' }}>
                                    {totalFavourites} favourite{totalFavourites !== 1 ? 's' : ''} across {lists.length} list{lists.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </header>
                )}

                {/* Set tabs — Pixieset-style sticky navigation (+ Favourites tab) */}
                {(sets.length > 0 || showFavTab) && (
                    <nav
                        className="sticky top-0 z-30 mb-2 border-b backdrop-blur"
                        style={{ borderColor: 'var(--g-border)', background: 'var(--g-bg-2)' }}
                    >
                        <div className="flex flex-nowrap items-center justify-start gap-7 overflow-x-auto px-6 pt-4 sm:justify-center">
                            {/* When there are no sets, an All tab lets visitors leave the Favourites view. */}
                            {sets.length === 0 && showFavTab && (
                                <TabButton active={!onFavView} onClick={() => setShowingFavourites(false)}>
                                    All Photos
                                </TabButton>
                            )}
                            {sets.map((s) => (
                                <TabButton
                                    key={s.id}
                                    active={!onFavView && activeSet === s.id}
                                    onClick={() => { setShowingFavourites(false); setActiveSet(s.id); }}
                                >
                                    {s.name}
                                </TabButton>
                            ))}
                            {showFavTab && (
                                <TabButton active={onFavView} onClick={() => setShowingFavourites(true)}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Heart className="h-3.5 w-3.5" color="var(--g-accent)" fill="var(--g-accent)" />
                                        Favourites ({favouritePhotos.length})
                                    </span>
                                </TabButton>
                            )}
                        </div>
                    </nav>
                )}

                {/* Photo grid */}
                <main className="px-1.5 pb-12">
                    {visiblePhotos.length === 0 ? (
                        <div className="flex h-64 items-center justify-center">
                            <p style={{ color: 'var(--g-faint)', fontSize: '0.875rem' }}>No photos available.</p>
                        </div>
                    ) : (
                        <div
                            ref={gridRef}
                            className="grid"
                            style={{
                                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                                gridAutoRows: `${GRID_ROW}px`,
                                gap: `${GRID_GAP}px`,
                            }}
                        >
                            {visiblePhotos.map((photo, i) => (
                                <GalleryPhoto
                                    key={photo.id}
                                    photo={photo}
                                    index={i}
                                    spanRows={spanFor(photo)}
                                    isFavourited={favouritedSet.has(photo.id)}
                                    showHeart={canFavourite}
                                    showDownload={canDownload}
                                    showNote={canFavourite && favourites_show_notes}
                                    hasNote={!!activeNotes[photo.id]}
                                    showBuy={storeEnabled}
                                    selected={selected.has(photo.id)}
                                    selectionActive={selected.size > 0}
                                    onToggle={handleHeart}
                                    onDownload={requestDownload}
                                    onNote={setNotePhotoId}
                                    onOpen={setLightboxIndex}
                                    onBuy={handleBuy}
                                    onSelect={toggleSelect}
                                />
                            ))}
                        </div>
                    )}
                </main>

                <footer className="py-8 text-center">
                    <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--g-border)' }}>
                        Powered by Studio
                    </p>
                </footer>
            </div>
        </>
    );
}
