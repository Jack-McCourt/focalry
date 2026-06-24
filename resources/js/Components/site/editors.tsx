import ColorPicker from '@/Components/ColorPicker';
import Modal from '@/Components/Modal';
import { BlockSettings, SiteBlock, SiteNavItem } from '@/types';
import { useRef, useState } from 'react';
import { EVENT_TYPES, RetryImg } from './blocks';
import GalleryPicker from './GalleryPicker';

// ─── Field primitives ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="label mb-1.5 block">{label}</span>
            {children}
        </label>
    );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <Field label={label}>
            <input className="input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        </Field>
    );
}

function Area({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
    return (
        <Field label={label}>
            <textarea className="input" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        </Field>
    );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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
function SegIcon({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; title: string; icon: React.ReactNode }[] }) {
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
const ALIGN_ICONS: Record<string, React.ReactNode> = {
    left: alignIcon(['M4 6h16', 'M4 10h10', 'M4 14h13', 'M4 18h8']),
    center: alignIcon(['M4 6h16', 'M7 10h10', 'M5 14h14', 'M8 18h8']),
    right: alignIcon(['M4 6h16', 'M10 10h10', 'M7 14h13', 'M12 18h8']),
};

/** A frame with a small block placed at (x,y) — used for content-position controls. */
const posIcon = (x: number, y: number) => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <rect x={x} y={y} width="6" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
);

/** Drag-to-set focal point over a preview image (same UX as gallery covers). */
function FocalPointPicker({ imageUrl, x, y, onChange }: { imageUrl: string; x: number; y: number; onChange: (x: number, y: number) => void }) {
    const dragging = useRef(false);
    const apply = (el: HTMLElement, clientX: number, clientY: number) => {
        const r = el.getBoundingClientRect();
        const nx = Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100)));
        const ny = Math.max(0, Math.min(100, Math.round(((clientY - r.top) / r.height) * 100)));
        onChange(nx, ny);
    };
    return (
        <Field label="Focal point">
            <div
                onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); apply(e.currentTarget, e.clientX, e.clientY); }}
                onPointerMove={(e) => { if (dragging.current) apply(e.currentTarget, e.clientX, e.clientY); }}
                onPointerUp={(e) => { dragging.current = false; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
                className="relative h-40 w-full touch-none cursor-grab overflow-hidden rounded-lg bg-neutral-100 active:cursor-grabbing"
            >
                <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: `${x}% ${y}%` }} />
                <div className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20 shadow ring-1 ring-black/40" style={{ left: `${x}%`, top: `${y}%` }} />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Drag the marker to choose which part of the image stays in view.</p>
        </Field>
    );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
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

export function ImageField({ label, value, onChange, allowGallery = true }: { label: string; value: string; onChange: (url: string) => void; allowGallery?: boolean }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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
                {value && <img src={value} alt="" className="h-28 w-full rounded-lg border border-neutral-200 object-cover" />}
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
        </div>
    );
}

// ─── Per-block editor (tabbed: Content + Style) ───────────────────────────────

