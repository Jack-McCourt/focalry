import { formatMoney } from '@/lib/money';
import { useForm } from '@inertiajs/react';

export interface PaymentPkg {
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
}

/**
 * The two-column payment-link body (details + form). Shared by the standalone
 * payment page and the in-website version (rendered inside the site shell).
 * `accent` themes the primary button to the site's colour when embedded.
 */
export default function PaymentLinkPanels({
    studioSlug,
    pkg,
    canPay,
    accent,
}: {
    studioSlug: string;
    pkg: PaymentPkg;
    canPay: boolean;
    accent?: string;
}) {
    const flexible = pkg.pricing_type === 'flexible';

    const { data, setData, transform, post, processing, errors } = useForm({
        client_name: '',
        client_email: '',
        client_phone: '',
        notes: '',
        payment_type: 'full',
        amount: flexible && pkg.suggested_amount_cents ? (pkg.suggested_amount_cents / 100).toFixed(2) : '',
    });

    const paid = flexible || pkg.price_cents > 0;
    const blocked = paid && !canPay;
    const fieldErrors = errors as Record<string, string>;

    transform((d) => ({
        ...d,
        amount_cents: flexible && d.amount.trim() !== '' ? Math.round(parseFloat(d.amount) * 100) : null,
    }));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('packages.public.checkout', { slug: studioSlug, package: pkg.slug }));
    };

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';
    const detailItems = (pkg.details ?? '').split('\n').filter((l) => l.trim());

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* ── Left: details ── */}
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {pkg.image_url && <img src={pkg.image_url} alt={pkg.name} className="h-48 w-full object-cover" />}
                <div className="p-6">
                    <h1 className="text-xl font-semibold text-neutral-900">{pkg.name}</h1>
                    {pkg.description && <p className="mt-2 text-sm text-neutral-600">{pkg.description}</p>}

                    {detailItems.length > 0 && (
                        <ul className="mt-4 space-y-1.5">
                            {detailItems.map((line, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    {line}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-6 border-t border-neutral-100 pt-4">
                        <p className="text-2xl font-semibold text-neutral-900">
                            {flexible ? 'Pay what you want' : formatMoney(pkg.price_cents, pkg.currency)}
                        </p>
                        {!flexible && pkg.deposit_cents ? (
                            <p className="mt-0.5 text-sm text-neutral-500">or {formatMoney(pkg.deposit_cents, pkg.currency)} deposit</p>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── Right: form ── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-neutral-900">Your details</h2>

                {blocked && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Online payment isn’t available yet. Please get in touch directly.
                    </p>
                )}

                <form onSubmit={submit} className="mt-4 space-y-4">
                    <div>
                        <span className="label">Your name</span>
                        <input className={field} value={data.client_name} onChange={(e) => setData('client_name', e.target.value)} />
                        {errors.client_name && <p className="mt-1 text-xs text-red-600">{errors.client_name}</p>}
                    </div>
                    <div>
                        <span className="label">Email</span>
                        <input type="email" className={field} value={data.client_email} onChange={(e) => setData('client_email', e.target.value)} />
                        {errors.client_email && <p className="mt-1 text-xs text-red-600">{errors.client_email}</p>}
                    </div>
                    <div>
                        <span className="label">Phone (optional)</span>
                        <input className={field} value={data.client_phone} onChange={(e) => setData('client_phone', e.target.value)} />
                    </div>
                    <div>
                        <span className="label">Notes (optional)</span>
                        <textarea className={field} rows={2} value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                    </div>

                    {flexible ? (
                        <div>
                            <span className="label">Amount</span>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-sm font-medium uppercase text-neutral-500">{pkg.currency}</span>
                                <input inputMode="decimal" className={`${field} mt-0`} value={data.amount} onChange={(e) => setData('amount', e.target.value)} placeholder="0.00" />
                            </div>
                            {pkg.min_amount_cents ? <p className="mt-1 text-xs text-neutral-500">Minimum {formatMoney(pkg.min_amount_cents, pkg.currency)}</p> : null}
                            {fieldErrors.amount_cents && <p className="mt-1 text-xs text-red-600">{fieldErrors.amount_cents}</p>}
                        </div>
                    ) : pkg.deposit_cents ? (
                        <div>
                            <span className="label">Payment</span>
                            <div className="mt-1 flex gap-2">
                                {([['full', `Pay in full · ${formatMoney(pkg.price_cents, pkg.currency)}`], ['deposit', `Deposit · ${formatMoney(pkg.deposit_cents, pkg.currency)}`]] as const).map(([val, lbl]) => (
                                    <button type="button" key={val} onClick={() => setData('payment_type', val)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${data.payment_type === val ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700'}`}>{lbl}</button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={processing || blocked}
                        className="btn-primary w-full justify-center"
                        style={accent ? { background: accent, borderColor: accent } : undefined}
                    >
                        {processing ? 'Redirecting…' : paid ? 'Continue to payment' : 'Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
