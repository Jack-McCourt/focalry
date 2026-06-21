import { Head, Link, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';

interface StudioRef {
    name: string;
    slug: string;
    logo_url: string | null;
}

interface MeetingTypeRef {
    slug: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    location_type: 'video' | 'phone' | 'in_person';
    location: string | null;
    video_provider: 'google_meet' | 'zoom';
    color: string | null;
}

const LOCATION_LABELS: Record<string, string> = {
    video: 'Video call',
    phone: 'Phone call',
    in_person: 'In person',
};

export default function Book({
    studio,
    meetingType,
    slots,
}: {
    studio: StudioRef;
    meetingType: MeetingTypeRef;
    slots: Record<string, string[]>;
}) {
    const dates = useMemo(() => Object.keys(slots).sort(), [slots]);
    const [selectedDate, setSelectedDate] = useState<string | null>(dates[0] ?? null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    const { data, setData, post, processing, errors } = useForm({
        starts_at: '',
        client_name: '',
        client_email: '',
        client_phone: '',
        notes: '',
    });

    const pickSlot = (iso: string) => {
        setSelectedSlot(iso);
        setData('starts_at', iso);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('meetings.public.store', { slug: studio.slug, type: meetingType.slug }));
    };

    const fmtDate = (d: string) =>
        new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    // ── Month calendar ──
    const available = useMemo(() => new Set(dates), [dates]);
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayISO = toISO(new Date());
    const thisMonth = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); };
    const startMonth = useMemo(() => {
        const first = dates[0] ? new Date(dates[0] + 'T00:00:00') : new Date();
        return new Date(first.getFullYear(), first.getMonth(), 1);
    }, [dates]);
    const [month, setMonth] = useState(startMonth);

    const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const cells: (string | null)[] = [];
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(month.getFullYear(), month.getMonth(), d)));
    const canPrev = month > thisMonth();
    const shiftMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

    const pickDate = (iso: string) => { setSelectedDate(iso); setSelectedSlot(null); setData('starts_at', ''); };

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <div className="min-h-screen bg-neutral-50">
            <Head title={`Book ${meetingType.name}`} />
            <div className="mx-auto max-w-2xl px-4 py-12">
                <Link href={route('meetings.public.studio', studio.slug)} className="text-sm text-neutral-400 hover:text-neutral-700">← All meetings</Link>

                <div className="mt-3 mb-6">
                    <h1 className="text-2xl font-semibold text-neutral-900">{meetingType.name}</h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        {meetingType.duration_minutes} min · {LOCATION_LABELS[meetingType.location_type]}
                        {meetingType.location ? ` · ${meetingType.location}` : ''}
                    </p>
                    {meetingType.description && <p className="mt-3 text-sm text-neutral-600">{meetingType.description}</p>}
                </div>

                {dates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
                        No open times in the next 60 days. Please check back later.
                    </div>
                ) : (
                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        {/* Step 1: date — month calendar */}
                        <div className="mb-3 flex items-center justify-between">
                            <button type="button" onClick={() => shiftMonth(-1)} disabled={!canPrev} className="rounded-md p-1.5 text-neutral-500 enabled:hover:bg-neutral-100 disabled:opacity-30" aria-label="Previous month">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                            </button>
                            <span className="text-sm font-semibold text-neutral-900">{monthLabel}</span>
                            <button type="button" onClick={() => shiftMonth(1)} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Next month">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
                        </div>
                        <div className="mt-1 grid grid-cols-7 gap-1">
                            {cells.map((iso, i) => {
                                if (!iso) return <div key={i} />;
                                const isAvail = available.has(iso);
                                const isPast = iso < todayISO;
                                const day = Number(iso.slice(-2));
                                const selected = selectedDate === iso;
                                // Green dot = bookable, red dot = no availability (today onward).
                                const dot = isAvail ? 'bg-emerald-500' : isPast ? '' : 'bg-red-400';
                                return (
                                    <button
                                        key={iso}
                                        type="button"
                                        disabled={!isAvail}
                                        onClick={() => pickDate(iso)}
                                        className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm transition ${
                                            selected ? 'bg-neutral-900 font-semibold text-white'
                                                : isAvail ? 'font-medium text-neutral-800 hover:bg-neutral-100 ring-1 ring-inset ring-neutral-200'
                                                : 'text-neutral-300'
                                        }`}
                                    >
                                        {day}
                                        <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : dot}`} />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Step 2: time */}
                        {selectedDate && (
                            <>
                                <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-neutral-400">Pick a time</p>
                                <div className="flex flex-wrap gap-2">
                                    {(slots[selectedDate] ?? []).map((iso) => (
                                        <button
                                            key={iso}
                                            onClick={() => pickSlot(iso)}
                                            className={`rounded-lg border px-3 py-2 text-sm transition ${
                                                selectedSlot === iso ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                                            }`}
                                        >
                                            {fmtTime(iso)}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Step 3: details */}
                        {selectedSlot && (
                            <form onSubmit={submit} className="mt-6 space-y-4 border-t border-neutral-100 pt-5">
                                <p className="text-sm text-neutral-600">
                                    Booking <span className="font-medium text-neutral-900">{fmtDate(selectedDate!)} at {fmtTime(selectedSlot)}</span>
                                </p>
                                <div>
                                    <span className="label">Your name</span>
                                    <input className={field} value={data.client_name} onChange={(e) => setData('client_name', e.target.value)} />
                                    {errors.client_name && <p className="mt-1 text-xs text-red-600">{errors.client_name}</p>}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <span className="label">Email</span>
                                        <input type="email" className={field} value={data.client_email} onChange={(e) => setData('client_email', e.target.value)} />
                                        {errors.client_email && <p className="mt-1 text-xs text-red-600">{errors.client_email}</p>}
                                    </div>
                                    <div>
                                        <span className="label">Phone (optional)</span>
                                        <input className={field} value={data.client_phone} onChange={(e) => setData('client_phone', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <span className="label">Anything we should know? (optional)</span>
                                    <textarea className={field} rows={3} value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                                </div>
                                {errors.starts_at && <p className="text-xs text-red-600">{errors.starts_at}</p>}
                                <button type="submit" disabled={processing} className="btn-primary w-full justify-center">
                                    {processing ? 'Booking…' : 'Confirm booking'}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
