import ColorPicker from '@/Components/ColorPicker';
import { BlockSettings, SiteBlock, SiteNavItem } from '@/types';
import { useState } from 'react';
import { ContentFields } from './editors/ContentFields';
import { ALIGN_ICONS, Section, SegIcon, Select, Text, Toggle } from './editors/fields';

// Re-exports so existing `@/Components/site/editors` imports keep working —
// the field primitives + per-block content editors live in ./editors/*.
export { ImageField } from './editors/fields';
export { HeroDesignFields } from './editors/HeroDesignFields';

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
        <div className="space-y-3">
            {block.type === 'hero' && (
                <Section title="Hero text style" defaultOpen>
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
                </Section>
            )}
            <Section title="Colours & text" defaultOpen>
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
            </Section>

            <Section title="Spacing & width">
                <div>
                    <span className="label mb-1.5 block">Padding</span>
                    <div className="grid grid-cols-2 gap-2">
                        <PadSelect label="Top" value={settings.pad_top ?? settings.padding} onChange={(v) => set({ pad_top: v })} />
                        <PadSelect label="Bottom" value={settings.pad_bottom ?? settings.padding} onChange={(v) => set({ pad_bottom: v })} />
                        <PadSelect label="Left" value={settings.pad_left} onChange={(v) => set({ pad_left: v })} />
                        <PadSelect label="Right" value={settings.pad_right} onChange={(v) => set({ pad_right: v })} />
                    </div>
                </div>
                <Select
                    label="Container width"
                    value={settings.width ?? 'default'}
                    onChange={(v) => set({ width: v === 'default' ? undefined : (v as BlockSettings['width']) })}
                    options={[
                        { value: 'default', label: 'Default' },
                        { value: 'sm', label: 'Narrow' },
                        { value: 'md', label: 'Medium' },
                        { value: 'lg', label: 'Wide' },
                        { value: 'full', label: 'Full width' },
                    ]}
                />
            </Section>

            <Section title="Effects & visibility">
                <Select
                    label="Scroll-in animation"
                    value={settings.animate ?? 'none'}
                    onChange={(v) => set({ animate: v === 'none' ? undefined : (v as BlockSettings['animate']) })}
                    options={[
                        { value: 'none', label: 'None' },
                        { value: 'fade', label: 'Fade in' },
                        { value: 'slide-up', label: 'Slide up' },
                    ]}
                />
                <div className="space-y-2">
                    <span className="label block">Visibility</span>
                    <Toggle label="Hide on phones" value={!!settings.hide_mobile} onChange={(v) => set({ hide_mobile: v || undefined })} />
                    <Toggle label="Hide on desktop" value={!!settings.hide_desktop} onChange={(v) => set({ hide_desktop: v || undefined })} />
                    <p className="text-xs text-neutral-400">Applies on the live site only — the builder always shows blocks so you can edit them.</p>
                </div>
            </Section>

            <Section title="Advanced">
                <Text
                    label="Custom class"
                    value={settings.class_name ?? ''}
                    onChange={(v) => set({ class_name: v.trim() ? v : undefined })}
                    placeholder="e.g. my-feature-row"
                />
                <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">The class is added to the block's wrapper so you can target it from <strong>Settings → Custom CSS</strong>.</p>
            </Section>
        </div>
    );
}

const PAD_OPTIONS = [
    { value: 'default', label: 'Default' },
    { value: 'none', label: 'None' },
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra large' },
];

function PadSelect({ label, value, onChange }: { label: string; value?: BlockSettings['padding']; onChange: (v: BlockSettings['padding']) => void }) {
    return (
        <Select
            label={label}
            value={value ?? 'default'}
            onChange={(v) => onChange(v === 'default' ? undefined : (v as BlockSettings['padding']))}
            options={PAD_OPTIONS}
        />
    );
}

// ─── Navigation editor (header / footer link lists) ───────────────────────────