export function BlockEditor({ block, onChange, onSettings, onConfigure, pages }: {
    block: SiteBlock;
    onChange: (data: Record<string, unknown>) => void;
    onSettings: (settings: BlockSettings) => void;
    /** Open the block's larger configuration popup (Google Reviews). */
    onConfigure?: () => void;
    /** Site pages, for the contact form's "after submit" page picker. */
    pages?: { title: string; slug: string; is_home: boolean }[];
}) {
    const [tab, setTab] = useState<'content' | 'style'>('content');

    return (
        <div>
            <div className="mb-4 flex gap-1 border-b border-neutral-100">
                {(['content', 'style'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium capitalize transition ${tab === t ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
            {tab === 'content' ? <ContentFields block={block} onChange={onChange} onConfigure={onConfigure} pages={pages} /> : <StyleFields settings={block.settings ?? {}} onChange={onSettings} block={block} onData={onChange} />}
        </div>
    );
}

// ─── Style settings (shared across every block) ───────────────────────────────

function StyleFields({ settings, onChange, block, onData }: { settings: BlockSettings; onChange: (s: BlockSettings) => void; block: SiteBlock; onData: (data: Record<string, unknown>) => void }) {
    const set = (partial: Partial<BlockSettings>) => onChange({ ...settings, ...partial });
    const data = block.data as Record<string, any>;

    return (
        <div className="space-y-4">
            {block.type === 'hero' && (
                <>
                    <SegIcon
                        label="Text alignment"
                        value={data.text_align ?? data.align ?? 'center'}
                        onChange={(v) => onData({ ...data, text_align: v })}
                        options={[
                            { value: 'left', title: 'Align left', icon: ALIGN_ICONS.left },
                            { value: 'center', title: 'Align centre', icon: ALIGN_ICONS.center },
                            { value: 'right', title: 'Align right', icon: ALIGN_ICONS.right },
                        ]}
                    />
                    <Select
                        label="Title size"
                        value={data.title_size ?? 'md'}
                        onChange={(v) => onData({ ...data, title_size: v })}
                        options={[
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'lg', label: 'Large' },
                            { value: 'xl', label: 'Extra large' },
                        ]}
                    />
                    <Select
                        label="Text shadow"
                        value={data.text_shadow ?? 'none'}
                        onChange={(v) => onData({ ...data, text_shadow: v })}
                        options={[
                            { value: 'none', label: 'None' },
                            { value: 'soft', label: 'Soft' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'strong', label: 'Strong' },
                        ]}
                    />
                </>
            )}
            <div>
                <span className="label mb-1.5 block">Background colour</span>
                <ColorPicker value={settings.background ?? ''} onChange={(c) => set({ background: c || undefined })} allowClear />
            </div>
            <div>
                <span className="label mb-1.5 block">Text colour</span>
                <ColorPicker value={settings.text_color ?? ''} onChange={(c) => set({ text_color: c || undefined })} allowClear />
            </div>
            <Select
                label="Text size"
                value={settings.text_size ?? 'base'}
                onChange={(v) => set({ text_size: v as BlockSettings['text_size'] })}
                options={[{ value: 'sm', label: 'Small' }, { value: 'base', label: 'Default' }, { value: 'lg', label: 'Large' }, { value: 'xl', label: 'Extra large' }]}
            />
            <Select
                label="Padding (top & bottom)"
                value={settings.padding ?? 'default'}
                onChange={(v) => set({ padding: v === 'default' ? undefined : (v as BlockSettings['padding']) })}
                options={[
                    { value: 'default', label: 'Default' },
                    { value: 'none', label: 'None' },
                    { value: 'sm', label: 'Small' },
                    { value: 'md', label: 'Medium' },
                    { value: 'lg', label: 'Large' },
                    { value: 'xl', label: 'Extra large' },
                ]}
            />
            <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">Background & text colour override the block's defaults. Text size affects body paragraphs.</p>
        </div>
    );
}

function ContentFields({ block, onChange, onConfigure, pages }: { block: SiteBlock; onChange: (data: Record<string, unknown>) => void; onConfigure?: () => void; pages?: { title: string; slug: string; is_home: boolean }[] }) {
    const d = block.data as Record<string, any>;
    const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });

    switch (block.type) {
        case 'reviews': {
            const business = d.business;
            const count = Array.isArray(d.reviews) ? d.reviews.length : 0;
            return (
                <div className="space-y-4">
                    {business ? (
                        <div className="rounded-lg border border-neutral-200 p-3">
                            <p className="text-sm font-medium text-neutral-900">{business.name}</p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                                {(business.rating ?? 0).toFixed(1)}★ · {business.total?.toLocaleString?.() ?? business.total} reviews · {count} loaded
                            </p>
                        </div>
                    ) : (
                        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                            Not connected yet. Open the configuration popup to find your business and load reviews.
                        </p>
                    )}
                    <button type="button" onClick={onConfigure} className="btn-primary w-full justify-center">
                        {business ? 'Edit Google Reviews' : 'Connect Google Reviews'}
                    </button>
                    <p className="text-xs text-neutral-400">
                        Reviews are fetched from Google and saved with your site. Reopen this popup any time to refresh them.
                    </p>
                </div>
            );
        }

        case 'hero':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                    <ImageField label="Background image" value={d.image_url} onChange={(v) => set('image_url', v)} />
                    <p className="-mt-2 text-xs text-neutral-400">For best results use a landscape image around 1920×1080.</p>
                    {d.image_url && (
                        <FocalPointPicker imageUrl={d.image_url} x={d.focal_x ?? 50} y={d.focal_y ?? 50} onChange={(x, y) => onChange({ ...d, focal_x: x, focal_y: y })} />
                    )}
                    <Field label={`Image darkening (${d.overlay ?? 0}%)`}>
                        <input type="range" min={0} max={80} value={Number(d.overlay) || 0} onChange={(e) => set('overlay', Number(e.target.value))} className="w-full" />
                    </Field>
                    <Select
                        label="Height"
                        value={d.height ?? 'default'}
                        onChange={(v) => set('height', v)}
                        options={[
                            { value: 'default', label: 'Default' },
                            { value: 'full', label: 'Full height' },
                            { value: 'custom', label: 'Custom height' },
                        ]}
                    />
                    {(d.height ?? 'default') === 'custom' && (
                        <Field label="Custom height">
                            <input className="input" value={d.height_value ?? ''} onChange={(e) => set('height_value', e.target.value)} placeholder="e.g. 600px or 80%" />
                            <p className="mt-1 text-xs text-neutral-500">Enter a pixel value (600px) or a percentage of the screen height (80%).</p>
                        </Field>
                    )}
                    <Text label="Button label" value={d.cta_label} onChange={(v) => set('cta_label', v)} />
                    <Text label="Button link" value={d.cta_link} onChange={(v) => set('cta_link', v)} placeholder="#contact" />
                    <SegIcon
                        label="Content position — horizontal"
                        value={d.content_x ?? (d.align === 'left' ? 'left' : 'center')}
                        onChange={(v) => set('content_x', v)}
                        options={[
                            { value: 'left', title: 'Left', icon: posIcon(5, 9) },
                            { value: 'center', title: 'Centre', icon: posIcon(9, 9) },
                            { value: 'right', title: 'Right', icon: posIcon(13, 9) },
                        ]}
                    />
                    <SegIcon
                        label="Content position — vertical"
                        value={d.content_y ?? 'center'}
                        onChange={(v) => set('content_y', v)}
                        options={[
                            { value: 'top', title: 'Top', icon: posIcon(9, 5) },
                            { value: 'center', title: 'Middle', icon: posIcon(9, 9) },
                            { value: 'bottom', title: 'Bottom', icon: posIcon(9, 13) },
                        ]}
                    />
                </div>
            );

        case 'about':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Body" value={d.body} onChange={(v) => set('body', v)} rows={6} />
                    <ImageField label="Image" value={d.image_url} onChange={(v) => set('image_url', v)} />
                    <Select label="Image side" value={d.image_side} onChange={(v) => set('image_side', v)} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
                </div>
            );

        case 'services':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <ListEditor
                        items={Array.isArray(d.items) ? d.items : []}
                        onChange={(items) => set('items', items)}
                        blank={{ title: 'Service', description: '', price: '' }}
                        addLabel="Add service"
                        render={(item, update) => (
                            <div className="space-y-2">
                                <input className="input" placeholder="Title" value={item.title ?? ''} onChange={(e) => update({ ...item, title: e.target.value })} />
                                <textarea className="input" rows={2} placeholder="Description" value={item.description ?? ''} onChange={(e) => update({ ...item, description: e.target.value })} />
                                <input className="input" placeholder="Price (e.g. From $500)" value={item.price ?? ''} onChange={(e) => update({ ...item, price: e.target.value })} />
                            </div>
                        )}
                    />
                </div>
            );

        case 'gallery':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Select
                        label="Layout"
                        value={d.layout ?? 'square'}
                        onChange={(v) => set('layout', v)}
                        options={[
                            { value: 'square', label: 'Square grid' },
                            { value: 'landscape', label: 'Landscape (4:3)' },
                            { value: 'portrait', label: 'Portrait (3:4)' },
                            { value: 'masonry', label: 'Masonry' },
                        ]}
                    />
                    <div>
                        <Select label="Columns" value={String(d.columns ?? 3)} onChange={(v) => set('columns', Number(v))} options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
                        <p className="mt-1 text-xs text-neutral-400">Applies at desktop width. The preview panel is narrower, so it may show one fewer column than the live site.</p>
                    </div>
                    <Toggle label="Full width (break out of the page container)" value={!!d.full_width} onChange={(v) => set('full_width', v)} />
                    <Toggle label="Lightbox on click" value={d.lightbox !== false} onChange={(v) => set('lightbox', v)} />
                    <GalleryImages images={Array.isArray(d.images) ? d.images : []} onChange={(imgs) => set('images', imgs)} />
                </div>
            );

        case 'blog':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Select label="Columns" value={String(d.columns ?? 3)} onChange={(v) => set('columns', Number(v))} options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
                    <Field label="Number of posts (0 = show all)">
                        <input type="number" min={0} className="input" value={Number(d.limit) || 0} onChange={(e) => set('limit', Number(e.target.value))} />
                    </Field>
                    <Toggle label="Show category filter" value={d.show_categories !== false} onChange={(v) => set('show_categories', v)} />
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Posts are managed from the <strong>Blog</strong> button at the top. Only published posts appear here. Set each post's <strong>Category</strong> in its settings.
                    </p>
                </div>
            );

        case 'packages':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Text label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} />
                    <Select label="Columns" value={String(d.columns ?? 3)} onChange={(v) => set('columns', Number(v))} options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Packages are managed from the <strong>Bookings</strong> tab. Only active packages appear here, and the Book button links to your packages page.
                    </p>
                </div>
            );

        case 'text':
            return <TextBlockFields d={d} set={set} />;

        case 'image':
            return (
                <div className="space-y-4">
                    <ImageField label="Image" value={d.image_url} onChange={(v) => set('image_url', v)} />
                    <Text label="Caption" value={d.caption} onChange={(v) => set('caption', v)} />
                    <Text label="Alt text (for SEO & screen readers)" value={d.alt} onChange={(v) => set('alt', v)} placeholder="Describe the image" />
                </div>
            );

        case 'video':
            return (
                <div className="space-y-4">
                    <Text label="Video URL" value={d.url} onChange={(v) => set('url', v)} placeholder="YouTube or Vimeo link" />
                    <Text label="Caption" value={d.caption} onChange={(v) => set('caption', v)} />
                </div>
            );

        case 'button':
            return (
                <div className="space-y-4">
                    <Text label="Label" value={d.label} onChange={(v) => set('label', v)} />
                    <Text label="Link" value={d.link} onChange={(v) => set('link', v)} placeholder="#contact or https://…" />
                    <Select label="Style" value={d.style ?? 'solid'} onChange={(v) => set('style', v)} options={[{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }]} />
                    <Select label="Alignment" value={d.align ?? 'center'} onChange={(v) => set('align', v)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
                </div>
            );

        case 'cta':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                    <Text label="Button label" value={d.button_label} onChange={(v) => set('button_label', v)} />
                    <Text label="Button link" value={d.button_link} onChange={(v) => set('button_link', v)} placeholder="#contact" />
                </div>
            );

        case 'faq':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <ListEditor
                        items={Array.isArray(d.items) ? d.items : []}
                        onChange={(items) => set('items', items)}
                        blank={{ q: '', a: '' }}
                        addLabel="Add question"
                        render={(item, update) => (
                            <div className="space-y-2">
                                <input className="input" placeholder="Question" value={item.q ?? ''} onChange={(e) => update({ ...item, q: e.target.value })} />
                                <textarea className="input" rows={3} placeholder="Answer" value={item.a ?? ''} onChange={(e) => update({ ...item, a: e.target.value })} />
                            </div>
                        )}
                    />
                </div>
            );

        case 'testimonials':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <ListEditor
                        items={Array.isArray(d.items) ? d.items : []}
                        onChange={(items) => set('items', items)}
                        blank={{ quote: '', author: '', role: '' }}
                        addLabel="Add testimonial"
                        render={(item, update) => (
                            <div className="space-y-2">
                                <textarea className="input" rows={3} placeholder="Quote" value={item.quote ?? ''} onChange={(e) => update({ ...item, quote: e.target.value })} />
                                <input className="input" placeholder="Author" value={item.author ?? ''} onChange={(e) => update({ ...item, author: e.target.value })} />
                                <input className="input" placeholder="Role / event (optional)" value={item.role ?? ''} onChange={(e) => update({ ...item, role: e.target.value })} />
                            </div>
                        )}
                    />
                </div>
            );

        case 'pricing':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <ListEditor
                        items={Array.isArray(d.plans) ? d.plans : []}
                        onChange={(plans) => set('plans', plans)}
                        blank={{ name: 'Plan', price: '', period: '', features: '', button_label: 'Enquire', button_link: '#contact', featured: false }}
                        addLabel="Add plan"
                        render={(item, update) => (
                            <div className="space-y-2">
                                <input className="input" placeholder="Plan name" value={item.name ?? ''} onChange={(e) => update({ ...item, name: e.target.value })} />
                                <div className="flex gap-2">
                                    <input className="input flex-1" placeholder="Price (e.g. $1,500)" value={item.price ?? ''} onChange={(e) => update({ ...item, price: e.target.value })} />
                                    <input className="input w-24" placeholder="/period" value={item.period ?? ''} onChange={(e) => update({ ...item, period: e.target.value })} />
                                </div>
                                <textarea className="input" rows={3} placeholder="One feature per line" value={item.features ?? ''} onChange={(e) => update({ ...item, features: e.target.value })} />
                                <div className="flex gap-2">
                                    <input className="input flex-1" placeholder="Button label" value={item.button_label ?? ''} onChange={(e) => update({ ...item, button_label: e.target.value })} />
                                    <input className="input flex-1" placeholder="Button link" value={item.button_link ?? ''} onChange={(e) => update({ ...item, button_link: e.target.value })} />
                                </div>
                                <label className="flex items-center gap-2 text-sm text-neutral-700">
                                    <input type="checkbox" checked={!!item.featured} onChange={(e) => update({ ...item, featured: e.target.checked })} /> Highlight this plan
                                </label>
                            </div>
                        )}
                    />
                </div>
            );

        case 'logos':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <GalleryImages images={Array.isArray(d.images) ? d.images : []} onChange={(imgs) => set('images', imgs)} />
                </div>
            );

        case 'map':
            return (
                <div className="space-y-4">
                    <Text label="Address or place" value={d.query} onChange={(v) => set('query', v)} placeholder="123 High Street, London" />
                    <Field label={`Height (${Number(d.height) || 360}px)`}>
                        <input type="range" min={200} max={640} step={20} value={Number(d.height) || 360} onChange={(e) => set('height', Number(e.target.value))} className="w-full" />
                    </Field>
                </div>
            );

        case 'embed':
            return (
                <div className="space-y-3">
                    <Field label="Embed code / HTML">
                        <textarea className="input font-mono text-xs" rows={8} value={d.html ?? ''} onChange={(e) => set('html', e.target.value)} placeholder="<iframe …></iframe>" />
                    </Field>
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Embeds (iframes/widgets) render on the published site. Paste only code you trust.</p>
                </div>
            );

        case 'divider':
            return (
                <div className="space-y-4">
                    <Select label="Style" value={d.style ?? 'line'} onChange={(v) => set('style', v)} options={[{ value: 'line', label: 'Line' }, { value: 'space', label: 'Blank space' }]} />
                    <Select label="Size" value={d.size ?? 'md'} onChange={(v) => set('size', v)} options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }]} />
                </div>
            );

        case 'grid':
            return (
                <div className="space-y-4">
                    <Select label="Columns" value={String(d.columns ?? 2)} onChange={(v) => set('columns', Number(v))} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
                    <Select label="Gap" value={d.gap ?? 'md'} onChange={(v) => set('gap', v)} options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }]} />
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Add blocks into each column using the <strong>+ Add block here</strong> buttons in the preview. Reducing columns hides the extra ones (their blocks return if you add the column back).
                    </p>
                </div>
            );

        case 'contact':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                    <Text label="Submit button label" value={d.submit_label} onChange={(v) => set('submit_label', v)} />
                    <div className="rounded-lg border border-neutral-100 p-3">
                        <p className="label mb-2">Form fields</p>
                        <Toggle label="Phone number" value={!!d.show_phone} onChange={(v) => set('show_phone', v)} />
                        <Toggle label="Event date" value={!!d.show_event_date} onChange={(v) => set('show_event_date', v)} />
                        <Toggle label="Event type" value={!!d.show_event_type} onChange={(v) => set('show_event_type', v)} />
                    </div>
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Submissions create a lead in your CRM — a new contact and a project in your “Lead” column.
                    </p>
                    <div className="rounded-lg border border-neutral-100 p-3">
                        <p className="label mb-2">Custom fields</p>
                        <ListEditor
                            items={Array.isArray(d.custom_fields) ? d.custom_fields : []}
                            onChange={(items) => set('custom_fields', items)}
                            blank={{ label: 'New field', type: 'text', required: false, options: '' }}
                            addLabel="Add field"
                            render={(item, update) => (
                                <div className="space-y-2">
                                    <input className="input" placeholder="Label" value={item.label ?? ''} onChange={(e) => update({ ...item, label: e.target.value })} />
                                    <select className="input" value={item.type ?? 'text'} onChange={(e) => update({ ...item, type: e.target.value })}>
                                        <option value="text">Short text</option>
                                        <option value="textarea">Long text</option>
                                        <option value="select">Dropdown</option>
                                        <option value="checkbox">Checkbox</option>
                                    </select>
                                    {item.type === 'select' && (
                                        <textarea className="input" rows={3} placeholder="One option per line" value={item.options ?? ''} onChange={(e) => update({ ...item, options: e.target.value })} />
                                    )}
                                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                                        <input type="checkbox" checked={!!item.required} onChange={(e) => update({ ...item, required: e.target.checked })} /> Required
                                    </label>
                                </div>
                            )}
                        />
                        <div className="mt-3 border-t border-neutral-100 pt-3">
                            <Toggle label="Allow file upload" value={!!d.allow_file} onChange={(v) => set('allow_file', v)} />
                            {d.allow_file && <Text label="File field label" value={d.file_label} onChange={(v) => set('file_label', v)} />}
                        </div>
                    </div>
                    <div className="rounded-lg border border-neutral-100 p-3">
                        <p className="label mb-2">After submitting</p>
                        <ContactRedirectField value={d.redirect_url ?? ''} onChange={(v) => set('redirect_url', v)} pages={pages ?? []} />
                    </div>
                    <div className="rounded-lg border border-neutral-100 p-3">
                        <Toggle label="Send an autoresponder email" value={!!d.autoresponder} onChange={(v) => set('autoresponder', v)} />
                        {d.autoresponder && (
                            <div className="mt-2 space-y-2">
                                <Text label="Subject" value={d.autoresponder_subject} onChange={(v) => set('autoresponder_subject', v)} />
                                <Area label="Message" value={d.autoresponder_message} onChange={(v) => set('autoresponder_message', v)} rows={4} />
                                <p className="text-xs text-neutral-400">Sent to the person who enquired, from your studio name. You’re always emailed about new leads.</p>
                            </div>
                        )}
                    </div>
                    <div className="rounded-lg border border-neutral-100 p-3">
                        <p className="label mb-2">Conversion tracking</p>
                        <Text label="Tracking event name" value={d.tracking_event} onChange={(v) => set('tracking_event', v)} placeholder="e.g. generate_lead" />
                        <p className="mb-3 text-xs text-neutral-400">
                            Fired on submit as a GTM dataLayer event and a GA4 <code>gtag</code> event. Set up the tag/pixel base code under Site settings → Tracking.
                        </p>
                        <Area label="Conversion snippet (advanced)" value={d.conversion_code} onChange={(v) => set('conversion_code', v)} rows={4} />
                        <p className="mt-1 text-xs text-neutral-400">
                            Optional JavaScript run on a successful submit — e.g. a Google Ads conversion <code>gtag('event', 'conversion', …)</code> call.
                        </p>
                    </div>
                </div>
            );

        case 'footer':
            return (
                <div className="space-y-4">
                    <Text label="Business name" value={d.business_name} onChange={(v) => set('business_name', v)} />
                    <Text label="Tagline" value={d.tagline} onChange={(v) => set('tagline', v)} />
                    <Text label="Email" value={d.email} onChange={(v) => set('email', v)} />
                    <Text label="Phone" value={d.phone} onChange={(v) => set('phone', v)} />
                    <Text label="Instagram URL" value={d.instagram} onChange={(v) => set('instagram', v)} />
                    <Text label="Facebook URL" value={d.facebook} onChange={(v) => set('facebook', v)} />
                </div>
            );

        default:
            return <p className="text-sm text-neutral-400">This block has no editable settings.</p>;
    }
}

