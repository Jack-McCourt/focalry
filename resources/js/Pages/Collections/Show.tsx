import Modal from '@/Components/Modal';
import SendEmailModal from '@/Components/SendEmailModal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Collection,
    EmailDefaults,
    FavouriteActivity,
    GallerySet,
    PageProps,
    Photo,
} from '@/types';
import { CoverHero, CoverStyle, DEFAULT_COVER_STYLE, FONT_OPTIONS, normalizeCoverStyle } from '@/lib/coverStyle';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    ChangeEvent,
    DragEvent,
    FormEventHandler,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadItem {
    id: string;
    file: File;
    progress: number;
    status: 'queued' | 'uploading' | 'registering' | 'done' | 'error';
}

interface ShowProps extends Record<string, unknown> {
    collection: Collection;
    photos: Photo[];
    sets: GallerySet[];
    activity: FavouriteActivity[];
    email_defaults: EmailDefaults;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getCsrfToken(): string {
    return (
        document.cookie
            .split('; ')
            .find((r) => r.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] ?? ''
    );
}

async function uploadToWasabi(
    url: string,
    headers: Record<string, string>,
    file: File,
    onProgress: (p: number) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        Object.entries(headers).forEach(([k, v]) => {
            if (k.toLowerCase() !== 'content-type' && k.toLowerCase() !== 'host') {
                xhr.setRequestHeader(k, v);
            }
        });
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
    });
}

// ─── Sets Manager ─────────────────────────────────────────────────────────────

