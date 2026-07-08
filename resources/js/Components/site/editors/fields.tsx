import Modal from '@/Components/Modal';
import { RetryImg } from '@/Components/site/blocks';
import { usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import GalleryPicker from '../GalleryPicker';

// ─── Field primitives ─────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="label mb-1.5 block">{label}</span>
            {children}
        </label>
    );
}

export function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <Field label={label}>
            <input className="input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        </Field>
    );
}

export function Area({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
    return (
        <Field label={label}>
            <textarea className="input" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        </Field>
    );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
        <Field label={label}>
            <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </Field>
    );
}

/** A row of icon buttons used as a single-choice control (e.g. text alignment). */
export function SegIcon({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; title: string; icon: React.ReactNode }[] }) {
    return (
        <Field label={label}>
            <div className="flex gap-1.5">
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        title={o.title}
                        aria-label={o.title}
                        aria-pressed={value === o.value}
                        onClick={() => onChange(o.value)}
                        className={`flex h-9 flex-1 items-center justify-center rounded-md border transition ${value === o.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'}`}
                    >
                        {o.icon}
                    </button>
                ))}
            </div>
        </Field>
    );
}

/** Text-alignment glyph (lines of text shifted left/centre/right). */
const alignIcon = (paths: string[]) => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        {paths.map((dd, i) => <path key={i} d={dd} />)}
    </svg>
);
export const ALIGN_ICONS: Record<string, React.ReactNode> = {
    left: alignIcon(['M4 6h16', 'M4 10h10', 'M4 14h13', 'M4 18h8']),
    center: alignIcon(['M4 6h16', 'M7 10h10', 'M5 14h14', 'M8 18h8']),
    right: alignIcon(['M4 6h16', 'M10 10h10', 'M7 14h13', 'M12 18h8']),
};

/** A frame with a small block placed at (x,y) — used for content-position controls. */
export const posIcon = (x: number, y: number) => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <rect x={x} y={y} width="6" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
);

/** Drag-to-set focal point over a preview image (same UX as gallery covers). */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm text-neutral-700">{label}</span>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={`relative h-5 w-9 rounded-full transition ${value ? 'bg-neutral-900' : 'bg-neutral-300'}`}
            >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
        </label>
    );
}

// ─── Image upload field ───────────────────────────────────────────────────────

