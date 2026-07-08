import ColorPicker from '@/Components/ColorPicker';
import RichTextEditor from '@/Components/LazyRichTextEditor';
import Modal from '@/Components/Modal';
import { EVENT_TYPES, GalleryImage, RetryImg, galleryAlt, galleryCaption, galleryThumb, galleryTitle } from '@/Components/site/blocks';
import { SiteBlock } from '@/types';
import { useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import GalleryPicker from '../GalleryPicker';
import { BLOCK_EDITORS } from './blockEditors';
import { Area, Field, ImageField, ListEditor, Section, SegIcon, Select, Text, Toggle, VideoField, posIcon } from './fields';

export function ContentFields({ block, onChange, onConfigure, pages }: { block: SiteBlock; onChange: (data: Record<string, unknown>) => void; onConfigure?: () => void; pages?: { title: string; slug: string; is_home: boolean }[] }) {
    const d = block.data as Record<string, any>;
    const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });

    // Blocks with a dedicated editor module (see blockEditors.tsx) skip the
    // switch entirely — that registry is where new blocks' editors register.
    const Custom = BLOCK_EDITORS[block.type];
    if (Custom) {
        return <Custom d={d} onChange={onChange} onConfigure={onConfigure} pages={pages} />;
    }

    switch (block.type) {
        case 'hero':
            return (
                <div className="space-y-3">
                    <Section title="Text & button" defaultOpen>
                        <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                        <HeadlineIdeas current={d.heading ?? ''} context={d.subheading ?? ''} onPick={(v) => set('heading', v)} />
                        <Select label="Heading level" value={d.heading_level === 'h2' ? 'h2' : 'h1'} onChange={(v) => set('heading_level', v)} options={[
                            { value: 'h1', label: 'H1 — page title (default)' },
                            { value: 'h2', label: 'H2 — for extra hero banners on the same page' },
                        ]} />
                        <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                        <div className="grid grid-cols-2 gap-3">
                            <Text label="Button label" value={d.cta_label} onChange={(v) => set('cta_label', v)} />
                            <Text label="Button link" value={d.cta_link} onChange={(v) => set('cta_link', v)} placeholder="#contact" />
                        </div>
                    </Section>

                    <Section title="Background" defaultOpen>
                        <ImageField
                            label="Image"
                            value={d.image_url}
                            onChange={(v) => set('image_url', v)}
                            seo={{ alt: d.alt, title: d.title }}
                            onSeoChange={(patch) => onChange({ ...d, ...patch })}
                            focal={{ x: d.focal_x ?? 50, y: d.focal_y ?? 50 }}
                            onFocalChange={(x, y) => onChange({ ...d, focal_x: x, focal_y: y })}
                        />
                        <p className="-mt-2 text-xs text-neutral-400">Best around 1920×1080. Hover the image for alt text (SEO); drag the dot to set the focus point.</p>
                        <VideoField label="Background video (optional)" value={d.video_url ?? ''} onChange={(v) => set('video_url', v)} />
                    </Section>

                    <Section title="Overlay & text backdrop" hint="readability over the photo">
                        <Field label={`Image darkening (${d.overlay ?? 0}%)`}>
                            <input type="range" min={0} max={80} value={Number(d.overlay) || 0} onChange={(e) => set('overlay', Number(e.target.value))} className="w-full" />
                        </Field>
                        <Select
                            label="Text background"
                            value={d.text_bg ?? 'none'}
                            onChange={(v) => set('text_bg', v)}
                            options={[
                                { value: 'none', label: 'None' },
                                { value: 'gradient', label: 'Gradient (fades up from bottom)' },
                                { value: 'panel', label: 'Solid panel behind text' },
                            ]}
                        />
                        {(d.text_bg ?? 'none') !== 'none' && (
                            <>
                                <Field label="Background colour">
                                    <ColorPicker value={d.text_bg_color ?? '#000000'} onChange={(c) => set('text_bg_color', c || '#000000')} />
                                </Field>
                                <Field label={`Background opacity (${d.text_bg_opacity ?? 60}%)`}>
                                    <input type="range" min={0} max={100} value={Number(d.text_bg_opacity ?? 60)} onChange={(e) => set('text_bg_opacity', Number(e.target.value))} className="w-full" />
                                </Field>
                                {d.text_bg === 'gradient' && (
                                    <Field label={`Gradient height (${d.text_bg_extent ?? 65}%)`}>
                                        <input type="range" min={20} max={100} value={Number(d.text_bg_extent ?? 65)} onChange={(e) => set('text_bg_extent', Number(e.target.value))} className="w-full" />
                                        <p className="mt-1 text-xs text-neutral-500">How far up the photo the gradient reaches. Pairs best with bottom-aligned text.</p>
                                    </Field>
                                )}
                            </>
                        )}
                    </Section>

                    <Section title="Size & position">
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
                    </Section>
                </div>
            );

        case 'about':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Body" value={d.body} onChange={(v) => set('body', v)} rows={6} />
                    <ImageField label="Image" value={d.image_url} onChange={(v) => set('image_url', v)} />
                    {d.image_url && (
                        <>
                            <Text label="Image alt text (for SEO & screen readers)" value={d.alt} onChange={(v) => set('alt', v)} placeholder="Describe the image" />
                            <Text label="Image title" value={d.title} onChange={(v) => set('title', v)} />
                        </>
                    )}
                    <Select label="Image side" value={d.image_side} onChange={(v) => set('image_side', v)} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
                    <Select
                        label="Image aspect ratio"
                        value={d.image_ratio ?? '4/5'}
                        onChange={(v) => set('image_ratio', v)}
                        options={[
                            { value: '4/5', label: 'Portrait (4:5)' },
                            { value: '1/1', label: 'Square (1:1)' },
                            { value: '3/2', label: 'Landscape (3:2)' },
                            { value: '16/9', label: 'Wide (16:9)' },
                            { value: 'none', label: 'Original (no crop)' },
                        ]}
                    />
                </div>
            );

        case 'card':
            return (
                <div className="space-y-4">
                    <ImageField label="Image" value={d.image_url} onChange={(v) => set('image_url', v)} />
                    {d.image_url && (
                        <>
                            <Text label="Image alt text (for SEO & screen readers)" value={d.alt} onChange={(v) => set('alt', v)} placeholder="Describe the image" />
                            <Text label="Image title" value={d.title} onChange={(v) => set('title', v)} />
                        </>
                    )}
                    <Select
                        label="Image aspect ratio"
                        value={d.image_ratio ?? 'none'}
                        onChange={(v) => set('image_ratio', v)}
                        options={[
                            { value: 'none', label: 'Original (no crop)' },
                            { value: '3/2', label: 'Landscape (3:2)' },
                            { value: '4/5', label: 'Portrait (4:5)' },
                            { value: '1/1', label: 'Square (1:1)' },
                            { value: '16/9', label: 'Wide (16:9)' },
                        ]}
                    />
                    <Text label="Title" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Text" value={d.body} onChange={(v) => set('body', v)} rows={6} />
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
                <div className="space-y-3">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />

                    <Section title="Photos" defaultOpen>
                        <LinkedGalleryField d={d} onChange={onChange} />
                        {!d.linked_collection_id && <GalleryImages images={Array.isArray(d.images) ? d.images : []} onChange={(imgs) => set('images', imgs)} />}
                    </Section>

                    <Section title="Layout" defaultOpen>
                        <Select
                            label="Style"
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
                    </Section>
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
                    <Field label="Posts per page (0 = no pagination)">
                        <input type="number" min={0} className="input" value={Number(d.per_page) || 0} onChange={(e) => set('per_page', Number(e.target.value))} />
                    </Field>
                    <Toggle label="Show category filter" value={d.show_categories !== false} onChange={(v) => set('show_categories', v)} />
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
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
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
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
                    <Text label="Title" value={d.title} onChange={(v) => set('title', v)} />
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
                    <LinkedGalleryField d={d} onChange={onChange} />
                    {!d.linked_collection_id && <GalleryImages images={Array.isArray(d.images) ? d.images : []} onChange={(imgs) => set('images', imgs)} />}
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
                    <Text label="Title (optional)" value={d.heading} onChange={(v) => set('heading', v)} placeholder="Shown above the grid" />
                    <Area label="Text (optional)" value={d.body} onChange={(v) => set('body', v)} rows={3} />
                    <Select label="Columns" value={String(d.columns ?? 2)} onChange={(v) => set('columns', Number(v))} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
                    <Select label="Gap" value={d.gap ?? 'md'} onChange={(v) => set('gap', v)} options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }]} />
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                        Add blocks into each column using the <strong>+ Add block here</strong> buttons in the preview. Reducing columns hides the extra ones (their blocks return if you add the column back).
                    </p>
                </div>
            );

        case 'beforeafter':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <ImageField label="Before image" value={d.before_url} onChange={(v) => set('before_url', v)} />
                    <ImageField label="After image" value={d.after_url} onChange={(v) => set('after_url', v)} />
                    <div className="grid grid-cols-2 gap-3">
                        <Text label="Before label" value={d.before_label} onChange={(v) => set('before_label', v)} />
                        <Text label="After label" value={d.after_label} onChange={(v) => set('after_label', v)} />
                    </div>
                    <Text label="Alt text (SEO)" value={d.alt} onChange={(v) => set('alt', v)} placeholder="Describe the comparison" />
                </div>
            );

        case 'countdown':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Text label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} />
                    <Field label="Counting down to">
                        <input type="datetime-local" className="input" value={d.target ?? ''} onChange={(e) => set('target', e.target.value)} />
                    </Field>
                    <Text label="Message once reached" value={d.finished_message} onChange={(v) => set('finished_message', v)} />
                </div>
            );

        case 'booking':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                    <Field label="Embed height (px)">
                        <input type="number" min={400} max={1600} className="input" value={Number(d.height) || 900} onChange={(e) => set('height', Number(e.target.value))} />
                    </Field>
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                        Embeds your scheduling page — meeting types, availability and confirmations are managed under <strong>Studio → Meetings</strong>.
                    </p>
                </div>
            );

        case 'newsletter':
            return (
                <div className="space-y-4">
                    <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                    <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                    <Text label="Email placeholder" value={d.placeholder} onChange={(v) => set('placeholder', v)} />
                    <Text label="Button label" value={d.button_label} onChange={(v) => set('button_label', v)} />
                    <Text label="Success message" value={d.success_message} onChange={(v) => set('success_message', v)} />
                    <Toggle label="Ask for a name too" value={!!d.show_name} onChange={(v) => set('show_name', v)} />
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                        Signups are saved under <strong>Website → Subscribers</strong>, with CSV export for Mailchimp, Flodesk or any email tool.
                    </p>
                </div>
            );

        case 'contact':
            return (
                <div className="space-y-3">
                    <Section title="Text & button" defaultOpen>
                        <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
                        <Area label="Subheading" value={d.subheading} onChange={(v) => set('subheading', v)} rows={2} />
                        <Text label="Submit button label" value={d.submit_label} onChange={(v) => set('submit_label', v)} />
                    </Section>

                    <Section title="Form fields" defaultOpen>
                        <div className="space-y-2">
                            <Toggle label="Phone number" value={!!d.show_phone} onChange={(v) => set('show_phone', v)} />
                            <Toggle label="Event date" value={!!d.show_event_date} onChange={(v) => set('show_event_date', v)} />
                            <Toggle label="Event type" value={!!d.show_event_type} onChange={(v) => set('show_event_type', v)} />
                        </div>
                        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                            Submissions create a lead in your CRM — a new contact and a project in your “Lead” column.
                        </p>
                    </Section>

                    <Section title="Custom fields" hint="extra questions">
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
                        <div className="border-t border-neutral-100 pt-3">
                            <Toggle label="Allow file upload" value={!!d.allow_file} onChange={(v) => set('allow_file', v)} />
                            {d.allow_file && <Text label="File field label" value={d.file_label} onChange={(v) => set('file_label', v)} />}
                        </div>
                    </Section>

                    <Section title="After submitting" hint="thank-you or redirect">
                        <ContactRedirectField value={d.redirect_url ?? ''} onChange={(v) => set('redirect_url', v)} pages={pages ?? []} />
                    </Section>

                    <Section title="Auto-reply email">
                        <Toggle label="Send an autoresponder email" value={!!d.autoresponder} onChange={(v) => set('autoresponder', v)} />
                        {d.autoresponder && (
                            <div className="space-y-2">
                                <Text label="Subject" value={d.autoresponder_subject} onChange={(v) => set('autoresponder_subject', v)} />
                                <Area label="Message" value={d.autoresponder_message} onChange={(v) => set('autoresponder_message', v)} rows={4} />
                                <p className="text-xs text-neutral-400">Sent to the person who enquired, from your studio name. You’re always emailed about new leads.</p>
                            </div>
                        )}
                    </Section>

                    <Section title="Spam & tracking">
                        <Toggle label="Spam protection (Cloudflare Turnstile)" value={!!d.captcha} onChange={(v) => set('captcha', v)} />
                        <p className="-mt-2 text-xs text-neutral-400">Uses the Turnstile keys from Site settings → General (or the platform default). A honeypot and rate limit are always on.</p>
                        <Text label="Tracking event name" value={d.tracking_event} onChange={(v) => set('tracking_event', v)} placeholder="e.g. generate_lead" />
                        <p className="-mt-2 text-xs text-neutral-400">
                            Fired on submit as a GTM dataLayer event and a GA4 <code>gtag</code> event.
                        </p>
                        <Area label="Conversion snippet (advanced)" value={d.conversion_code} onChange={(v) => set('conversion_code', v)} rows={4} />
                        <p className="-mt-2 text-xs text-neutral-400">
                            Optional JavaScript run on a successful submit — e.g. a Google Ads conversion <code>gtag('event', 'conversion', …)</code> call.
                        </p>
                    </Section>
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
                <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                    Expand editor
                </button>
            </div>
            <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} placeholder="Optional — leave empty for no heading" />
            <Select label="Heading style" value={d.heading_level ?? 'h2'} onChange={(v) => set('heading_level', v)} options={levelOptions} />
            <Field label="Body">
                <RichTextEditor value={d.body ?? ''} onChange={(html) => set('body', html)} />
            </Field>
            <Select label="Alignment" value={d.align} onChange={(v) => set('align', v)} options={alignOptions} />

            <Modal show={expanded} onClose={() => setExpanded(false)} maxWidth="4xl">
                <div className="flex max-h-[85vh] flex-col">
                    <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4">
                        <h2 className="text-sm font-semibold text-neutral-900">Edit text</h2>
                        <button type="button" onClick={() => setExpanded(false)} className="text-neutral-400 hover:text-neutral-700">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <div>
                            <span className="label mb-1.5 block">Heading</span>
                            <input className="input text-lg" value={d.heading ?? ''} placeholder="Optional — leave empty for no heading" onChange={(e) => set('heading', e.target.value)} />
                        </div>
                        <div>
                            <span className="label mb-1.5 block">Content</span>
                            <RichTextEditor value={d.body ?? ''} onChange={(html) => set('body', html)} minHeightClass="min-h-[45vh]" />
                        </div>
                    </div>
                    <div className="flex shrink-0 justify-end border-t border-neutral-100 px-6 py-4">
                        <button type="button" onClick={() => setExpanded(false)} className="btn-primary">Done</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ─── Gallery images editor ────────────────────────────────────────────────────

