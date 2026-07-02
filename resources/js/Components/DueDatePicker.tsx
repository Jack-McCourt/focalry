import { useEffect, useId, useMemo, useRef, useState } from 'react';

function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toISO(d);
}

/** Apply a mutation to a copy of an anchor date and return the Y-m-d string. */
function shifted(anchorISO: string, mutate: (d: Date) => void): string {
    const d = new Date(anchorISO + 'T00:00:00');
    mutate(d);
    return toISO(d);
}

/**
 * Pixieset-style "Payment Due" picker: a field that opens a popover with a
 * month calendar on the left and relative-date presets ("Within 7 days", …)
 * on the right. Emits a Y-m-d string.
 */
export default function DueDatePicker({
    value,
    onChange,
    placeholder = 'Pick a date',
    className = '',
    align = 'left',
    dueDate,
    bordered = true,
}: {
    value: string;
    onChange: (iso: string) => void;
    placeholder?: string;
    className?: string;
    align?: 'left' | 'right';
    /** When set, enables the "… before due date" presets relative to this Y-m-d. */
    dueDate?: string;
    /** Draw a border around the trigger field. */
    bordered?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const labelId = useId();

    const selected = value || '';
    const initialMonth = useMemo(() => {
        const base = selected ? new Date(selected + 'T00:00:00') : new Date();
        return new Date(base.getFullYear(), base.getMonth(), 1);
    }, [selected]);
    const [month, setMonth] = useState(initialMonth);

    // Re-anchor the visible month whenever the value changes from outside.
    useEffect(() => setMonth(initialMonth), [initialMonth]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Presets relative to today, plus (when a reference due date exists) presets
    // counted back from that due date.
    const presets = useMemo(() => {
        const list: { label: string; iso: string }[] = [
            { label: 'Within 1 week', iso: shifted(todayISO(), (d) => d.setDate(d.getDate() + 7)) },
            { label: 'Within 1 month', iso: shifted(todayISO(), (d) => d.setMonth(d.getMonth() + 1)) },
            { label: 'Within 6 months', iso: shifted(todayISO(), (d) => d.setMonth(d.getMonth() + 6)) },
        ];
        if (dueDate) {
            list.push(
                { label: '1 week before due date', iso: shifted(dueDate, (d) => d.setDate(d.getDate() - 7)) },
                { label: '1 month before due date', iso: shifted(dueDate, (d) => d.setMonth(d.getMonth() - 1)) },
                { label: '6 months before due date', iso: shifted(dueDate, (d) => d.setMonth(d.getMonth() - 6)) },
            );
        }
        return list;
    }, [dueDate]);

    const presetLabel = presets.find((p) => p.iso === selected)?.label ?? null;

    const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const pickPreset = (iso: string) => {
        onChange(iso);
        setOpen(false);
    };

    // Calendar grid for the visible month.
    const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(month.getFullYear(), month.getMonth(), d)));
    const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

    return (
        <div ref={wrapRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`input flex w-full items-center justify-between gap-2 text-left ${bordered ? 'border border-neutral-200' : 'border-0 px-0 shadow-none focus:ring-0'}`}
            >
                <span className={selected ? 'text-neutral-800' : 'text-neutral-500'}>
                    {selected ? fmtDate(selected) : placeholder}
                </span>
                <span className="flex items-center gap-1.5 text-neutral-500">
                    {presetLabel && <span className="text-xs">{presetLabel}</span>}
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                </span>
            </button>

            {open && (
                <div
                    aria-labelledby={labelId}
                    className={`absolute z-30 mt-2 flex rounded-xl border border-neutral-200 bg-white shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    {/* Calendar */}
                    <div className="w-64 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <span id={labelId} className="text-sm font-semibold text-neutral-900">{monthLabel}</span>
                            <div className="flex gap-1">
                                <button type="button" onClick={() => shiftMonth(-1)} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Previous month">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                                </button>
                                <button type="button" onClick={() => shiftMonth(1)} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Next month">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-neutral-500">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
                        </div>
                        <div className="mt-1 grid grid-cols-7 gap-1">
                            {cells.map((iso, i) => {
                                if (!iso) return <div key={i} />;
                                const day = Number(iso.slice(-2));
                                const isSelected = iso === selected;
                                const past = iso < todayISO();
                                return (
                                    <button
                                        key={iso}
                                        type="button"
                                        disabled={past}
                                        onClick={() => { onChange(iso); setOpen(false); }}
                                        className={`flex aspect-square items-center justify-center rounded-lg text-sm transition ${
                                            isSelected ? 'bg-emerald-500 font-semibold text-white'
                                                : past ? 'cursor-not-allowed text-neutral-300'
                                                : 'text-neutral-700 hover:bg-neutral-100'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="w-52 border-l border-neutral-100 py-3">
                        {presets.map((p) => {
                            const past = p.iso < todayISO();
                            return (
                                <button
                                    key={p.label}
                                    type="button"
                                    disabled={past}
                                    onClick={() => pickPreset(p.iso)}
                                    title={past ? 'That date is in the past' : undefined}
                                    className={`block w-full px-4 py-2 text-left text-sm transition ${
                                        past ? 'cursor-not-allowed text-neutral-300'
                                            : p.iso === selected ? 'font-semibold text-emerald-600 hover:bg-neutral-50'
                                            : 'text-neutral-700 hover:bg-neutral-50'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
