import BookingsSubNav from '@/Components/BookingsSubNav';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

interface BookingItem {
    id: number;
    client_name: string;
    client_email: string;
    client_phone: string | null;
    starts_at: string;
    ends_at: string;
    status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
    price_cents: number;
    currency: string;
    location: string | null;
    notes: string | null;
    meeting_url: string | null;
    session_type: { name: string; color: string | null } | null;
    contact_id: number | null;
}

const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
    cancelled: 'bg-neutral-200 text-neutral-600',
    completed: 'bg-blue-100 text-blue-700',
};

function fmtRange(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    const date = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${date} · ${t(s)} – ${t(e)}`;
}

export default function Index({
    bookings,
    filters,
    counts,
}: PageProps<{
    bookings: BookingItem[];
    filters: { status: string };
    counts: { pending: number; upcoming: number };
}>) {
    const setStatus = (status: string) =>
        router.get(route('bookings.index'), { status }, { preserveState: true, preserveScroll: true, replace: true });

    const act = (b: BookingItem, action: 'confirm' | 'decline' | 'cancel') => {
        if (action === 'cancel' && !confirm('Cancel this booking?')) return;
        router.post(route(`bookings.${action}`, b.id), {}, { preserveScroll: true });
    };

    const TABS = [
        { key: 'upcoming', label: `Upcoming${counts.upcoming ? ` (${counts.upcoming})` : ''}` },
        { key: 'pending', label: `Pending${counts.pending ? ` (${counts.pending})` : ''}` },
        { key: 'past', label: 'Past' },
        { key: 'all', label: 'All' },
    ];

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Bookings</h1>}>
            <Head title="Bookings" />
            <StudioManagerNav active="bookings" />
            <BookingsSubNav active="bookings" />

            <div className="px-4 py-6 sm:px-8">
                <div className="mb-4 flex gap-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setStatus(t.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                filters.status === t.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {bookings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No bookings here</p>
                        <p className="mt-1 text-sm text-neutral-400">
                            Share your booking page and new requests will land here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {bookings.map((b) => (
                            <div key={b.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-neutral-900">{b.client_name}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-neutral-500">
                                            {b.session_type?.name ?? 'Session'}
                                            {b.price_cents > 0 && <> · {formatMoney(b.price_cents, b.currency)}</>}
                                        </p>
                                        <p className="mt-1 text-sm text-neutral-700">{fmtRange(b.starts_at, b.ends_at)}</p>
                                        <p className="mt-0.5 text-xs text-neutral-400">
                                            {b.client_email}
                                            {b.client_phone ? ` · ${b.client_phone}` : ''}
                                            {b.location ? ` · ${b.location}` : ''}
                                        </p>
                                        {b.meeting_url && (
                                            <a href={b.meeting_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                                                Join video call
                                            </a>
                                        )}
                                        {b.notes && <p className="mt-1 text-xs italic text-neutral-400">“{b.notes}”</p>}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {b.contact_id && (
                                            <Link href={route('contacts.show', b.contact_id)} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
                                                View contact
                                            </Link>
                                        )}
                                        {b.status === 'pending' && (
                                            <>
                                                <button onClick={() => act(b, 'confirm')} className="btn-primary px-3 py-1.5 text-xs">Confirm</button>
                                                <button onClick={() => act(b, 'decline')} className="btn-secondary px-3 py-1.5 text-xs">Decline</button>
                                            </>
                                        )}
                                        {b.status === 'confirmed' && (
                                            <button onClick={() => act(b, 'cancel')} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
