import { formatMoney } from '@/lib/money';
import { Head } from '@inertiajs/react';

interface StudioRef {
    name: string;
    slug: string;
    logo_url: string | null;
}

interface BookingRef {
    client_name: string;
    package: string | null;
    amount_cents: number;
    currency: string;
    payment_type: string;
    status: string;
}

export default function Confirmation({ studio, booking }: { studio: StudioRef; booking: BookingRef }) {
    const paid = booking.status === 'paid';

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
            <Head title="Booking confirmed" />
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${paid ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <svg className={`h-6 w-6 ${paid ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {paid
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    </svg>
                </div>

                <h1 className="mt-4 text-xl font-semibold text-neutral-900">{paid ? 'Booking confirmed' : 'Almost there'}</h1>
                <p className="mt-1 text-sm text-neutral-500">
                    {paid
                        ? `Thanks ${booking.client_name.split(' ')[0]} — ${studio.name} has your booking and will be in touch to arrange the details.`
                        : 'Your payment is being processed. This page will reflect it once confirmed.'}
                </p>

                <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-left text-sm">
                    {booking.package && <p className="font-medium text-neutral-900">{booking.package}</p>}
                    <p className="mt-1 text-neutral-700">
                        {formatMoney(booking.amount_cents, booking.currency)} {booking.payment_type === 'deposit' ? 'deposit paid' : 'paid'}
                    </p>
                </div>
            </div>
        </div>
    );
}