function SetsManager({
    collection,
    sets,
    activeSetId,
    onSetFilter,
    dropHoverSetId,
    selectionActive,
}: {
    collection: Collection;
    sets: GallerySet[];
    activeSetId: number | null;
    onSetFilter: (id: number | null) => void;
    dropHoverSetId: number | null;
    selectionActive: boolean;
}) {
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');

    const createSet = () => {
        if (!newName.trim()) return;
        router.post(
            route('sets.store', collection.id),
            { name: newName.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewName('');
                    setCreating(false);
                },
            },
        );
    };

    const saveEdit = (set: GallerySet) => {
        if (!editingName.trim() || editingName === set.name) {
            setEditingId(null);
            return;
        }
        router.patch(
            route('sets.update', [collection.id, set.id]),
            { name: editingName.trim() },
            { preserveScroll: true, onSuccess: () => setEditingId(null) },
        );
    };

    const deleteSet = (set: GallerySet) => {
        if (sets.length <= 1) return;
        if (!confirm(`Delete set "${set.name}"? Its photos will move to another set.`)) return;
        router.delete(route('sets.destroy', [collection.id, set.id]), { preserveScroll: true });
    };

    return (
        <div className="mb-4">
            {/* Set tabs / drop-target pills */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                {sets.map((s) => {
                    const isDropTarget = dropHoverSetId === s.id;
                    return (
                        <button
                            key={s.id}
                            data-setdrop={s.id}
                            onClick={() => onSetFilter(s.id)}
                            className={`group/pill flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                                isDropTarget
                                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1 scale-105'
                                    : activeSetId === s.id
                                    ? 'bg-neutral-900 text-white'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            {editingId === s.id ? (
                                <input
                                    autoFocus
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit(s);
                                        if (e.key === 'Escape') setEditingId(null);
                                    }}
                                    onBlur={() => saveEdit(s)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-24 bg-transparent outline-none"
                                />
                            ) : (
                                <>
                                    <span
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(s.id);
                                            setEditingName(s.name);
                                        }}
                                    >
                                        {s.name}
                                    </span>
                                    {sets.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSet(s);
                                            }}
                                            className={`ml-0.5 rounded-full p-0.5 transition ${
                                                activeSetId === s.id || isDropTarget
                                                    ? 'text-white/60 hover:text-white hover:bg-white/20'
                                                    : 'text-neutral-400 hover:text-red-500 hover:bg-red-50'
                                            } opacity-0 group-hover/pill:opacity-100`}
                                            title="Delete set"
                                        >
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </>
                            )}
                        </button>
                    );
                })}

                {creating ? (
                    <div className="flex items-center gap-1.5">
                        <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') createSet();
                                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                            }}
                            placeholder="Set name"
                            className="h-9 rounded-full border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-neutral-500"
                        />
                        <button onClick={createSet} className="text-sm text-neutral-600 hover:text-neutral-900">Save</button>
                        <button onClick={() => { setCreating(false); setNewName(''); }} className="text-sm text-neutral-400 hover:text-neutral-600">Cancel</button>
                    </div>
                ) : (
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3.5 py-2 text-sm text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        New set
                    </button>
                )}
            </div>

            <p className="text-xs text-neutral-400">
                {selectionActive
                    ? 'Drag the selected photos onto a set to move them'
                    : sets.length > 0
                    ? 'Drag a box around photos to select · Double-click a set to rename'
                    : 'Tip: drag a box around photos to select them, then drop into a set'}
            </p>
        </div>
    );
}

// ─── Privacy settings panel ───────────────────────────────────────────────────

function PrivacyPanel({ collection }: { collection: Collection }) {
    const privacy = collection.privacy ?? { has_password: false, email_gate: false };

    const [showPasswordForm, setShowPasswordForm] = useState(privacy.has_password);
    const [emailGate, setEmailGate] = useState(privacy.email_gate ?? false);
    const [password, setPassword] = useState('');
    const [clearPassword, setClearPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = () => {
        setSaving(true);
        router.patch(
            route('collections.update', collection.id),
            {
                privacy_password: showPasswordForm && !clearPassword ? password : null,
                privacy_clear_password: clearPassword ? true : undefined,
                privacy_email_gate: emailGate,
            },
            { onFinish: () => { setSaving(false); setPassword(''); } },
        );
    };

    const isDirty =
        password !== '' ||
        clearPassword ||
        emailGate !== (privacy.email_gate ?? false);

    return (
        <div className="space-y-5">
            {/* Password protect */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-medium text-neutral-800">Password protection</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Visitors must enter a password to view the gallery</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const next = !showPasswordForm;
                            setShowPasswordForm(next);
                            if (!next) setClearPassword(true);
                            else setClearPassword(false);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                            showPasswordForm ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${showPasswordForm ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
                {showPasswordForm && (
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={privacy.has_password ? '••••••  (leave blank to keep current)' : 'Set a password'}
                            className="input"
                        />
                        {privacy.has_password && (
                            <p className="mt-1.5 text-xs text-emerald-600">Password is set. Enter a new one to change it.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Email gate */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-neutral-800">Email registration</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Visitors must enter their name and email to access the gallery</p>
                </div>
                <button
                    type="button"
                    onClick={() => setEmailGate((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                        emailGate ? 'bg-neutral-900' : 'bg-neutral-200'
                    }`}
                >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${emailGate ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
            </div>

            {isDirty && (
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="btn-primary w-full justify-center"
                >
                    {saving ? 'Saving…' : 'Save privacy settings'}
                </button>
            )}
        </div>
    );
}

// ─── Downloads settings panel ─────────────────────────────────────────────────

function DownloadsPanel({ collection }: { collection: Collection }) {
    const ds = collection.download_settings ?? { enabled: false, allow_original: false, require_pin: false, has_pin: false };

    const [enabled, setEnabled] = useState(ds.enabled ?? false);
    const [allowOriginal, setAllowOriginal] = useState(ds.allow_original ?? false);
    const [requirePin, setRequirePin] = useState(ds.require_pin ?? false);
    const [pin, setPin] = useState('');
    const [saving, setSaving] = useState(false);

    const save = () => {
        setSaving(true);
        router.patch(
            route('collections.update', collection.id),
            {
                downloads_enabled: enabled,
                downloads_allow_original: allowOriginal,
                downloads_require_pin: requirePin,
                downloads_pin: pin || undefined,
            },
            { onFinish: () => { setSaving(false); setPin(''); } },
        );
    };

    const isDirty =
        enabled !== (ds.enabled ?? false) ||
        allowOriginal !== (ds.allow_original ?? false) ||
        requirePin !== (ds.require_pin ?? false) ||
        pin !== '';

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-neutral-800">Allow downloads</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Clients can download photos from this gallery</p>
                </div>
                <button
                    type="button"
                    onClick={() => setEnabled((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${enabled ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
            </div>

            {enabled && (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-neutral-800">Full resolution</p>
                            <p className="text-xs text-neutral-500 mt-0.5">Include original high-res files</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAllowOriginal((v) => !v)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${allowOriginal ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                        >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${allowOriginal ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-medium text-neutral-800">Require PIN</p>
                                <p className="text-xs text-neutral-500 mt-0.5">Clients must enter a PIN to download</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRequirePin((v) => !v)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${requirePin ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${requirePin ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        {requirePin && (
                            <input
                                type="text"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                placeholder={ds.has_pin ? '••••  (leave blank to keep current)' : 'Enter a PIN (numbers only)'}
                                className="input font-mono"
                            />
                        )}
                    </div>
                </>
            )}

            {isDirty && (
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="btn-primary w-full justify-center"
                >
                    {saving ? 'Saving…' : 'Save download settings'}
                </button>
            )}
        </div>
    );
}

// ─── Cover styling panel ──────────────────────────────────────────────────────

function CoverOptionButtons<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div>
            <label className="label mb-1.5">{label}</label>
            <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            value === o.value
                                ? 'border-neutral-900 bg-neutral-900 text-white'
                                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CoverPanel({ collection, photos }: { collection: Collection; photos: Photo[] }) {
    const initial = normalizeCoverStyle(collection.cover_style);
    const [style, setStyle] = useState<CoverStyle>(initial);
    const [saving, setSaving] = useState(false);

    const coverPhoto = photos.find((p) => p.id === collection.cover_photo_id);
    const coverUrl = coverPhoto?.web_url ?? coverPhoto?.preview_url ?? null;

    const set = <K extends keyof CoverStyle>(key: K, value: CoverStyle[K]) =>
        setStyle((s) => ({ ...s, [key]: value }));

    const isDirty = JSON.stringify(style) !== JSON.stringify(initial);

    const save = () => {
        setSaving(true);
        router.patch(
            route('collections.update', collection.id),
            { cover_style: { ...style } as Record<string, number | string> },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    };

    const reset = () => setStyle((s) => ({ ...DEFAULT_COVER_STYLE, layout: s.layout }));

    // Click or drag anywhere on the focal-point image to move the focus.
    const draggingFocal = useRef(false);

    const applyFocal = (el: HTMLElement, clientX: number, clientY: number) => {
        const rect = el.getBoundingClientRect();
        const x = clamp(Math.round(((clientX - rect.left) / rect.width) * 100));
        const y = clamp(Math.round(((clientY - rect.top) / rect.height) * 100));
        setStyle((s) => ({ ...s, focal_x: x, focal_y: y }));
    };

    const onFocalPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        draggingFocal.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        applyFocal(e.currentTarget, e.clientX, e.clientY);
    };

    const onFocalPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (draggingFocal.current) {
            applyFocal(e.currentTarget, e.clientX, e.clientY);
        }
    };

    const onFocalPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        draggingFocal.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const hasImage = style.layout !== 'none' && !!coverUrl;

    return (
        <div className="space-y-5">
            {/* Live preview */}
            <div className="overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-neutral-200">
                <CoverHero
                    style={style}
                    coverUrl={coverUrl}
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
                    preview
                />
            </div>

            {!coverPhoto && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No cover photo selected. Open a photo's menu in the Photos tab and choose “Set as cover”.
                </p>
            )}

            <CoverOptionButtons
                label="Layout"
                value={style.layout}
                onChange={(v) => set('layout', v)}
                options={[
                    { value: 'center', label: 'Centered' },
                    { value: 'bottom-left', label: 'Bottom left' },
                    { value: 'bottom-center', label: 'Bottom center' },
                    { value: 'none', label: 'Text only' },
                ]}
            />

            {style.layout !== 'none' && (
                <>
                    <div>
                        <label className="label mb-1.5">Typography</label>
                        <select
                            value={style.font}
                            onChange={(e) => set('font', e.target.value as CoverStyle['font'])}
                            className="input"
                        >
                            {FONT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <CoverOptionButtons
                        label="Text colour"
                        value={style.theme}
                        onChange={(v) => set('theme', v)}
                        options={[
                            { value: 'light', label: 'Light' },
                            { value: 'dark', label: 'Dark' },
                        ]}
                    />

                    <CoverOptionButtons
                        label="Height"
                        value={style.height}
                        onChange={(v) => set('height', v)}
                        options={[
                            { value: 'short', label: 'Short' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'tall', label: 'Full screen' },
                        ]}
                    />

                    <div>
                        <label className="label mb-1.5">
                            Overlay <span className="text-neutral-400">({style.overlay}%)</span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={80}
                            step={5}
                            value={style.overlay}
                            onChange={(e) => set('overlay', Number(e.target.value))}
                            className="w-full accent-neutral-900"
                        />
                        <p className="mt-1 text-xs text-neutral-500">Darken (or lighten) the image so the text stays readable.</p>
                    </div>

                    {hasImage && (
                        <div>
                            <label className="label mb-1.5">Focal point</label>
                            <div
                                onPointerDown={onFocalPointerDown}
                                onPointerMove={onFocalPointerMove}
                                onPointerUp={onFocalPointerUp}
                                className="relative h-40 w-full touch-none cursor-grab overflow-hidden rounded-lg bg-neutral-100 active:cursor-grabbing"
                            >
                                <img
                                    src={coverUrl!}
                                    alt=""
                                    draggable={false}
                                    className="absolute inset-0 h-full w-full select-none object-cover"
                                    style={{ objectPosition: `${style.focal_x}% ${style.focal_y}%` }}
                                />
                                <div
                                    className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20 shadow ring-1 ring-black/40"
                                    style={{ left: `${style.focal_x}%`, top: `${style.focal_y}%` }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">Drag the marker to choose which part of the photo stays in view.</p>
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || !isDirty}
                    className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {saving ? 'Saving…' : isDirty ? 'Save cover style' : 'Saved'}
                </button>
                <button type="button" onClick={reset} className="text-xs text-neutral-500 hover:text-neutral-800">
                    Reset to default
                </button>
            </div>
        </div>
    );
}

function clamp(n: number): number {
    return Math.max(0, Math.min(100, n));
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ collection }: { collection: Collection }) {
    const { data, setData, processing, isDirty } = useForm({
        title: collection.title,
        event_date: collection.event_date ?? '',
        status: collection.status,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        router.patch(route('collections.update', collection.id), {
            title: data.title,
            event_date: data.event_date,
            status: data.status,
        });
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            <div>
                <label className="label mb-1.5">Gallery name</label>
                <input
                    type="text"
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    className="input"
                />
            </div>

            <div>
                <label className="label mb-1.5">Event date</label>
                <input
                    type="date"
                    value={data.event_date}
                    onChange={(e) => setData('event_date', e.target.value)}
                    className="input"
                />
            </div>

            <div>
                <label className="label mb-1.5">Visibility</label>
                <div className="flex gap-2">
                    {(['draft', 'published'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setData('status', s)}
                            className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                                data.status === s
                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                            }`}
                        >
                            {s === 'draft' ? 'Draft' : 'Published'}
                        </button>
                    ))}
                </div>
            </div>

            {isDirty && (
                <button
                    type="submit"
                    disabled={processing}
                    className="btn-primary w-full justify-center"
                >
                    {processing ? 'Saving…' : 'Save changes'}
                </button>
            )}
        </form>
    );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({
    collectionId,
    activeSetId,
    onUploadsComplete,
}: {
    collectionId: number;
    activeSetId: number | null;
    onUploadsComplete: (photos: Photo[]) => void;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const processFiles = useCallback(
        async (files: File[]) => {
            const imageFiles = files.filter((f) =>
                ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
            );
            if (!imageFiles.length) return;

            const newItems: UploadItem[] = imageFiles.map((f) => ({
                id: crypto.randomUUID(),
                file: f,
                progress: 0,
                status: 'queued',
            }));

            setUploads((prev) => [...prev, ...newItems]);

            const update = (id: string, patch: Partial<UploadItem>) =>
                setUploads((prev) =>
                    prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
                );

            const runOne = async (item: UploadItem) => {
                try {
                    update(item.id, { status: 'uploading' });
                    const presign = await axios.post(
                        '/api/uploads/presign',
                        {
                            collection_id: collectionId,
                            filename: item.file.name,
                            content_type: item.file.type,
                            file_size: item.file.size,
                        },
                        { headers: { 'X-XSRF-TOKEN': getCsrfToken() } },
                    );

                    await uploadToWasabi(
                        presign.data.url,
                        presign.data.headers ?? {},
                        item.file,
                        (p) => update(item.id, { progress: p }),
                    );

                    update(item.id, { status: 'registering', progress: 100 });

                    const reg = await axios.post(
                        '/api/photos',
                        {
                            collection_id: collectionId,
                            set_id: activeSetId ?? undefined,
                            filename: item.file.name,
                            wasabi_key: presign.data.key,
                            file_size: item.file.size,
                        },
                        { headers: { 'X-XSRF-TOKEN': getCsrfToken() } },
                    );

                    update(item.id, { status: 'done' });
                    onUploadsComplete([reg.data.photo]);
                } catch {
                    update(item.id, { status: 'error' });
                }
            };

            const CONCURRENCY = 3;
            let idx = 0;
            const next = async (): Promise<void> => {
                if (idx >= newItems.length) return;
                const item = newItems[idx++];
                await runOne(item);
                await next();
            };
            await Promise.all(
                Array.from({ length: Math.min(CONCURRENCY, newItems.length) }, next),
            );
        },
        [collectionId, activeSetId, onUploadsComplete],
    );

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
    };

    const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
            e.target.value = '';
        }
    };

    const active = uploads.filter((u) => u.status !== 'done' && u.status !== 'error');
    const errorCount = uploads.filter((u) => u.status === 'error').length;
    const doneCount = uploads.filter((u) => u.status === 'done').length;

    return (
        <div className="space-y-4">
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-all ${
                    isDragging
                        ? 'border-neutral-400 bg-neutral-50'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
                }`}
            >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                    <svg className="h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-neutral-700">Drop photos here</p>
                <p className="mt-1 text-xs text-neutral-400">
                    or <span className="text-neutral-600 underline underline-offset-2">browse files</span>{' '}
                    · JPEG, PNG, WebP up to 500 MB
                    {activeSetId && (
                        <span className="ml-1 text-neutral-500">· Uploads go into current set</span>
                    )}
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onFileInput}
                />
            </div>

            {(active.length > 0 || doneCount > 0 || errorCount > 0) && (
                <div className="rounded-xl border border-neutral-100 bg-white p-4">
                    {active.length > 0 && (
                        <div className="space-y-2">
                            {active.slice(0, 5).map((u) => (
                                <div key={u.id}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="truncate text-neutral-600 max-w-[240px]">{u.file.name}</span>
                                        <span className="ml-3 shrink-0 text-neutral-400">
                                            {u.status === 'registering' ? 'Queuing…' : `${u.progress}%`}
                                        </span>
                                    </div>
                                    <div className="h-0.5 w-full rounded-full bg-neutral-100">
                                        <div className="h-0.5 rounded-full bg-neutral-900 transition-all duration-200" style={{ width: `${u.progress}%` }} />
                                    </div>
                                </div>
                            ))}
                            {active.length > 5 && (
                                <p className="text-xs text-neutral-400">+{active.length - 5} more uploading…</p>
                            )}
                        </div>
                    )}
                    {(doneCount > 0 || errorCount > 0) && active.length === 0 && (
                        <p className="text-xs text-neutral-500">
                            {doneCount > 0 && `${doneCount} uploaded`}
                            {doneCount > 0 && errorCount > 0 && ' · '}
                            {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Photo tile ───────────────────────────────────────────────────────────────

function PhotoTile({
    photo,
    sets,
    isCover,
    selected,
    onDelete,
    onSetChange,
    onSetCover,
}: {
    photo: Photo;
    sets: GallerySet[];
    isCover: boolean;
    selected: boolean;
    onDelete: (id: number) => void;
    onSetChange: (photoId: number, setId: number | null) => void;
    onSetCover: (photoId: number) => void;
}) {
    const [confirm, setConfirm] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showMenu) return;
        const onDocClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [showMenu]);

    const handleDelete = () => {
        if (!confirm) {
            setConfirm(true);
            setTimeout(() => setConfirm(false), 3000);
            return;
        }
        axios
            .delete(`/api/photos/${photo.id}`, {
                headers: { 'X-XSRF-TOKEN': getCsrfToken() },
            })
            .then(() => onDelete(photo.id));
    };

    const assignSet = (setId: number | null) => {
        setShowMenu(false);
        axios
            .patch(
                `/api/photos/${photo.id}`,
                { set_id: setId },
                { headers: { 'X-XSRF-TOKEN': getCsrfToken() } },
            )
            .then(() => onSetChange(photo.id, setId));
    };

    const setCover = () => {
        setShowMenu(false);
        axios
            .post(
                `/api/photos/${photo.id}/cover`,
                {},
                { headers: { 'X-XSRF-TOKEN': getCsrfToken() } },
            )
            .then(() => onSetCover(photo.id));
    };

    return (
        <div
            data-pid={photo.id}
            className={`group relative aspect-square select-none ${showMenu ? 'z-30' : ''}`}
        >
            {/* Image surface — clipped/rounded; kept separate so menus can escape */}
            <div
                className={`absolute inset-0 overflow-hidden rounded-lg bg-neutral-100 ${
                    selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
            >
                {photo.thumb_url && (
                    <img
                        src={photo.thumb_url}
                        alt={photo.filename}
                        loading="lazy"
                        draggable={false}
                        onLoad={() => setLoaded(true)}
                        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${selected ? 'brightness-90' : ''}`}
                    />
                )}

                {/* Selection check */}
                {selected && (
                    <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}

                {isCover && (
                    <div className={`absolute top-1.5 ${selected ? 'left-8' : 'left-1.5'}`}>
                        <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 backdrop-blur-sm">
                            Cover
                        </span>
                    </div>
                )}

                {photo.status === 'processing' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                    </div>
                )}

                {photo.status === 'failed' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
                        <span className="text-xs text-red-400">Failed</span>
                    </div>
                )}

                <div className="absolute inset-0 bg-neutral-900/0 transition-all group-hover:bg-neutral-900/30" />
            </div>

            {/* Hover actions — outside the clip so dropdowns can overflow the tile */}
            <div className={`absolute right-1.5 top-1.5 flex gap-1 transition group-hover:opacity-100 ${showMenu ? 'opacity-100' : 'opacity-0'}`}>
                {/* Set / options menu */}
                {photo.status === 'ready' && (
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu((v) => !v)}
                            title="Options"
                            className="rounded-md bg-white/90 p-1 text-neutral-700 hover:bg-white backdrop-blur-sm transition"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="5" r="1" fill="currentColor" />
                                <circle cx="12" cy="12" r="1" fill="currentColor" />
                                <circle cx="12" cy="19" r="1" fill="currentColor" />
                            </svg>
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-neutral-100 bg-white py-1 shadow-lg text-xs">
                                <button
                                    onClick={setCover}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50"
                                >
                                    <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Set as cover
                                </button>
                                {sets.length > 0 && (
                                    <>
                                        <div className="my-1 border-t border-neutral-100" />
                                        <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                                            Move to set
                                        </p>
                                        {sets.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => assignSet(s.id)}
                                                className={`flex w-full items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 ${photo.set_id === s.id ? 'text-neutral-900 font-medium' : 'text-neutral-600'}`}
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={handleDelete}
                    title={confirm ? 'Click to confirm' : 'Delete photo'}
                    className={`rounded-md px-2 py-1 text-xs font-medium backdrop-blur-sm transition ${
                        confirm
                            ? 'bg-red-500 text-white'
                            : 'bg-white/90 text-neutral-700 hover:bg-red-50 hover:text-red-600'
                    }`}
                >
                    {confirm ? 'Confirm' : 'Delete'}
                </button>
            </div>
        </div>
    );
}

// ─── Activity tab ─────────────────────────────────────────────────────────────

function ActivityPanel({
    activity,
    collectionId,
}: {
    activity: FavouriteActivity[];
    collectionId: number;
}) {
    const [expanded, setExpanded] = useState<number | null>(null);

    if (activity.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 mb-4">
                    <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                </div>
                <p className="text-sm text-neutral-500">No favourites yet</p>
                <p className="mt-1 text-xs text-neutral-400">When clients heart photos, they'll appear here</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-neutral-100">
            {activity.map((list) => (
                <div key={list.id} className="py-4">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => setExpanded(expanded === list.id ? null : list.id)}
                            className="flex flex-1 items-center justify-between text-left"
                        >
                            <div>
                                <p className="text-sm font-medium text-neutral-900">{list.name}</p>
                                <p className="text-xs text-neutral-500">
                                    {list.visitor?.name ?? list.visitor?.email ?? 'Anonymous visitor'}
                                    {list.visitor?.name && list.visitor?.email && (
                                        <span className="text-neutral-400"> · {list.visitor.email}</span>
                                    )}
                                </p>
                            </div>
                            <span className="ml-4 flex items-center gap-2 text-xs text-neutral-500">
                                <span className="flex items-center gap-1">
                                    <svg className="h-3.5 w-3.5 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                                    </svg>
                                    {list.count}
                                </span>
                                {list.notes_count > 0 && (
                                    <span className="flex items-center gap-1 text-amber-500" title={`${list.notes_count} note${list.notes_count !== 1 ? 's' : ''}`}>
                                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                        </svg>
                                        {list.notes_count}
                                    </span>
                                )}
                            </span>
                        </button>

                        {/* Export / download actions */}
                        {list.count > 0 && (
                            <>
                                <a
                                    href={route('favourite-lists.export-csv', [collectionId, list.id])}
                                    className="btn-ghost shrink-0 text-xs"
                                    title="Export filenames + notes as CSV (for Lightroom / Capture One)"
                                >
                                    CSV
                                </a>
                                <a
                                    href={route('favourite-lists.download', [collectionId, list.id])}
                                    className="btn-secondary shrink-0 text-xs"
                                    title="Download these photos as a ZIP of originals"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Download
                                </a>
                            </>
                        )}

                        <button
                            onClick={() => setExpanded(expanded === list.id ? null : list.id)}
                            className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100"
                        >
                            <svg
                                className={`h-4 w-4 transition-transform ${expanded === list.id ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {expanded === list.id && list.photos.length > 0 && (
                        <div className="mt-3 grid grid-cols-6 gap-1.5">
                            {list.photos.map((p) => (
                                <div key={p.id} className="group/photo relative aspect-square overflow-hidden rounded-md bg-neutral-100">
                                    {p.thumb_url ? (
                                        <img src={p.thumb_url} alt={p.filename} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full" />
                                    )}
                                    {p.note && (
                                        <div
                                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4"
                                            title={p.note}
                                        >
                                            <p className="flex items-start gap-1 text-[10px] leading-tight text-white line-clamp-3">
                                                <svg className="mt-px h-2.5 w-2.5 shrink-0 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                                </svg>
                                                <span className="line-clamp-3">{p.note}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Share modal ──────────────────────────────────────────────────────────────

function ShareModal({
    show,
    onClose,
    collection,
    galleryUrl,
}: {
    show: boolean;
    onClose: () => void;
    collection: Collection;
    galleryUrl: string;
}) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(galleryUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-neutral-900">Share gallery</h2>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {collection.status !== 'published' && (
                    <div className="mb-5 flex items-start gap-3 rounded-lg bg-amber-50 p-4">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <p className="text-sm text-amber-700">
                            This gallery is a draft. Clients won't be able to view it until you publish it.
                        </p>
                    </div>
                )}

                <div className="mb-6">
                    <p className="label mb-2">Gallery link</p>
                    <div className="flex gap-2">
                        <input
                            readOnly
                            value={galleryUrl}
                            onFocus={(e) => e.target.select()}
                            className="input min-w-0 flex-1 font-mono text-xs"
                        />
                        <button
                            onClick={copy}
                            className={`btn-secondary shrink-0 transition-all ${copied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}`}
                        >
                            {copied ? (
                                <>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied
                                </>
                            ) : (
                                'Copy'
                            )}
                        </button>
                    </div>

                    {collection.status === 'published' && (
                        <a
                            href={galleryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Open gallery
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    )}
                </div>

                <div className="rounded-xl border border-neutral-100 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-neutral-900">Send to client</p>
                            <p className="mt-0.5 text-xs text-neutral-500">Email the gallery link directly with a personalised message.</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                            Coming soon
                        </span>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Show({
    collection,
    photos: initialPhotos,
    sets: initialSets,
    activity,
    email_defaults,
}: PageProps<ShowProps>) {
    const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
    const [sets, setSets] = useState<GallerySet[]>(initialSets);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [activeTab, setActiveTab] = useState<'photos' | 'settings' | 'activity'>('photos');
    const [settingsSection, setSettingsSection] = useState<'details' | 'cover' | 'privacy'>('details');
    const [activeSetId, setActiveSetId] = useState<number | null>(initialSets[0]?.id ?? null);
    const [showShare, setShowShare] = useState(false);
    const [emailOpen, setEmailOpen] = useState(false);

    // Keep sets in sync with server props (after create/rename/delete/reorder).
    useEffect(() => setSets(initialSets), [initialSets]);

    // There's no "all photos" view — always land on a valid set.
    useEffect(() => {
        if (sets.length && (activeSetId === null || !sets.some((s) => s.id === activeSetId))) {
            setActiveSetId(sets[0].id);
        }
    }, [sets, activeSetId]);

    const galleryUrl = route('gallery.show', collection.slug);
    const processingCount = photos.filter((p) => p.status === 'processing').length;
    const readyCount = photos.filter((p) => p.status === 'ready').length;

    // ─── Selection + marquee + drag-to-set ───────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [marqueeRect, setMarqueeRect] = useState<
        { left: number; top: number; width: number; height: number } | null
    >(null);
    const [dropHoverSetId, setDropHoverSetId] = useState<number | null>(null);
    const [dragChip, setDragChip] = useState<{ x: number; y: number; count: number } | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        x: number;
        y: number;
        mode: 'pending' | 'marquee' | 'move';
        additive: boolean;
        downPid: number | null;
        base: Set<number>;
    } | null>(null);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    const togglePhoto = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const assignSelectedToSet = useCallback(
        (setId: number | null) => {
            const ids = [...selectedIds];
            if (!ids.length) return;
            axios
                .post(
                    '/api/photos/assign-set',
                    { photo_ids: ids, set_id: setId },
                    { headers: { 'X-XSRF-TOKEN': getCsrfToken() } },
                )
                .then(() => {
                    setPhotos((prev) =>
                        prev.map((p) => (selectedIds.has(p.id) ? { ...p, set_id: setId } : p)),
                    );
                    clearSelection();
                });
        },
        [selectedIds, clearSelection],
    );

    const onGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        // Let buttons / menus handle their own clicks.
        if (target.closest('button') || target.closest('input') || target.closest('[data-tile-menu]')) {
            return;
        }
        const tile = target.closest('[data-pid]') as HTMLElement | null;
        const downPid = tile ? Number(tile.dataset.pid) : null;
        dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            mode: 'pending',
            additive: e.shiftKey || e.metaKey || e.ctrlKey,
            downPid,
            base: new Set(selectedIds),
        };
        gridRef.current?.setPointerCapture(e.pointerId);
    };

    const onGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const info = dragRef.current;
        if (!info) return;
        if (info.mode === 'pending') {
            if (Math.hypot(e.clientX - info.x, e.clientY - info.y) < 6) return;
            // Dragging a selected photo → move mode; otherwise marquee.
            info.mode = info.downPid !== null && info.base.has(info.downPid) ? 'move' : 'marquee';
        }

        if (info.mode === 'marquee') {
            const x0 = Math.min(info.x, e.clientX);
            const y0 = Math.min(info.y, e.clientY);
            const x1 = Math.max(info.x, e.clientX);
            const y1 = Math.max(info.y, e.clientY);
            const gr = gridRef.current!.getBoundingClientRect();
            setMarqueeRect({ left: x0 - gr.left, top: y0 - gr.top, width: x1 - x0, height: y1 - y0 });

            const hit = new Set<number>(info.additive ? info.base : []);
            gridRef.current!.querySelectorAll('[data-pid]').forEach((el) => {
                const r = (el as HTMLElement).getBoundingClientRect();
                if (r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0) {
                    hit.add(Number((el as HTMLElement).dataset.pid));
                }
            });
            setSelectedIds(hit);
        } else if (info.mode === 'move') {
            setDragChip({ x: e.clientX, y: e.clientY, count: info.base.size });
            const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-setdrop]') as HTMLElement | null;
            setDropHoverSetId(over ? Number(over.dataset.setdrop) : null);
        }
    };

    const onGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const info = dragRef.current;
        dragRef.current = null;
        setMarqueeRect(null);
        setDragChip(null);

        if (info?.mode === 'move') {
            const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-setdrop]') as HTMLElement | null;
            if (over) assignSelectedToSet(Number(over.dataset.setdrop));
            setDropHoverSetId(null);
            return;
        }
        setDropHoverSetId(null);

        // No drag → it was a click.
        if (info && info.mode === 'pending') {
            if (info.downPid !== null) togglePhoto(info.downPid);
            else if (!info.additive) clearSelection();
        }
    };

    useEffect(() => {
        const needsPoll = photos.some((p) => p.status === 'processing');
        if (!needsPoll) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            return;
        }
        pollingRef.current = setInterval(() => {
            router.reload({
                only: ['photos', 'sets'],
                onSuccess: (page) => {
                    const props = page.props as unknown as ShowProps;
                    setPhotos(props.photos);
                    setSets(props.sets);
                },
            });
        }, 4000);
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [photos]);

    const handleUploadsComplete = (newPhotos: Photo[]) =>
        setPhotos((prev) => [...prev, ...newPhotos]);

    const handleDelete = (id: number) =>
        setPhotos((prev) => prev.filter((p) => p.id !== id));

    const handleSetChange = (photoId: number, setId: number | null) =>
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, set_id: setId } : p)));

    const [publishing, setPublishing] = useState(false);
    const togglePublish = () => {
        setPublishing(true);
        const newStatus = collection.status === 'published' ? 'draft' : 'published';
        router.patch(
            route('collections.update', collection.id),
            { title: collection.title, event_date: collection.event_date ?? '', status: newStatus },
            { onFinish: () => setPublishing(false) },
        );
    };

    // Photos always live in a set — show only the active set's photos so a
    // 1000-image gallery never renders everything at once.
    const visiblePhotos = sets.length === 0
        ? photos
        : activeSetId !== null
        ? photos.filter((p) => p.set_id === activeSetId)
        : [];

    const activityCount = activity.reduce((sum, a) => sum + a.count, 0);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Link
                            href={route('collections.index')}
                            className="text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            Galleries
                        </Link>
                        <svg className="h-4 w-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-neutral-900 max-w-[200px] truncate">
                            {collection.title}
                        </span>
                        {collection.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Published
                            </span>
                        ) : (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                                Draft
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {collection.status === 'published' && (
                            <a
                                href={galleryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                View
                            </a>
                        )}
                        <button onClick={() => setShowShare(true)} className="btn-secondary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Share
                        </button>
                        <button onClick={() => setEmailOpen(true)} className="btn-secondary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            Email
                        </button>
                        <button
                            onClick={togglePublish}
                            disabled={publishing}
                            className={`btn-primary disabled:opacity-60 ${
                                collection.status === 'published'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600'
                                    : ''
                            }`}
                        >
                            {publishing ? (
                                <span className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    {collection.status === 'published' ? 'Unpublishing…' : 'Publishing…'}
                                </span>
                            ) : collection.status === 'published' ? (
                                'Unpublish'
                            ) : (
                                'Publish'
                            )}
                        </button>
                    </div>
                </div>
            }
        >
            <Head title={collection.title} />

            <ShareModal
                show={showShare}
                onClose={() => setShowShare(false)}
                collection={collection}
                galleryUrl={galleryUrl}
            />

            <SendEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} defaults={email_defaults} />

            <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
                {/* Main content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex shrink-0 items-center gap-1 border-b border-neutral-100 bg-white px-6">
                        {(['photos', 'settings', 'activity'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-3 py-3.5 text-sm font-medium transition-colors ${
                                    activeTab === tab
                                        ? 'text-neutral-900'
                                        : 'text-neutral-400 hover:text-neutral-700'
                                }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'photos' && photos.length > 0 && (
                                    <span className="ml-1.5 text-xs text-neutral-400">{photos.length}</span>
                                )}
                                {tab === 'activity' && activityCount > 0 && (
                                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-rose-100 px-1.5 text-[10px] font-medium text-rose-600">
                                        {activityCount}
                                    </span>
                                )}
                                {activeTab === tab && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-t" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content area */}
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'photos' && (
                            <div className="p-8 space-y-4">
                                <UploadZone
                                    collectionId={collection.id}
                                    activeSetId={activeSetId}
                                    onUploadsComplete={handleUploadsComplete}
                                />

                                {/* Sets manager */}
                                <SetsManager
                                    collection={collection}
                                    sets={sets}
                                    activeSetId={activeSetId}
                                    onSetFilter={(id) => { setActiveSetId(id); clearSelection(); }}
                                    dropHoverSetId={dropHoverSetId}
                                    selectionActive={selectedIds.size > 0}
                                />

                                {processingCount > 0 && (
                                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500 shrink-0" />
                                        <p className="text-sm text-blue-700">
                                            {processingCount} photo{processingCount > 1 ? 's' : ''} processing — thumbnails will appear shortly
                                        </p>
                                    </div>
                                )}

                                {visiblePhotos.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <p className="text-sm text-neutral-400">
                                            {activeSetId !== null
                                                ? 'No photos in this set yet. Upload above or move photos here.'
                                                : 'No photos yet. Drop some above to get started.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div
                                        ref={gridRef}
                                        onPointerDown={onGridPointerDown}
                                        onPointerMove={onGridPointerMove}
                                        onPointerUp={onGridPointerUp}
                                        onPointerCancel={() => { dragRef.current = null; setMarqueeRect(null); setDragChip(null); setDropHoverSetId(null); }}
                                        className="relative grid touch-none grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
                                    >
                                        {visiblePhotos.map((photo) => (
                                            <PhotoTile
                                                key={photo.id}
                                                photo={photo}
                                                sets={sets}
                                                isCover={photo.id === collection.cover_photo_id}
                                                selected={selectedIds.has(photo.id)}
                                                onDelete={handleDelete}
                                                onSetChange={handleSetChange}
                                                onSetCover={(id) => router.reload({ only: ['collection'] })}
                                            />
                                        ))}

                                        {/* Marquee selection box */}
                                        {marqueeRect && (
                                            <div
                                                className="pointer-events-none absolute z-40 rounded-sm border border-blue-400 bg-blue-400/15"
                                                style={{
                                                    left: marqueeRect.left,
                                                    top: marqueeRect.top,
                                                    width: marqueeRect.width,
                                                    height: marqueeRect.height,
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="flex flex-col gap-8 p-8 sm:flex-row">
                                {/* Sub-navigation */}
                                <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-48 sm:flex-col sm:overflow-visible">
                                    {([
                                        { key: 'details', label: 'Gallery details' },
                                        { key: 'cover', label: 'Cover' },
                                        { key: 'privacy', label: 'Privacy' },
                                    ] as const).map((s) => (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => setSettingsSection(s.key)}
                                            className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                                                settingsSection === s.key
                                                    ? 'bg-neutral-100 text-neutral-900'
                                                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </nav>

                                <div className="max-w-md flex-1">
                                    {settingsSection === 'details' && (
                                        <div className="space-y-10">
                                            <section>
                                                <h3 className="mb-4 text-sm font-semibold text-neutral-900">Gallery details</h3>
                                                <SettingsPanel collection={collection} />
                                            </section>

                                            <section>
                                                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Share</h3>
                                                <button onClick={() => setShowShare(true)} className="btn-secondary">
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                    </svg>
                                                    Share gallery
                                                </button>
                                            </section>

                                            <section className="border-t border-neutral-100 pt-8">
                                                <h3 className="mb-3 text-sm font-semibold text-red-600">Danger zone</h3>
                                                <Link
                                                    href={route('collections.destroy', collection.id)}
                                                    method="delete"
                                                    as="button"
                                                    className="btn-secondary border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
                                                    onClick={(e) => {
                                                        if (!confirm('Delete this gallery and all its photos? This cannot be undone.')) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    Delete gallery
                                                </Link>
                                            </section>
                                        </div>
                                    )}

                                    {settingsSection === 'cover' && (
                                        <section>
                                            <h3 className="mb-4 text-sm font-semibold text-neutral-900">Cover</h3>
                                            <CoverPanel collection={collection} photos={photos} />
                                        </section>
                                    )}

                                    {settingsSection === 'privacy' && (
                                        <div className="space-y-10">
                                            <section>
                                                <h3 className="mb-4 text-sm font-semibold text-neutral-900">Privacy</h3>
                                                <PrivacyPanel collection={collection} />
                                            </section>

                                            <section>
                                                <h3 className="mb-4 text-sm font-semibold text-neutral-900">Downloads</h3>
                                                <DownloadsPanel collection={collection} />
                                            </section>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="p-8">
                                <div className="max-w-xl">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-semibold text-neutral-900">Client favourites</h3>
                                            <p className="mt-0.5 text-xs text-neutral-500">Photos your clients have hearted</p>
                                        </div>
                                        {activityCount > 0 && (
                                            <span className="text-xs text-neutral-500">
                                                {activityCount} favourite{activityCount !== 1 ? 's' : ''} across {activity.length} visitor{activity.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <ActivityPanel activity={activity} collectionId={collection.id} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right sidebar */}
                <aside className="hidden w-56 shrink-0 border-l border-neutral-100 bg-white lg:flex lg:flex-col">
                    <div className="border-b border-neutral-100 p-5">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400">Overview</p>
                        <div className="space-y-3">
                            <StatRow label="Total photos" value={photos.length} />
                            <StatRow label="Ready" value={readyCount} />
                            {processingCount > 0 && (
                                <StatRow label="Processing" value={processingCount} accent />
                            )}
                            {sets.length > 0 && (
                                <StatRow label="Sets" value={sets.length} />
                            )}
                            {activityCount > 0 && (
                                <StatRow label="Favourites" value={activityCount} />
                            )}
                        </div>
                    </div>

                    {collection.event_date && (
                        <div className="border-b border-neutral-100 p-5">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Event date</p>
                            <p className="text-sm text-neutral-700">
                                {new Date(collection.event_date).toLocaleDateString(undefined, {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </p>
                        </div>
                    )}

                    <div className="p-5">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400">Share</p>
                        <button
                            onClick={() => setShowShare(true)}
                            className="btn-secondary w-full justify-center text-xs"
                        >
                            Share gallery
                        </button>
                    </div>
                </aside>
            </div>

            {/* Floating selection toolbar */}
            {selectedIds.size > 0 && (
                <SelectionToolbar
                    count={selectedIds.size}
                    sets={sets}
                    onMoveToSet={assignSelectedToSet}
                    onClear={clearSelection}
                />
            )}

            {/* Drag chip following the cursor */}
            {dragChip && (
                <div
                    className="pointer-events-none fixed z-[60] flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-xl"
                    style={{ left: dragChip.x + 14, top: dragChip.y + 14 }}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    {dragChip.count} photo{dragChip.count !== 1 ? 's' : ''}
                </div>
            )}
        </AuthenticatedLayout>
    );
}

function SelectionToolbar({
    count,
    sets,
    onMoveToSet,
    onClear,
}: {
    count: number;
    sets: GallerySet[];
    onMoveToSet: (setId: number | null) => void;
    onClear: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [menuOpen]);

    return (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
            <div className="flex items-center gap-3 rounded-full bg-neutral-900 py-2 pl-5 pr-2 text-white shadow-2xl">
                <span className="text-sm font-medium">
                    {count} selected
                </span>
                <div className="relative" ref={ref}>
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-neutral-200"
                    >
                        Move to set
                        <svg className={`h-3 w-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {menuOpen && (
                        <div className="absolute bottom-full left-1/2 mb-2 w-44 -translate-x-1/2 rounded-lg border border-neutral-100 bg-white py-1 text-xs text-neutral-700 shadow-xl">
                            {sets.length === 0 && (
                                <p className="px-3 py-2 text-neutral-400">No sets yet — create one first.</p>
                            )}
                            {sets.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => { setMenuOpen(false); onMoveToSet(s.id); }}
                                    className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50"
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={onClear}
                    className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
                    title="Clear selection"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

function StatRow({
    label,
    value,
    accent = false,
}: {
    label: string;
    value: number;
    accent?: boolean;
}) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">{label}</span>
            <span className={`text-sm font-semibold ${accent ? 'text-blue-600' : 'text-neutral-900'}`}>
                {value}
            </span>
        </div>
    );
}
