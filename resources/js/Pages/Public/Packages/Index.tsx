import Modal from '@/Components/Modal';
import { formatMoney } from '@/lib/money';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

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
    price_cents: number;
    deposit_cents: number | null;
    currency: string;
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
    const [booking, setBooking] = useState<PackageRef | null>(null);

    return (
        <div className={embed ? 'bg-transparent' : 'min-h-screen bg-neutral-50'}>
            <Head title={`Packages — ${studio.name}`} />
            <div className={`mx-auto max-w-4xl px-4 ${embed ? 'py-4' : 'py-12'}`}>
                {!embed && (
                    <div className="mb-8 text-center">
                        {studio.logo_url && <img src={studio.logo_url} alt={studio.name} className="mx-auto mb-3 max-h-16 object-contain" />}
                        <h1 className="text-2xl font-semibold text-neutral-900">{studio.name}</h1>
                        <p className="mt-1 text-sm text-neutral-500">Choose a package to book.</p>
                    </div>
                )}

                {packages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
                        No packages are available right now.
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
                                            <p className="text-lg font-semibold text-neutral-900">{formatMoney(p.price_cents, p.currency)}</p>
                                            {p.deposit_cents ? <p className="text-xs text-neutral-500">or {formatMoney(p.deposit_cents, p.currency)} deposit</p> : null}
                                        </div>
                                        <button onClick={() => setBooking(p)} className="btn-primary">Book</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {booking && <BookModal studio={studio} pkg={booking} canPay={can_pay} onClose={() => setBooking(null)} />}
        </div>
    );
}

function BookModal({ studio, pkg, canPay, onClose }: { studio: StudioRef; pkg: PackageRef; canPay: boolean; onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({
        client_name: '',
        client_email: '',
        client_phone: '',
        notes: '',
        payment_type: 'full',
    });

    const paid = pkg.price_cents > 0;
    const blocked = paid && !canPay;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('packages.public.checkout', { slug: studio.slug, package: pkg.slug }));
    };

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Book “{pkg.name}”</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>

                {blocked && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Online booking isn’t available for this studio yet. Please get in touch directly.</p>
                )}

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
                    <span className="label">Notes (optional)</span>
                    <textarea className={field} rows={2} value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                </div>

                {pkg.deposit_cents ? (
                    <div>
                        <span className="label">Payment</span>
                        <div className="mt-1 flex gap-2">
                            {([['full', `Pay in full · ${formatMoney(pkg.price_cents, pkg.currency)}`], ['deposit', `Deposit · ${formatMoney(pkg.deposit_cents, pkg.currency)}`]] as const).map(([val, lbl]) => (
                                <button type="button" key={val} onClick={() => setData('payment_type', val)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${data.payment_type === val ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700'}`}>{lbl}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-neutral-600">Total: <span className="font-semibold text-neutral-900">{formatMoney(pkg.price_cents, pkg.currency)}</span></p>
                )}

                <button type="submit" disabled={processing || blocked} className="btn-primary w-full justify-center">
                    {processing ? 'Redirecting…' : paid ? 'Continue to payment' : 'Confirm booking'}
                </button>
            </form>
        </Modal>
    );
}