// EVENT_TYPES re-exported for any future "default enquiry type" picker.
export { EVENT_TYPES };

// ─── Contact form "after submit" target picker ────────────────────────────────

function ContactRedirectField({ value, onChange, pages }: { value: string; onChange: (v: string) => void; pages: { title: string; slug: string; is_home: boolean }[] }) {
    const pageValues = new Set(pages.map((p) => (p.is_home ? 'home' : p.slug)));
    const isCustom = !!value && !pageValues.has(value);
    const mode = !value ? 'message' : isCustom ? 'custom' : 'page';

    const setMode = (m: string) => {
        if (m === 'message') onChange('');
        else if (m === 'custom') onChange('https://');
        else {
            const first = pages[0];
            onChange(first ? (first.is_home ? 'home' : first.slug) : 'home');
        }
    };

    return (
        <div className="space-y-2">
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="message">Show a thank-you message</option>
                <option value="page">Redirect to a page</option>
                <option value="custom">Redirect to a URL</option>
            </select>
            {mode === 'page' && (
                <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
                    {pages.map((p) => (
                        <option key={p.slug} value={p.is_home ? 'home' : p.slug}>{p.title}</option>
                    ))}
                </select>
            )}
            {mode === 'custom' && (
                <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://example.com/thank-you" />
            )}
            <p className="text-xs text-neutral-400">
                Tip: create a “Thank you” page in the builder, then pick it here to send visitors there after they submit.
            </p>
        </div>
    );
}