function GalleryImages({ images, onChange }: { images: GalleryImage[]; onChange: (images: GalleryImage[]) => void }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

    // Write SEO metadata onto one image, promoting a plain-string image to the
    // object form (preserving its URL) so alt/title/caption can be stored.
    const setMeta = (i: number, patch: Partial<{ alt: string; title: string; caption: string }>) =>
        onChange(images.map((img, idx) => (idx === i ? { ...(typeof img === 'string' ? { full: img } : img), ...patch } : img)));

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
                                className={`group relative aspect-square cursor-move rounded ring-2 transition ${dragIndex === i ? 'opacity-40 ring-brand-400' : 'ring-transparent'}`}
                            >
                                <RetryImg src={galleryThumb(img)} alt={galleryAlt(img)} draggable={false} className="pointer-events-none h-full w-full rounded object-cover" />
                                <button type="button" onClick={() => remove(i)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100" title="Remove">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <button type="button" onClick={() => setEditIndex(i)} className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100" title="Edit alt text & SEO">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                </button>
                                {!galleryAlt(img) && (
                                    <span className="absolute bottom-0.5 left-0.5 rounded bg-amber-500/90 px-1 text-[9px] font-medium leading-tight text-white" title="No alt text — add one for SEO">alt?</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-neutral-400">{images.length > 1 ? 'Drag to reorder. ' : ''}Hover an image and click the pencil to add alt text, a title and a caption for SEO.</p>
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

            <Modal show={editIndex !== null} maxWidth="md" onClose={() => setEditIndex(null)}>
                {editIndex !== null && images[editIndex] && (
                    <div className="space-y-4 p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-neutral-900">Image SEO</h2>
                            <button type="button" onClick={() => setEditIndex(null)} className="text-neutral-400 hover:text-neutral-700">✕</button>
                        </div>
                        <RetryImg src={galleryThumb(images[editIndex])} alt={galleryAlt(images[editIndex])} className="h-36 w-full rounded-lg border border-neutral-200 object-cover" />
                        <Field label="Alt text (describes the image for search engines & screen readers)">
                            <input className="input" value={galleryAlt(images[editIndex])} onChange={(e) => setMeta(editIndex, { alt: e.target.value })} placeholder="e.g. Bride and groom embracing under autumn trees" />
                        </Field>
                        <Field label="Title">
                            <input className="input" value={galleryTitle(images[editIndex])} onChange={(e) => setMeta(editIndex, { title: e.target.value })} />
                        </Field>
                        <Field label="Caption (shown beneath the image in the lightbox)">
                            <input className="input" value={galleryCaption(images[editIndex])} onChange={(e) => setMeta(editIndex, { caption: e.target.value })} />
                        </Field>
                        <div className="flex justify-end">
                            <button type="button" onClick={() => setEditIndex(null)} className="btn-primary text-sm">Done</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}



// ─── Live-linked client gallery (gallery block) ───────────────────────────────

/**
 * Links a gallery block to a client-gallery Collection: photos are mirrored to
 * public copies and the block stays in sync — on "Sync now", on every Publish,
 * and nightly on the live site. While linked, manual image editing is off.
 */
function LinkedGalleryField({ d, onChange }: { d: Record<string, any>; onChange: (data: Record<string, unknown>) => void }) {
    const [collections, setCollections] = useState<{ id: number; title: string }[] | null>(null);
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const loadCollections = async () => {
        setPicking(true);
        if (collections) return;
        try {
            const res = await (window as any).axios.get(route('website.gallery.images'));
            setCollections((res.data.collections ?? []).map((c: any) => ({ id: c.id, title: c.title })));
        } catch {
            setCollections([]);
        }
    };

    const sync = async (collectionId: number) => {
        setBusy(true);
        setNotice(null);
        try {
            const res = await (window as any).axios.post(route('website.gallery.sync'), { collection_id: collectionId });
            onChange({ ...d, linked_collection_id: collectionId, linked_title: res.data.title, images: res.data.images });
            setNotice(`Synced ${res.data.count} photos from “${res.data.title}”. New photos fill in as they convert.`);
            setPicking(false);
        } catch (e: any) {
            setNotice(e?.response?.data?.message ?? 'Sync failed — try again.');
        } finally {
            setBusy(false);
        }
    };

    if (d.linked_collection_id) {
        return (
            <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-900">Linked to “{d.linked_title ?? 'client gallery'}”</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                    {Array.isArray(d.images) ? d.images.length : 0} photos · re-synced automatically on publish and nightly.
                </p>
                {notice && <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{notice}</p>}
                <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => sync(Number(d.linked_collection_id))} className="btn-secondary flex-1 justify-center py-1.5 text-xs">
                        {busy ? 'Syncing…' : 'Sync now'}
                    </button>
                    <button type="button" onClick={() => onChange({ ...d, linked_collection_id: null, linked_title: undefined })} className="btn-secondary flex-1 justify-center py-1.5 text-xs">
                        Unlink (keep photos)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {picking ? (
                <div className="rounded-lg border border-neutral-200 p-3">
                    <span className="label mb-1.5 block">Link a client gallery</span>
                    {collections === null ? (
                        <p className="text-xs text-neutral-400">Loading galleries…</p>
                    ) : collections.length === 0 ? (
                        <p className="text-xs text-neutral-400">No client galleries with ready photos yet.</p>
                    ) : (
                        <select className="input" defaultValue="" disabled={busy} onChange={(e) => e.target.value && sync(Number(e.target.value))}>
                            <option value="" disabled>{busy ? 'Syncing…' : 'Choose a gallery…'}</option>
                            {collections.map((c) => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                        </select>
                    )}
                    {notice && <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">{notice}</p>}
                    <button type="button" onClick={() => setPicking(false)} className="mt-2 text-xs text-neutral-500 hover:text-neutral-800">Cancel</button>
                </div>
            ) : (
                <button type="button" onClick={loadCollections} className="btn-secondary w-full justify-center py-2 text-xs">
                    Link a client gallery (stays in sync)
                </button>
            )}
        </div>
    );
}


// ─── AI headline suggestions (hero heading) ───────────────────────────────────

function HeadlineIdeas({ current, context, onPick }: { current: string; context?: string; onPick: (v: string) => void }) {
    const aiAvailable = !!(usePage().props as any).ai_available;
    const [busy, setBusy] = useState(false);
    const [ideas, setIdeas] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!aiAvailable) return null;

    const fetchIdeas = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await (window as any).axios.post(route('website.ai.headlines'), { text: current || 'A photography studio headline', context: context || null });
            setIdeas(res.data.headlines ?? []);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Could not fetch ideas.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="-mt-2">
            <button type="button" onClick={fetchIdeas} disabled={busy} className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50">
                {busy ? 'Thinking…' : ideas ? '✨ More ideas' : '✨ Suggest headlines'}
            </button>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            {ideas && ideas.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ideas.map((idea, i) => (
                        <button key={i} type="button" onClick={() => onPick(idea)} className="rounded-full border border-neutral-200 px-2.5 py-1 text-left text-xs text-neutral-700 transition hover:border-neutral-900" title="Use this headline">
                            {idea}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