export function ImageField({ label, value, onChange, allowGallery = true, iconPreview = false, seo, onSeoChange, focal, onFocalChange }: {
    label: string;
    value: string;
    onChange: (url: string) => void;
    allowGallery?: boolean;
    /** Render the preview as a small square icon (e.g. favicons) rather than a
     * full-width banner. Contains the image so transparency/aspect is preserved. */
    iconPreview?: boolean;
    /** Current SEO metadata; when provided alongside onSeoChange, a pencil on the
     * preview opens a popup to edit alt text & title (same UX as gallery images). */
    seo?: { alt?: string; title?: string };
    onSeoChange?: (patch: { alt?: string; title?: string }) => void;
    /** When onFocalChange is provided, the preview doubles as a focal-point picker:
     * drag the marker to choose which part of the image stays in view. */
    focal?: { x: number; y: number };
    onFocalChange?: (x: number, y: number) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [seoOpen, setSeoOpen] = useState(false);
    const aiAvailable = !!(usePage().props as any).ai_available;
    const [altBusy, setAltBusy] = useState(false);
    const generateAlt = async () => {
        if (!value || altBusy) return;
        setAltBusy(true);
        try {
            const res = await (window as any).axios.post(route('website.ai.alt'), { image_url: value });
            onSeoChange?.({ alt: res.data.alt as string });
        } catch { /* leave field as-is */ } finally {
            setAltBusy(false);
        }
    };
    const inputRef = useRef<HTMLInputElement>(null);
    const dragging = useRef(false);

    const focalActive = !!onFocalChange;
    const fx = focal?.x ?? 50;
    const fy = focal?.y ?? 50;
    const applyFocal = (el: HTMLElement, clientX: number, clientY: number) => {
        const r = el.getBoundingClientRect();
        const nx = Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100)));
        const ny = Math.max(0, Math.min(100, Math.round(((clientY - r.top) / r.height) * 100)));
        onFocalChange?.(nx, ny);
    };

    const upload = async (file: File) => {
        setUploading(true);
        setError(null);
        const fd = new FormData();
        fd.append('image', file);
        try {
            const res = await (window as any).axios.post(route('website.upload'), fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            onChange(res.data.url);
        } catch {
            setError('Upload failed. Use a PNG/JPG/WEBP under 8MB.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="block">
            {label && <span className="label mb-1.5 block">{label}</span>}
            <div className="space-y-2">
                {value && iconPreview && (
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                        <RetryImg src={value} alt={seo?.alt || ''} className="max-h-full max-w-full object-contain" />
                    </div>
                )}
                {value && !iconPreview && (
                    <div className="group relative">
                        <div
                            {...(focalActive
                                ? {
                                      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); applyFocal(e.currentTarget, e.clientX, e.clientY); },
                                      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => { if (dragging.current) applyFocal(e.currentTarget, e.clientX, e.clientY); },
                                      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => { dragging.current = false; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); },
                                  }
                                : {})}
                            className={`relative w-full overflow-hidden rounded-lg border border-neutral-200 ${focalActive ? 'h-40 cursor-grab touch-none active:cursor-grabbing' : 'h-28'}`}
                        >
                            <RetryImg src={value} alt={seo?.alt || ''} title={seo?.title || undefined} className="pointer-events-none h-full w-full select-none object-cover" style={focalActive ? { objectPosition: `${fx}% ${fy}%` } : undefined} />
                            {focalActive && (
                                <div className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20 shadow ring-1 ring-black/40" style={{ left: `${fx}%`, top: `${fy}%` }} />
                            )}
                            {onSeoChange && (
                                <>
                                    <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setSeoOpen(true)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100" title="Edit alt text & SEO">
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                    </button>
                                    {!seo?.alt && (
                                        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white" title="No alt text — add one for SEO">No alt text</span>
                                    )}
                                </>
                            )}
                        </div>
                        {focalActive && (
                            <p className="mt-1 text-xs text-neutral-500">Drag the marker to choose which part of the image stays in view.</p>
                        )}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-secondary px-3 py-1.5 text-xs">
                        {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
                    </button>
                    {allowGallery && (
                        <button type="button" onClick={() => setPickerOpen(true)} className="btn-secondary px-3 py-1.5 text-xs">
                            From gallery
                        </button>
                    )}
                    {value && (
                        <button type="button" onClick={() => onChange('')} className="btn-ghost px-3 py-1.5 text-xs text-red-600">
                            Remove
                        </button>
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(f);
                        e.target.value = '';
                    }}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            {allowGallery && (
                <GalleryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(urls) => urls[0] && onChange(urls[0])} />
            )}
            {onSeoChange && (
                <Modal show={seoOpen} maxWidth="md" onClose={() => setSeoOpen(false)}>
                    <div className="space-y-4 p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-neutral-900">Image SEO</h2>
                            <button type="button" onClick={() => setSeoOpen(false)} className="text-neutral-400 hover:text-neutral-700">✕</button>
                        </div>
                        {value && <img src={value} alt={seo?.alt || ''} className="h-36 w-full rounded-lg border border-neutral-200 object-cover" />}
                        <Field label="Alt text (describes the image for search engines & screen readers)">
                            <input className="input" value={seo?.alt ?? ''} onChange={(e) => onSeoChange({ alt: e.target.value })} placeholder="e.g. Bride and groom embracing under autumn trees" />
                            {aiAvailable && (
                                <button type="button" onClick={generateAlt} disabled={altBusy} className="mt-1.5 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50">
                                    {altBusy ? 'Looking at the photo…' : '✨ Describe this photo for me'}
                                </button>
                            )}
                        </Field>
                        <Field label="Title">
                            <input className="input" value={seo?.title ?? ''} onChange={(e) => onSeoChange({ title: e.target.value })} />
                        </Field>
                        <div className="flex justify-end">
                            <button type="button" onClick={() => setSeoOpen(false)} className="btn-primary text-sm">Done</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Custom per-block editor contract ─────────────────────────────────────────

/** Props a block's dedicated editor component receives (see blockEditors.tsx). */
export interface BlockEditorFieldsProps {
    d: Record<string, any>;
    onChange: (data: Record<string, unknown>) => void;
    /** Opens the block's large configuration popup (e.g. Google Reviews). */
    onConfigure?: () => void;
    /** Site pages, for pickers that link to a page. */
    pages?: { title: string; slug: string; is_home: boolean }[];
}

// ─── List editor (repeating items: services, FAQs, slides…) ───────────────────

export function ListEditor<T extends Record<string, any>>({
    items,
    onChange,
    blank,
    addLabel,
    render,
}: {
    items: T[];
    onChange: (items: T[]) => void;
    blank: T;
    addLabel: string;
    render: (item: T, update: (next: T) => void) => React.ReactNode;
}) {
    const update = (i: number, next: T) => onChange(items.map((it, idx) => (idx === i ? next : it)));
    const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-neutral-200 p-3">
                    {render(item, (next) => update(i, next))}
                    <button type="button" onClick={() => remove(i)} className="mt-2 text-xs text-red-600 hover:underline">Remove</button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...items, { ...blank }])} className="btn-secondary w-full justify-center py-1.5 text-xs">
                + {addLabel}
            </button>
        </div>
    );
}

// ─── Background-video upload field (hero/slider) ──────────────────────────────

export function VideoField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const upload = async (file: File) => {
        setUploading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('video', file);
            const res = await (window as any).axios.post(route('website.upload.video'), fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            onChange(res.data.url as string);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Upload failed. Use an MP4/WebM under 60MB.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <span className="label mb-1.5 block">{label}</span>
            {value ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-neutral-700">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Video set
                    </span>
                    <span className="flex items-center gap-3">
                        <a href={value} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">Preview</a>
                        <button type="button" onClick={() => onChange('')} className="text-xs text-red-600 hover:underline">Remove</button>
                    </span>
                </div>
            ) : (
                <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-secondary w-full justify-center py-2 text-sm">
                    {uploading ? 'Uploading…' : 'Upload video (MP4, ≤60MB)'}
                </button>
            )}
            <input ref={inputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            <p className="mt-1 text-xs text-neutral-400">Plays muted on a loop behind the text. Keep it short (10–30s) and compressed — the image above shows while it loads.</p>
        </div>
    );
}

// ─── Collapsible editor section ───────────────────────────────────────────────

/**
 * Groups related fields under a collapsible heading so long block editors read
 * as a few clear sections instead of one tall wall of controls.
 */
export function Section({ title, hint, defaultOpen = false, children }: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode }) {
    return (
        <details open={defaultOpen} className="group rounded-lg border border-neutral-200">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-neutral-900">
                    {title}
                    {hint && <span className="ml-2 text-xs font-normal text-neutral-400">{hint}</span>}
                </span>
                <svg className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </summary>
            <div className="space-y-4 border-t border-neutral-100 p-3">{children}</div>
        </details>
    );
}