// ─── Text block fields (heading level + expandable large editor) ──────────────

function TextBlockFields({ d, set }: { d: Record<string, any>; set: (key: string, val: unknown) => void }) {
    const [expanded, setExpanded] = useState(false);

    const levelOptions = [
        { value: 'h1', label: 'H1 — largest' },
        { value: 'h2', label: 'H2' },
        { value: 'h3', label: 'H3' },
        { value: 'h4', label: 'H4' },
        { value: 'h5', label: 'H5' },
        { value: 'h6', label: 'H6 — smallest' },
    ];
    const alignOptions = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }];

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                    Expand editor
                </button>
            </div>
            <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} placeholder="Optional — leave empty for no heading" />
            <Select label="Heading style" value={d.heading_level ?? 'h2'} onChange={(v) => set('heading_level', v)} options={levelOptions} />
            <Area label="Body" value={d.body} onChange={(v) => set('body', v)} rows={6} />
            <Select label="Alignment" value={d.align} onChange={(v) => set('align', v)} options={alignOptions} />

            <Modal show={expanded} onClose={() => setExpanded(false)} maxWidth="2xl">
                <div className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-900">Edit text</h2>
                        <button type="button" onClick={() => setExpanded(false)} className="text-neutral-400 hover:text-neutral-700">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div>
                        <span className="label mb-1.5 block">Heading</span>
                        <input className="input text-lg" value={d.heading ?? ''} placeholder="Optional — leave empty for no heading" onChange={(e) => set('heading', e.target.value)} />
                    </div>
                    <div>
                        <span className="label mb-1.5 block">Content</span>
                        <textarea className="input min-h-[40vh]" rows={18} value={d.body ?? ''} onChange={(e) => set('body', e.target.value)} />
                    </div>
                    <div className="flex justify-end">
                        <button type="button" onClick={() => setExpanded(false)} className="btn-primary">Done</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ─── Navigation editor (header / footer link lists) ───────────────────────────

