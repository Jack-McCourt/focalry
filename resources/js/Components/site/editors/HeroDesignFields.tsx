import ColorPicker from '@/Components/ColorPicker';
import { ALIGN_ICONS, Field, SegIcon, Select, posIcon } from './fields';

// ─── Hero design controls (shared: hero block + post header) ──────────────────

/**
 * The hero's visual formatting controls (everything except the content itself:
 * heading/image/button). Reused for the blog post header so it offers exactly
 * the same options. Operates on a loose data object via `onChange(partial)`.
 */
export function HeroDesignFields({ data, onChange }: { data: Record<string, any>; onChange: (partial: Record<string, unknown>) => void }) {
    const d = data ?? {};
    const set = (key: string, val: unknown) => onChange({ [key]: val });

    return (
        <div className="space-y-4">
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
            <Select
                label="Title size"
                value={d.title_size ?? 'lg'}
                onChange={(v) => set('title_size', v)}
                options={[
                    { value: 'sm', label: 'Small' },
                    { value: 'md', label: 'Medium' },
                    { value: 'lg', label: 'Large' },
                    { value: 'xl', label: 'Extra large' },
                ]}
            />
            <Select
                label="Text shadow"
                value={d.text_shadow ?? 'none'}
                onChange={(v) => set('text_shadow', v)}
                options={[
                    { value: 'none', label: 'None' },
                    { value: 'soft', label: 'Soft' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'strong', label: 'Strong' },
                ]}
            />
            <SegIcon
                label="Text alignment"
                value={d.text_align ?? 'center'}
                onChange={(v) => set('text_align', v)}
                options={[
                    { value: 'left', title: 'Align left', icon: ALIGN_ICONS.left },
                    { value: 'center', title: 'Align centre', icon: ALIGN_ICONS.center },
                    { value: 'right', title: 'Align right', icon: ALIGN_ICONS.right },
                ]}
            />
            <SegIcon
                label="Content position — horizontal"
                value={d.content_x ?? 'center'}
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
}
