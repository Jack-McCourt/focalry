import { formatMoney } from '@/lib/money';
import { Head, Link } from '@inertiajs/react';

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
    price_cents: number;
    currency: string;
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

export default function Studio({ studio, meetingTypes }: { studio: StudioRef; meetingTypes: MeetingTypeRef[] }) {
    return (
        <div className="min-h-screen bg-neutral-50">
            <Head title={`Book a meeting with ${studio.name}`} />
            <div className="mx-auto max-w-2xl px-4 py-12">
                <div className="mb-8 text-center">
                    {studio.logo_url ? (
                        <img src={studio.logo_url} alt={studio.name} className="mx-auto mb-3 max-h-16 object-contain" />
                    ) : null}
                    <h1 className="text-2xl font-semibold text-neutral-900">{studio.name}</h1>
                    <p className="mt-1 text-sm text-neutral-500">Choose a meeting to book.</p>
                </div>

                {meetingTypes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
                        No meetings are available to book right now.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {meetingTypes.map((t) => (
                            <Link
                                key={t.slug}
                                href={route('meetings.public.show', { slug: studio.slug, type: t.slug })}
                                className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color ?? '#6366f1' }} />
                                    <span className="text-base font-semibold text-neutral-900">{t.name}</span>
                                </div>
                                <p className="mt-1 text-sm text-neutral-500">
                                    {t.duration_minutes} min · {LOCATION_LABELS[t.location_type]}
                                    {t.price_cents > 0 ? ` · ${formatMoney(t.price_cents, t.currency)}` : ' · Free'}
                                </p>
                                {t.description && <p className="mt-2 text-sm text-neutral-600">{t.description}</p>}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
