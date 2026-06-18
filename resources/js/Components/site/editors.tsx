import ColorPicker from '@/Components/ColorPicker';
import Modal from '@/Components/Modal';
import { BlockSettings, SiteBlock, SiteNavItem } from '@/types';
import { useRef, useState } from 'react';
import { EVENT_TYPES } from './blocks';
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

export function BlockEditor({ block, onChange, onSettings }: {
    block: SiteBlock;
    onChange: (data: Record<string, unknown>) => void;
    onSettings: (settings: BlockSettings) => void;
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
            {tab === 'content' ? <ContentFields block={block} onChange={onChange} /> : <StyleFields settings={block.settings ?? {}} onChange={onSettings} />}
        </div>
    );
}

// ─── Style settings (shared across every block) ───────────────────────────────

function StyleFields({ settings, onChange }: { settings: BlockSettings; onChange: (s: BlockSettings) => void }) {
    const set = (partial: Partial<BlockSettings>) => onChange({ ...settings, ...partial });

    return (
        <div className="space-y-4">
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

function ContentFields({ block, onChange }: { block: SiteBlock; onChange: (data: Record<string, unknown>) => void }) {
    const d = block.data as Record<string, any>;
    const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });

    switch (block.type) {
        case 'hero':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                    <ImageField label="Background image" value={d.image_url} onChange={(v) => set('image_url', v)} />
                    <Field label={`Image darkening (${d.overlay ?? 0}%)`}>
                        <input type="range" min={0} max={80} value={Number(d.overlay) || 0} onChange={(e) => set('overlay', Number(e.target.value))} className="w-full" />
                    </Field>
                    <Text label="Button label" value={d.cta_label} onChange={(v) => set('cta_label', v)} />
                    <Text label="Button link" value={d.cta_link} onChange={(v) => set('cta_link', v)} placeholder="#contact" />
                    <Select label="Alignment" value={d.align} onChange={(v) => set('align', v)} options={[{ value: 'center', label: 'Centered' }, { value: 'left', label: 'Left' }]} />
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
                    <Select label="Columns" value={String(d.columns ?? 3)} onChange={(v) => set('columns', Number(v))} options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
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
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Posts are managed from the <strong>Blog</strong> button at the top. Only published posts appear here.
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
    const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

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
                <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                        <div key={i} className="group relative aspect-square">
                            <img src={img} alt="" className="h-full w-full rounded object-cover" />
                            <button type="button" onClick={() => remove(i)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100" title="Remove">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
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