export function NavEditor({ items, pages, onChange }: { items: SiteNavItem[]; pages: { title: string; slug: string }[]; onChange: (items: SiteNavItem[]) => void }) {
    const update = (i: number, next: SiteNavItem) => onChange(items.map((it, idx) => (idx === i ? next : it)));
    const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
    const move = (i: number, dir: -1 | 1) => {
        const n = i + dir;
        if (n < 0 || n >= items.length) return;
        const a = [...items];
        [a[i], a[n]] = [a[n], a[i]];
        onChange(a);
    };
    const add = () => onChange([...items, { label: 'New link', kind: 'page', target: pages[0]?.slug ?? 'home' }]);

    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-neutral-200 p-2.5">
                    <div className="flex items-center gap-1">
                        <input className="input flex-1" placeholder="Label" value={item.label} onChange={(e) => update(i, { ...item, label: e.target.value })} />
                        <button onClick={() => move(i, -1)} className="px-1 text-neutral-400 hover:text-neutral-700" title="Move up">↑</button>
                        <button onClick={() => move(i, 1)} className="px-1 text-neutral-400 hover:text-neutral-700" title="Move down">↓</button>
                        <button onClick={() => remove(i)} className="px-1 text-red-500 hover:text-red-700" title="Remove">✕</button>
                    </div>
                    <div className="mt-2 flex gap-2">
                        <select
                            className="input w-28 shrink-0"
                            value={item.kind}
                            onChange={(e) => update(i, { ...item, kind: e.target.value as SiteNavItem['kind'], target: e.target.value === 'page' ? pages[0]?.slug ?? 'home' : '' })}
                        >
                            <option value="page">Page</option>
                            <option value="url">Link</option>
                        </select>
                        {item.kind === 'page' ? (
                            <select className="input flex-1" value={item.target} onChange={(e) => update(i, { ...item, target: e.target.value })}>
                                {pages.map((p) => (
                                    <option key={p.slug} value={p.slug}>{p.title}</option>
                                ))}
                            </select>
                        ) : (
                            <input className="input flex-1" placeholder="https://… or #contact" value={item.target} onChange={(e) => update(i, { ...item, target: e.target.value })} />
                        )}
                    </div>
                </div>
            ))}
            <button type="button" onClick={add} className="btn-secondary w-full justify-center py-1.5 text-xs">+ Add link</button>
        </div>
    );
}

