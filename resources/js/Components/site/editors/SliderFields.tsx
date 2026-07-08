import type { SliderSlide } from '@/Components/site/blocks/data';
import { BlockEditorFieldsProps, Field, ImageField, ListEditor, Section, Select, Toggle } from './fields';
import { HeroDesignFields } from './HeroDesignFields';

/** The slider/carousel block's editor: slide list + playback + shared design. */
export function SliderFields({ d, onChange }: BlockEditorFieldsProps) {
    const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });
    const slides = (Array.isArray(d.slides) ? d.slides : []) as SliderSlide[];
            return (
                <div className="space-y-3">
                    <Section title="Slides" defaultOpen>
                        <ListEditor
                            items={slides}
                            onChange={(items) => set('slides', items)}
                            blank={{ image_url: '', heading: 'New slide', subheading: '', cta_label: '', cta_link: '', focal_x: 50, focal_y: 50, alt: '', title: '' }}
                            addLabel="Add slide"
                            render={(item, update) => {
                                const i = slides.indexOf(item);
                                return (
                                    <div className="space-y-2">
                                        <ImageField
                                            label="Slide image"
                                            value={item.image_url ?? ''}
                                            onChange={(v) => update({ ...item, image_url: v })}
                                            seo={{ alt: item.alt, title: item.title }}
                                            onSeoChange={(patch) => update({ ...item, ...patch })}
                                            focal={{ x: item.focal_x ?? 50, y: item.focal_y ?? 50 }}
                                            onFocalChange={(x, y) => update({ ...item, focal_x: x, focal_y: y })}
                                        />
                                        <input className="input" placeholder="Heading" value={item.heading ?? ''} onChange={(e) => update({ ...item, heading: e.target.value })} />
                                        <textarea className="input" rows={2} placeholder="Subheading" value={item.subheading ?? ''} onChange={(e) => update({ ...item, subheading: e.target.value })} />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input className="input" placeholder="Button label" value={item.cta_label ?? ''} onChange={(e) => update({ ...item, cta_label: e.target.value })} />
                                            <input className="input" placeholder="Button link" value={item.cta_link ?? ''} onChange={(e) => update({ ...item, cta_link: e.target.value })} />
                                        </div>
                                        {i > 0 || i < slides.length - 1 ? (
                                            <div className="flex gap-3 pt-0.5">
                                                <button type="button" disabled={i <= 0} onClick={() => { const n = [...slides]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set('slides', n); }} className="text-xs text-neutral-500 enabled:hover:text-neutral-900 disabled:opacity-30">↑ Move up</button>
                                                <button type="button" disabled={i >= slides.length - 1} onClick={() => { const n = [...slides]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set('slides', n); }} className="text-xs text-neutral-500 enabled:hover:text-neutral-900 disabled:opacity-30">↓ Move down</button>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            }}
                        />
                    </Section>

                    <Section title="Playback" hint="autoplay, arrows & dots">
                        <Toggle label="Autoplay" value={d.autoplay !== false} onChange={(v) => set('autoplay', v)} />
                        {d.autoplay !== false && (
                            <Field label="Seconds per slide">
                                <input type="number" min={1} max={30} className="input" value={Number(d.speed) || 5} onChange={(e) => set('speed', Number(e.target.value))} />
                            </Field>
                        )}
                        <Select label="Transition" value={d.transition ?? 'slide'} onChange={(v) => set('transition', v)} options={[{ value: 'slide', label: 'Slide' }, { value: 'fade', label: 'Fade' }]} />
                        <Toggle label="Show arrows" value={d.show_arrows !== false} onChange={(v) => set('show_arrows', v)} />
                        <Toggle label="Show dots" value={d.show_dots !== false} onChange={(v) => set('show_dots', v)} />
                    </Section>

                    <Section title="Slide design" hint="applies to every slide">
                        <p className="text-xs text-neutral-400">Tip: click a slide's heading in the preview to edit it in place.</p>
                        <HeroDesignFields data={d} onChange={(partial) => onChange({ ...d, ...partial })} />
                    </Section>
                </div>
            );
}
