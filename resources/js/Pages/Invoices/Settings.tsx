import { PAYMENT_METHOD_OPTIONS, PaymentMethod } from '@/Components/InvoiceForm';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

interface Settings {
    payment_methods: PaymentMethod[];
    bank_details: string | null;
    payment_terms: string | null;
    default_tax_rate: number;
}

export default function Settings({
    settings,
    stripe_connected,
}: PageProps<{ settings: Settings; stripe_connected: boolean }>) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm({
        payment_methods: settings.payment_methods,
        bank_details: settings.bank_details ?? '',
        payment_terms: settings.payment_terms ?? '',
        default_tax_rate: settings.default_tax_rate ?? 0,
    });

    const toggleMethod = (m: PaymentMethod) =>
        setData(
            'payment_methods',
            data.payment_methods.includes(m)
                ? data.payment_methods.filter((x) => x !== m)
                : [...data.payment_methods, m],
        );

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('invoices.settings.update'), { preserveScroll: true });
    };

    const bankSelected = data.payment_methods.includes('bank_transfer');

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('invoices.index')} className="text-neutral-400 hover:text-neutral-700">Invoices</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Settings</span>
                </div>
            }
        >
            <Head title="Invoice settings" />
            <StudioManagerNav active="invoices" />

            <form onSubmit={submit} className="px-4 sm:px-8 py-8">
                <div className="max-w-xl space-y-8 rounded-xl border border-neutral-200 bg-white p-6">
                    {/* Payment methods */}
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-900">Default payment methods</h3>
                        <p className="mt-0.5 text-xs text-neutral-500">Offered on new invoices (you can override per invoice).</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {PAYMENT_METHOD_OPTIONS.map((opt) => {
                                const on = data.payment_methods.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleMethod(opt.value)}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                            on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                        {data.payment_methods.includes('card') && !stripe_connected && (
                            <p className="mt-2 text-xs text-amber-600">
                                Card payments require a connected Stripe account.{' '}
                                <Link href={route('profile.edit')} className="underline">Connect Stripe</Link>.
                            </p>
                        )}
                    </div>

                    {/* Bank details — shown when bank transfer is offered */}
                    {bankSelected && (
                        <div>
                            <label className="label mb-1.5">Bank transfer details</label>
                            <textarea
                                value={data.bank_details}
                                onChange={(e) => setData('bank_details', e.target.value)}
                                rows={5}
                                placeholder={'Account name: …\nSort code: …\nAccount number: …\nIBAN: …'}
                                className="input font-mono text-sm"
                            />
                            <p className="mt-1 text-xs text-neutral-500">Shown on invoices that offer bank transfer.</p>
                        </div>
                    )}

                    {/* Default terms */}
                    <div>
                        <label className="label mb-1.5">Default invoice notes / terms</label>
                        <textarea
                            value={data.payment_terms}
                            onChange={(e) => setData('payment_terms', e.target.value)}
                            rows={3}
                            placeholder="e.g. Payment due within 14 days. Thank you!"
                            className="input"
                        />
                    </div>

                    {/* Default tax */}
                    <div>
                        <label className="label mb-1.5">Default tax rate</label>
                        <div className="relative w-32">
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={data.default_tax_rate}
                                onChange={(e) => setData('default_tax_rate', Number(e.target.value))}
                                className="input pr-6 text-right"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing ? 'Saving…' : 'Save settings'}
                        </button>
                        {recentlySuccessful && <p className="text-sm text-neutral-500">Saved.</p>}
                    </div>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
