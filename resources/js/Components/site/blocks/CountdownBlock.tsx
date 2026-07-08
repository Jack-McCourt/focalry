import { useEffect, useState } from 'react';
import { InlineText, containerW } from './ui';

/** Days/hours/minutes/seconds until a target date (SSR renders zeros; the
 *  client starts ticking on mount, so there's no hydration mismatch). */
export function CountdownBlock({ d, primary, width, onEditHeading, onEditSubheading }: { d: Record<string, any>; primary: string; width?: string; onEditHeading?: (v: string) => void; onEditSubheading?: (v: string) => void }) {
    const target = d.target ? new Date(d.target).getTime() : null;
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        setNow(Date.now());
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const remaining = target && now ? Math.max(0, target - now) : null;
    const finished = target !== null && now !== null && target - now <= 0;
    const parts = (() => {
        const total = Math.floor((remaining ?? 0) / 1000);
        return [
            { label: 'Days', value: Math.floor(total / 86400) },
            { label: 'Hours', value: Math.floor((total % 86400) / 3600) },
            { label: 'Minutes', value: Math.floor((total % 3600) / 60) },
            { label: 'Seconds', value: total % 60 },
        ];
    })();

    return (
        <section className={`mx-auto ${containerW(width, 'max-w-3xl')} px-6 py-16 text-center sm:px-10`}>
            {onEditHeading
                ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={onEditHeading} className="block text-3xl font-semibold tracking-tight text-neutral-900" />
                : d.heading && <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
            {onEditSubheading
                ? <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={onEditSubheading} className="mt-2 block text-neutral-500" />
                : d.subheading && <p className="mt-2 text-neutral-500">{d.subheading}</p>}

            {!target ? (
                <p className="mt-8 text-sm text-neutral-400">Set a date in the block settings.</p>
            ) : finished ? (
                <p className="mt-8 text-xl font-semibold" style={{ color: primary }}>{d.finished_message || 'The day is here!'}</p>
            ) : (
                <div className="mt-8 flex items-stretch justify-center gap-3 sm:gap-5">
                    {parts.map((p) => (
                        <div key={p.label} className="w-18 rounded-2xl bg-neutral-50 px-3 py-4 sm:w-24 sm:px-5">
                            <span className="block text-3xl font-bold tabular-nums tracking-tight sm:text-4xl" style={{ color: primary }}>
                                {String(p.value).padStart(2, '0')}
                            </span>
                            <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-neutral-400">{p.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
