import { dotStyle, pillStyle } from '@/lib/projectColors';
import { Project, ProjectStatus, ProjectType } from '@/types';
import { useMemo, useState } from 'react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProjectCalendar({
    projects,
    statuses,
    types,
    onOpen,
}: {
    projects: Project[];
    statuses: ProjectStatus[];
    types: ProjectType[];
    onOpen: (id: number) => void;
}) {
    const today = new Date();
    const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

    const typeColor = (id: number | null) => types.find((t) => t.id === id)?.color ?? '#9ca3af';
    const statusColor = (id: number | null) => statuses.find((s) => s.id === id)?.color ?? '#9ca3af';

    // event_date (YYYY-MM-DD) → projects on that day.
    const byDay = useMemo(() => {
        const map = new Map<string, Project[]>();
        for (const p of projects) {
            if (!p.event_date) continue;
            const key = p.event_date.slice(0, 10);
            const arr = map.get(key);
            if (arr) arr.push(p);
            else map.set(key, [p]);
        }
        return map;
    }, [projects]);

    const cells = useMemo(() => {
        const first = new Date(cursor.y, cursor.m, 1);
        const offset = (first.getDay() + 6) % 7; // Monday-start
        const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
        const total = Math.ceil((offset + daysInMonth) / 7) * 7;
        return Array.from({ length: total }, (_, i) => new Date(cursor.y, cursor.m, 1 - offset + i));
    }, [cursor]);

    const todayKey = ymd(today);
    const step = (delta: number) => {
        const d = new Date(cursor.y, cursor.m + delta, 1);
        setCursor({ y: d.getFullYear(), m: d.getMonth() });
    };

    return (
        <div className="rounded-xl border border-neutral-200 bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                    {MONTHS[cursor.m]} {cursor.y}
                </h3>
                <div className="flex items-center gap-1">
                    <button onClick={() => step(-1)} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" title="Previous month">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <button onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })} className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100">
                        Today
                    </button>
                    <button onClick={() => step(1)} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" title="Next month">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 border-b border-neutral-100 text-center text-xs font-medium text-neutral-400">
                {WEEKDAYS.map((w) => (
                    <div key={w} className="py-2">{w}</div>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
                {cells.map((date, i) => {
                    const key = ymd(date);
                    const inMonth = date.getMonth() === cursor.m;
                    const dayProjects = byDay.get(key) ?? [];
                    return (
                        <div
                            key={i}
                            className={`min-h-[6.5rem] border-b border-r border-neutral-100 p-1.5 ${i % 7 === 6 ? 'border-r-0' : ''} ${inMonth ? 'bg-white' : 'bg-neutral-50/50'}`}
                        >
                            <div className={`mb-1 text-right text-xs ${key === todayKey ? 'font-semibold text-neutral-900' : inMonth ? 'text-neutral-500' : 'text-neutral-300'}`}>
                                {key === todayKey ? (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white">{date.getDate()}</span>
                                ) : (
                                    date.getDate()
                                )}
                            </div>
                            <div className="space-y-1">
                                {dayProjects.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => onOpen(p.id)}
                                        className="flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left text-xs font-medium"
                                        style={pillStyle(typeColor(p.type_id))}
                                        title={p.name}
                                    >
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={dotStyle(statusColor(p.status_id))} />
                                        <span className="truncate">{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
