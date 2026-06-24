import { formatMoney } from '@/lib/money';
import { Head, Link } from '@inertiajs/react';

interface StudioRef {
    name: string;
    slug: string;
    logo_url: string | null;
}

interface PackageRef {
    slug: string;
    name: string;
    description: string | null;
    details: string | null;
    image_url: string | null;
    pricing_type: 'fixed' | 'flexible';
    price_cents: number;
    deposit_cents: number | null;
    min_amount_cents: number | null;
    suggested_amount_cents: number | null;
    currency: string;
    url: string;
}

export default function Index({
    studio,
    packages,
    embed,
    can_pay,
}: {
    studio: StudioRef;
    packages: PackageRef[];
    embed: boolean;
    can_pay: boolean;
}) {
    return (
        <div className={embed ? 'bg-transparent' : 'min-h-screen bg-neutral-50'}>
            <Head title={studio.name} />
            <div className={`mx-auto max-w-4xl px-4 ${embed ? 'py-4' : 'py-12'}`}>
                {!embed && (
                    <div className="mb-8 text-center">
                        {studio.logo_url && <img src={studio.logo_url} alt={studio.name} className="mx-auto mb-3 max-h-16 object-contain" />}
                        <h1 className="text-2xl font-semibold text-neutral-900">{studio.name}</h1>
                        <p className="mt-1 text-sm text-neutral-500">Select an option to pay.</p>
                    </div>
                )}

                {packages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
                        Nothing is available right now.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {packages.map((p) => (
                            <div key={p.slug} className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
                                {p.image_url && <img src={p.image_url} alt={p.name} className="h-44 w-full object-cover" />}
                                <div className="flex flex-1 flex-col p-5">
                                    <h2 className="text-base font-semibold text-neutral-900">{p.name}</h2>
                                    {p.description && <p className="mt-1 text-sm text-neutral-600">{p.description}</p>}
                                    {p.details && (
                                        <ul className="mt-3 space-y-1">
                                            {p.details.split('\n').filter((l) => l.trim()).map((line, i) => (
                                                <li key={i} className="flex items-start gap-1.5 text-sm text-neutral-600">
                                                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                    {line}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="mt-4 flex items-end justify-between pt-2">
                                        <div>
                                            <p className="text-lg font-semibold text-neutral-900">{p.pricing_type === 'flexible' ? 'Pay what you want' : formatMoney(p.price_cents, p.currency)}</p>
                                            {p.pricing_type !== 'flexible' && p.deposit_cents ? <p className="text-xs text-neutral-500">or {formatMoney(p.deposit_cents, p.currency)} deposit</p> : null}
                                        </div>
                                        <Link href={p.url} className="btn-primary">Pay</Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
