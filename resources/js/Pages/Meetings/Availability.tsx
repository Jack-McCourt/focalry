import MeetingsSubNav from '@/Components/MeetingsSubNav';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';

interface Rule {
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface CalendarState {
    connected: boolean;
    email: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Availability({
    rules,
    timezone,
    calendar,
}: PageProps<{ rules: Rule[]; timezone: string; calendar: CalendarState }>) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm<{ rules: Rule[] }>({ rules });

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
                {/* Google Calendar connection */}
                <div className="mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
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
                            onClick={() => confirm('Disconnect Google Calendar? New meetings will no longer sync.') && router.delete(route('google-calendar.disconnect'))}
                            className="btn-secondary px-3 py-1.5 text-xs"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <a href={route('google-calendar.connect')} className="btn-primary px-3 py-1.5 text-xs">Connect</a>
                    )}
                </div>

                <form onSubmit={submit} className="max-w-2xl">
                    <p className="mb-4 text-sm text-neutral-500">
                        Set the hours you accept meetings each week. Open time slots are generated from these hours
                        minus existing meetings. Times are in <span className="font-medium text-neutral-700">{timezone}</span>.
                    </p>

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

                    <div className="mt-4 flex items-center gap-4">
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save availability'}</button>
                        {recentlySuccessful && <span className="text-sm text-neutral-500">Saved.</span>}
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
