import { formatMoney } from '@/lib/money';
import { Head, Link, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';

interface StudioRef {
    name: string;
    slug: string;
    logo_url: string | null;
}

interface SessionTypeRef {
    slug: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
    currency: string;
    location_type: 'in_person' | 'phone' | 'video';
    location: string | null;
    color: string | null;
}

const LOCATION_LABELS: Record<string, string> = {
    in_person: 'In person',
    phone: 'Phone call',
    video: 'Video call',
};

export default function Book({
    studio,
    sessionType,
    slots,
}: {
    studio: StudioRef;
    sessionType: SessionTypeRef;
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
        post(route('booking.store', { slug: studio.slug, type: sessionType.slug }));
    };

    const fmtDate = (d: string) =>
        new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <div className="min-h-screen bg-neutral-50">
            <Head title={`Book ${sessionType.name}`} />
            <div className="mx-auto max-w-2xl px-4 py-12">
                <Link href={route('booking.studio', studio.slug)} className="text-sm text-neutral-400 hover:text-neutral-700">← All sessions</Link>

                <div className="mt-3 mb-6">
                    <h1 className="text-2xl font-semibold text-neutral-900">{sessionType.name}</h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        {sessionType.duration_minutes} min · {LOCATION_LABELS[sessionType.location_type]}
                        {sessionType.price_cents > 0 ? ` · ${formatMoney(sessionType.price_cents, sessionType.currency)}` : ' · Free'}
                        {sessionType.location ? ` · ${sessionType.location}` : ''}
                    </p>
                    {sessionType.description && <p className="mt-3 text-sm text-neutral-600">{sessionType.description}</p>}
                </div>

                {dates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
                        No open times in the next 60 days. Please check back later.
                    </div>
                ) : (
                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        {/* Step 1: date */}
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Pick a date</p>
                        <div className="flex flex-wrap gap-2">
                            {dates.map((d) => (
                                <button
                                    key={d}
                                    onClick={() => { setSelectedDate(d); setSelectedSlot(null); setData('starts_at', ''); }}
                                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                                        selectedDate === d ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                                    }`}
                                >
                                    {fmtDate(d)}
                                </button>
                            ))}
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
