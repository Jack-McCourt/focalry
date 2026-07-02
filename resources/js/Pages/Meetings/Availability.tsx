import MeetingsSubNav from '@/Components/MeetingsSubNav';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface Rule {
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface ZoomState {
    connected: boolean;
    email: string | null;
    configured: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Availability({
    rules,
    blocked_dates,
    block_project_dates,
    project_dates,
    timezone,
    timezones,
    zoom,
}: PageProps<{
    rules: Rule[];
    blocked_dates: string[];
    block_project_dates: boolean;
    project_dates: string[];
    timezone: string;
    timezones: string[];
    zoom: ZoomState;
}>) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm<{
        rules: Rule[];
        blocked_dates: string[];
        block_project_dates: boolean;
        timezone: string;
    }>({ rules, blocked_dates, block_project_dates, timezone });

    const [blockFrom, setBlockFrom] = useState('');
    const [blockTo, setBlockTo] = useState('');

    // Every date from → to inclusive, as Y-m-d strings.
    const datesInRange = (from: string, to: string): string[] => {
        const out: string[] = [];
        const start = new Date(from + 'T00:00:00');
        const end = new Date((to || from) + 'T00:00:00');
        if (end < start) return [];
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        return out;
    };

    const addBlock = () => {
        if (!blockFrom) return;
        const range = datesInRange(blockFrom, blockTo || blockFrom);
        if (range.length === 0) return;
        const merged = Array.from(new Set([...data.blocked_dates, ...range])).sort();
        setData('blocked_dates', merged);
        // Persist immediately so the block takes effect without a separate save.
        router.post(route('availability.block'), { dates: range }, { preserveScroll: true, preserveState: true });
        setBlockFrom('');
        setBlockTo('');
    };

    const removeBlock = (date: string) => {
        setData('blocked_dates', data.blocked_dates.filter((x) => x !== date));
        router.delete(route('availability.unblock'), { data: { date }, preserveScroll: true, preserveState: true });
    };

    const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const addWindow = (dow: number) =>
        setData('rules', [...data.rules, { day_of_week: dow, start_time: '09:00', end_time: '17:00' }]);

    const updateWindow = (index: number, patchObj: Partial<Rule>) => {
        const next = [...data.rules];
        next[index] = { ...next[index], ...patchObj };
        setData('rules', next);
    };

    const removeWindow = (index: number) => setData('rules', data.rules.filter((_, i) => i !== index));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('availability.update'), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Meetings</h1>}>
            <Head title="Availability" />
            <StudioManagerNav active="meetings" />
            <MeetingsSubNav active="availability" />

            <div className="px-4 py-6 sm:px-8">
                <p className="mb-6 max-w-2xl text-sm text-neutral-500">
                    Connect Google Calendar from the{' '}
                    <Link href={route('calendar.index')} className="font-medium text-blue-600 hover:text-blue-800">Calendar</Link> page.
                </p>

                {/* Zoom connection */}
                <div className="mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <svg className="h-6 w-6 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
                        <div>
                            <p className="text-sm font-medium text-neutral-900">Zoom</p>
                            {!zoom.configured ? (
                                <p className="text-xs text-neutral-500">Zoom isn’t configured on the server yet (ZOOM_CLIENT_ID/SECRET).</p>
                            ) : zoom.connected ? (
                                <p className="text-xs text-emerald-600">Connected{zoom.email ? ` · ${zoom.email}` : ''} — video meetings set to Zoom get a Zoom link automatically.</p>
                            ) : (
                                <p className="text-xs text-neutral-500">Connect to auto-create Zoom links for meeting types set to Zoom.</p>
                            )}
                        </div>
                    </div>
                    {zoom.configured && (zoom.connected ? (
                        <button
                            type="button"
                            onClick={() => confirm('Disconnect Zoom? New Zoom meetings will no longer be created automatically.') && router.delete(route('zoom.disconnect'))}
                            className="btn-secondary px-3 py-1.5 text-xs"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <a href={route('zoom.connect')} className="btn-primary px-3 py-1.5 text-xs">Connect</a>
                    ))}
                </div>

                <form onSubmit={submit} className="max-w-2xl">
                    <p className="mb-3 text-sm text-neutral-500">
                        Set the hours you accept meetings each week. Open time slots are generated from these hours
                        minus existing meetings.
                    </p>

                    <div className="mb-4">
                        <label className="text-sm font-medium text-neutral-800">Timezone</label>
                        <p className="mb-1.5 text-xs text-neutral-500">All availability hours and booking times are interpreted in this timezone.</p>
                        <select
                            value={data.timezone}
                            onChange={(e) => setData('timezone', e.target.value)}
                            className="block w-full max-w-xs rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
                        >
                            {timezones.map((tz) => (
                                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                        {DAYS.map((label, dow) => {
                            const windows = data.rules
                                .map((r, i) => ({ r, i }))
                                .filter(({ r }) => r.day_of_week === dow);
                            return (
                                <div key={dow} className="flex items-start gap-4 p-4">
                                    <div className="w-28 shrink-0 pt-1.5 text-sm font-medium text-neutral-800">{label}</div>
                                    <div className="flex-1 space-y-2">
                                        {windows.length === 0 && <p className="py-1.5 text-sm text-neutral-400">Unavailable</p>}
                                        {windows.map(({ r, i }) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={r.start_time}
                                                    onChange={(e) => updateWindow(i, { start_time: e.target.value })}
                                                    className="rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
                                                />
                                                <span className="text-neutral-400">–</span>
                                                <input
                                                    type="time"
                                                    value={r.end_time}
                                                    onChange={(e) => updateWindow(i, { end_time: e.target.value })}
                                                    className="rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
                                                />
                                                <button type="button" onClick={() => removeWindow(i)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Remove">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => addWindow(dow)} className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800">
                                        + Add hours
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time off / blocked dates */}
                    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-sm font-medium text-neutral-900">Time off</p>
                        <p className="mt-0.5 text-xs text-neutral-500">Block a single day or a date range so no one can book them. Changes here save automatically.</p>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                            <label className="text-xs text-neutral-500">
                                <span className="mb-1 block">From</span>
                                <input type="date" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} className="rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900" />
                            </label>
                            <label className="text-xs text-neutral-500">
                                <span className="mb-1 block">To <span className="text-neutral-400">(optional)</span></span>
                                <input type="date" value={blockTo} min={blockFrom || undefined} onChange={(e) => setBlockTo(e.target.value)} className="rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900" />
                            </label>
                            <button type="button" onClick={addBlock} disabled={!blockFrom} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Block days</button>
                        </div>
                        {data.blocked_dates.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {data.blocked_dates.map((d) => (
                                    <span key={d} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
                                        {fmtDay(d)}
                                        <button type="button" onClick={() => removeBlock(d)} className="text-neutral-400 hover:text-red-600">✕</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <label className="mt-4 flex items-start gap-2 border-t border-neutral-100 pt-4 text-sm text-neutral-700">
                            <input type="checkbox" checked={data.block_project_dates} onChange={(e) => setData('block_project_dates', e.target.checked)} className="mt-0.5 rounded border-neutral-300" />
                            <span>
                                Block days that already have a project
                                <span className="block text-xs text-neutral-400">
                                    Days matching a project's event date won't be bookable{project_dates.length > 0 ? ` (${project_dates.length} upcoming)` : ''}.
                                </span>
                            </span>
                        </label>
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save availability'}</button>
                        {recentlySuccessful && <span className="text-sm text-neutral-500">Saved.</span>}
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