// ─── List editor (services) ───────────────────────────────────────────────────

function ListEditor<T extends Record<string, any>>({
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

// ─── Gallery images editor ────────────────────────────────────────────────────

function GalleryImages({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

    const move = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0) return;
        const next = [...images];
        const [m] = next.splice(from, 1);
        next.splice(to, 0, m);
        onChange(next);
    };

    const uploadFiles = async (files: FileList) => {
        setUploading(true);
        setError(null);
        try {
            const urls = await Promise.all(
                Array.from(files).map((file) => {
                    const fd = new FormData();
                    fd.append('image', file);
                    return (window as any).axios
                        .post(route('website.upload'), fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                        .then((r: any) => r.data.url as string);
                }),
            );
            onChange([...images, ...urls.filter(Boolean)]);
        } catch {
            setError('Some images failed to upload. Use PNG/JPG/WEBP under 8MB.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-2">
            {images.length > 0 && (
                <>
                    <div className="grid grid-cols-4 gap-2">
                        {images.map((img, i) => (
                            <div
                                key={i}
                                draggable
                                onDragStart={() => setDragIndex(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
                                onDragEnd={() => setDragIndex(null)}
                                className={`group relative aspect-square cursor-move rounded ring-2 transition ${dragIndex === i ? 'opacity-40 ring-blue-400' : 'ring-transparent'}`}
                            >
                                <RetryImg src={img} alt="" draggable={false} className="pointer-events-none h-full w-full rounded object-cover" />
                                <button type="button" onClick={() => remove(i)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100" title="Remove">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                    {images.length > 1 && <p className="text-xs text-neutral-400">Drag to reorder.</p>}
                </>
            )}
            <div className="flex gap-2">
                <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-secondary flex-1 justify-center py-1.5 text-xs">
                    {uploading ? 'Uploading…' : 'Upload images'}
                </button>
                <button type="button" onClick={() => setPickerOpen(true)} className="btn-secondary flex-1 justify-center py-1.5 text-xs">From galleries</button>
            </div>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                    if (e.target.files?.length) uploadFiles(e.target.files);
                    e.target.value = '';
                }}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <GalleryPicker open={pickerOpen} multiple onClose={() => setPickerOpen(false)} onSelect={(urls) => onChange([...images, ...urls])} />
        </div>
    );
}
