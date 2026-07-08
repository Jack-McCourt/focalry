import { useRef, useState } from 'react';
import { InlineText, RetryImg, containerW } from './ui';

/** Two stacked images with a draggable divider (pointer + keyboard via range). */
export function BeforeAfterBlock({ d, width, onEditHeading }: { d: Record<string, any>; width?: string; onEditHeading?: (v: string) => void }) {
    const [pos, setPos] = useState(50);
    const ref = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const setFromClientX = (clientX: number) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setPos(Math.max(2, Math.min(98, Math.round(((clientX - r.left) / r.width) * 100))));
    };

    const empty = !d.before_url && !d.after_url;

    return (
        <section className={`mx-auto ${containerW(width, 'max-w-4xl')} px-6 py-16 sm:px-10`}>
            {onEditHeading
                ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading (optional)" onChange={onEditHeading} className="mb-8 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                : d.heading && <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}

            {empty ? (
                <div className="flex aspect-[3/2] items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">
                    Add a before and an after image
                </div>
            ) : (
                <div
                    ref={ref}
                    className="relative aspect-[3/2] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl"
                    onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setFromClientX(e.clientX); }}
                    onPointerMove={(e) => { if (dragging.current) setFromClientX(e.clientX); }}
                    onPointerUp={() => { dragging.current = false; }}
                >
                    {d.after_url
                        ? <RetryImg src={d.after_url} alt={d.alt || 'After'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        : <div className="absolute inset-0 bg-neutral-200" />}
                    <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
                        {d.before_url
                            ? <RetryImg src={d.before_url} alt={d.alt || 'Before'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                            : <div className="absolute inset-0 bg-neutral-300" />}
                    </div>
                    {/* Divider + handle */}
                    <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
                        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" />
                        <div className="absolute top-1/2 -ml-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md">
                            <svg className="h-4 w-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5L3.75 12l4.5 7.5m7.5-15l4.5 7.5-4.5 7.5" /></svg>
                        </div>
                    </div>
                    {d.before_label && <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">{d.before_label}</span>}
                    {d.after_label && <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">{d.after_label}</span>}
                    {/* Keyboard access */}
                    <input type="range" min={2} max={98} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Compare before and after" className="absolute bottom-2 left-1/2 w-40 -translate-x-1/2 opacity-0 focus:opacity-100" />
                </div>
            )}
        </section>
    );
}
