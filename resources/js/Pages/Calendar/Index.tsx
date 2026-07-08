import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

type EventType = 'meeting' | 'shoot' | 'payment' | 'task';

interface CalEvent {
    date: string; // YYYY-MM-DD
    type: EventType;
    title: string;
    subtitle: string | null;
    time: string | null;
    color: string;
    url: string;
}
interface CalendarState {
    connected: boolean;
    email: string | null;
}
interface Props {
    month: string; // YYYY-MM
    prev: string;
    next: string;
    today: string;
    events: CalEvent[];
    calendar: CalendarState;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const LEGEND: { type: EventType; label: string; color: string }[] = [
    { type: 'meeting', label: 'Meetings', color: '#2a305d' },
    { type: 'shoot', label: 'Shoots', color: '#8b5cf6' },
    { type: 'payment', label: 'Payments due', color: '#f67952' },
    { type: 'task', label: 'Tasks', color: '#7079a4' },
];

function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Calendar({ month, prev, next, today, events, calendar }: Props) {
    const [y, m] = month.split('-').map(Number);
    const monthIndex = m - 1;

    const [hidden, setHidden] = useState<Set<EventType>>(new Set());
    const toggle = (t: EventType) =>
        setHidden((prev) => {
            const s = new Set(prev);
            s.has(t) ? s.delete(t) : s.add(t);
            return s;
        });

    const byDay = useMemo(() => {
        const map = new Map<string, CalEvent[]>();
        for (const e of events) {
            if (hidden.has(e.type)) continue;
            const arr = map.get(e.date);
            if (arr) arr.push(e);
            else map.set(e.date, [e]);
        }
        // Timed events (meetings) first, then the rest.
        for (const arr of map.values()) arr.sort((a, b) => (a.time ?? 'z').localeCompare(b.time ?? 'z'));
        return map;
    }, [events, hidden]);

    const cells = useMemo(() => {
        const first = new Date(y, monthIndex, 1);
        const offset = (first.getDay() + 6) % 7; // Monday-start
        const daysInMonth = new Date(y, monthIndex + 1, 0).getDate();
        const total = Math.ceil((offset + daysInMonth) / 7) * 7;
        return Array.from({ length: total }, (_, i) => new Date(y, monthIndex, 1 - offset + i));
    }, [y, monthIndex]);

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Calendar</h1>}>
            <Head title="Calendar" />

            <div className="px-4 py-8 sm:px-8">
                {/* Header / controls */}
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-2xl font-light text-neutral-900">
                        {MONTHS[monthIndex]} {y}
                    </h2>
                    <div className="flex items-center gap-1">
                        <Link href={route('calendar.index', { month: prev })} preserveScroll className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" title="Previous month">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </Link>
                        <Link href={route('calendar.index')} preserveScroll className="rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100">
                            Today
                        </Link>
                        <Link href={route('calendar.index', { month: next })} preserveScroll className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" title="Next month">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </Link>
                    </div>
                </div>

                {/* Google Calendar sync */}
                <div className="mb-4 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <svg className="h-6 w-6 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                        <div>
                            <p className="text-sm font-medium text-neutral-900">Google Calendar</p>
                            {calendar.connected ? (
                                <p className="text-xs text-emerald-600">Connected{calendar.email ? ` · ${calendar.email}` : ''} — confirmed meetings sync and invite both parties automatically.</p>
                            ) : (
                                <p className="text-xs text-neutral-500">Connect to add confirmed meetings to your calendar, email invites to both parties, and auto-create Google Meet links.</p>
                            )}
                        </div>
                    </div>
                    {calendar.connected ? (
                        <button
                            type="button"
                            onClick={async () => (await confirmDialog('Disconnect Google Calendar? New meetings will no longer sync.')) && router.delete(route('google-calendar.disconnect'))}
                            className="btn-secondary px-3 py-1.5 text-xs"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <a href={route('google-calendar.connect')} className="btn-primary px-3 py-1.5 text-xs">Connect</a>
                    )}
                </div>

                {/* Legend / filters */}
                <div className="mb-4 flex flex-wrap gap-2">
                    {LEGEND.map((l) => {
                        const off = hidden.has(l.type);
                        return (
                            <button
                                key={l.type}
                                onClick={() => toggle(l.type)}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                    off ? 'border-neutral-200 text-neutral-300' : 'border-neutral-300 text-neutral-700'
                                }`}
                            >
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: off ? '#d4d4d4' : l.color }} />
                                {l.label}
                            </button>
                        );
                    })}
                </div>

                {/* Calendar grid */}
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <div className="grid grid-cols-7 border-b border-neutral-100 text-center text-xs font-medium text-neutral-400">
                        {WEEKDAYS.map((w) => (
                            <div key={w} className="py-2">
                                {w}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {cells.map((date, i) => {
                            const key = ymd(date);
                            const inMonth = date.getMonth() === monthIndex;
                            const dayEvents = byDay.get(key) ?? [];
                            const shown = dayEvents.slice(0, 4);
                            return (
                                <div
                                    key={i}
                                    className={`min-h-[7rem] border-b border-r border-neutral-100 p-1.5 ${i % 7 === 6 ? 'border-r-0' : ''} ${inMonth ? 'bg-white' : 'bg-neutral-50/50'}`}
                                >
                                    <div className={`mb-1 text-right text-xs ${key === today ? 'font-semibold text-neutral-900' : inMonth ? 'text-neutral-500' : 'text-neutral-300'}`}>
                                        {key === today ? (
                                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white">{date.getDate()}</span>
                                        ) : (
                                            date.getDate()
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {shown.map((e, j) => (
                                            <button
                                                key={j}
                                                onClick={() => router.visit(e.url)}
                                                className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-neutral-50"
                                                title={`${e.time ? e.time + ' · ' : ''}${e.title}${e.subtitle ? ' — ' + e.subtitle : ''}`}
                                            >
                                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                                                {e.time && <span className="shrink-0 text-neutral-400">{e.time}</span>}
                                                <span className="truncate font-medium text-neutral-700">{e.title}</span>
                                            </button>
                                        ))}
                                        {dayEvents.length > shown.length && (
                                            <p className="px-1.5 text-[11px] text-neutral-400">+{dayEvents.length - shown.length} more</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