export function NavEditor({ items, pages, onChange, allowExtras = false }: { items: SiteNavItem[]; pages: { title: string; slug: string }[]; onChange: (items: SiteNavItem[]) => void; allowExtras?: boolean }) {
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

    // Target picker (page select or URL input) — shared by items and sub-links.
    const targetFields = (item: SiteNavItem, set: (next: SiteNavItem) => void) => (
        <>
            <select
                className="input w-28 shrink-0"
                value={item.kind}
                onChange={(e) => set({ ...item, kind: e.target.value as SiteNavItem['kind'], target: e.target.value === 'page' ? pages[0]?.slug ?? 'home' : '' })}
            >
                <option value="page">Page</option>
                <option value="url">Link</option>
            </select>
            {item.kind === 'page' ? (
                <select className="input flex-1" value={item.target} onChange={(e) => set({ ...item, target: e.target.value })}>
                    {pages.map((p) => (
                        <option key={p.slug} value={p.slug}>{p.title}</option>
                    ))}
                </select>
            ) : (
                <input className="input flex-1" placeholder="https://… or #contact" value={item.target} onChange={(e) => set({ ...item, target: e.target.value })} />
            )}
        </>
    );

    return (
        <div className="space-y-2">
            {items.map((item, i) => {
                const children = item.children ?? [];
                const setChild = (ci: number, next: SiteNavItem) => update(i, { ...item, children: children.map((c, idx) => (idx === ci ? next : c)) });
                const removeChild = (ci: number) => {
                    const rest = children.filter((_, idx) => idx !== ci);
                    update(i, { ...item, children: rest.length ? rest : undefined });
                };
                const addChild = () => update(i, { ...item, children: [...children, { label: 'Sub-link', kind: 'page', target: pages[0]?.slug ?? 'home' }] });

                return (
                    <div key={i} className="rounded-lg border border-neutral-200 p-2.5">
                        <div className="flex items-center gap-1">
                            <input className="input flex-1" placeholder="Label" value={item.label} onChange={(e) => update(i, { ...item, label: e.target.value })} />
                            <button onClick={() => move(i, -1)} className="px-1 text-neutral-400 hover:text-neutral-700" title="Move up">↑</button>
                            <button onClick={() => move(i, 1)} className="px-1 text-neutral-400 hover:text-neutral-700" title="Move down">↓</button>
                            <button onClick={() => remove(i)} className="px-1 text-red-500 hover:text-red-700" title="Remove">✕</button>
                        </div>
                        <div className="mt-2 flex gap-2">
                            {targetFields(item, (next) => update(i, next))}
                            {allowExtras && (
                                <select
                                    className="input w-24 shrink-0"
                                    title="Show as a text link or a call-to-action button"
                                    value={item.style === 'button' ? 'button' : 'link'}
                                    onChange={(e) => update(i, { ...item, style: e.target.value === 'button' ? 'button' : undefined })}
                                >
                                    <option value="link">Link</option>
                                    <option value="button">Button</option>
                                </select>
                            )}
                        </div>

                        {/* One level of dropdown links (header only). */}
                        {allowExtras && item.style !== 'button' && (
                            <div className="mt-2 border-l-2 border-neutral-100 pl-3">
                                {children.map((child, ci) => (
                                    <div key={ci} className="mt-1.5 first:mt-0">
                                        <div className="flex items-center gap-1">
                                            <input className="input flex-1 py-1 text-sm" placeholder="Sub-link label" value={child.label} onChange={(e) => setChild(ci, { ...child, label: e.target.value })} />
                                            <button onClick={() => removeChild(ci)} className="px-1 text-red-500 hover:text-red-700" title="Remove sub-link">✕</button>
                                        </div>
                                        <div className="mt-1 flex gap-2">{targetFields(child, (next) => setChild(ci, next))}</div>
                                    </div>
                                ))}
                                <button type="button" onClick={addChild} className="mt-1.5 text-xs font-medium text-brand-700 hover:underline">
                                    + Add dropdown link
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
            <button type="button" onClick={add} className="btn-secondary w-full justify-center py-1.5 text-xs">+ Add link</button>
        </div>
    );
}
