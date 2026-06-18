import { Head } from '@inertiajs/react';

interface StudioRef {
    name: string;
    slug: string;
    logo_url: string | null;
}

interface BookingRef {
    client_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
    location: string | null;
    meeting_url: string | null;
    session_type: string | null;
}

export default function Confirmation({ studio, booking }: { studio: StudioRef; booking: BookingRef }) {
    const pending = booking.status === 'pending';
    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    const date = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
            <Head title="Booking confirmed" />
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${pending ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    <svg className={`h-6 w-6 ${pending ? 'text-amber-600' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {pending
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />}
                    </svg>
                </div>

                <h1 className="mt-4 text-xl font-semibold text-neutral-900">
                    {pending ? 'Request received' : 'Booking confirmed'}
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                    {pending
                        ? `Thanks ${booking.client_name.split(' ')[0]} — ${studio.name} will review and confirm shortly.`
                        : `You're booked in with ${studio.name}.`}
                </p>

                <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-left text-sm">
                    {booking.session_type && <p className="font-medium text-neutral-900">{booking.session_type}</p>}
                    <p className="mt-1 text-neutral-700">{date}</p>
                    <p className="text-neutral-700">{t(start)} – {t(end)}</p>
                    {booking.location && <p className="mt-1 text-neutral-500">{booking.location}</p>}
                    {booking.meeting_url && (
                        <a href={booking.meeting_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-600 hover:underline">Join video call</a>
                    )}
                </div>

                <p className="mt-4 text-xs text-neutral-400">A confirmation has been noted on your booking.</p>
            </div>
        </div>
    );
}
