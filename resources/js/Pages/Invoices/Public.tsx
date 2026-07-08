import { centsToInput, currencySymbol, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface PublicItem {
    description: string;
    quantity: number | string;
    unit_amount_cents: number;
}

interface PublicSchedule {
    amount_cents: number;
    due_date: string | null;
}

interface PublicInvoice {
    number: string;
    public_id: string;
    status: 'draft' | 'sent' | 'partial' | 'paid' | 'void';
    currency: string;
    issue_date: string | null;
    due_date: string | null;
    subtotal_cents: number;
    discount_cents: number;
    tax_rate: number | string;
    tax_cents: number;
    total_cents: number;
    amount_paid_cents: number;
    balance_cents: number;
    payable_cents: number;
    notes: string | null;
    items: PublicItem[];
    schedules: PublicSchedule[];
    outstanding_schedules: PublicSchedule[];
}

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

const STATUS_STYLES: Record<PublicInvoice['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-brand-50 text-brand-700',
    partial: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    void: 'bg-neutral-100 text-neutral-400',
};

export default function Public({
    invoice,
    studio_name,
    studio_logo,
    studio_logo_size,
    bill_to,
    can_pay_online,
    bank_details,
}: {
    invoice: PublicInvoice;
    studio_name: string | null;
    studio_logo: string | null;
    studio_logo_size: string | null;
    bill_to: { name: string; email: string | null } | null;
    can_pay_online: boolean;
    bank_details: string | null;
}) {
    const [paying, setPaying] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [amount, setAmount] = useState(centsToInput(invoice.payable_cents));
    const [selected, setSelected] = useState<number[]>([]);
    const paid = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1';
    const { props } = usePage<PageProps>();

    const outstanding = invoice.outstanding_schedules ?? [];
    const customCents = toCents(amount);
    const customValid = customCents > 0 && customCents <= invoice.balance_cents;

    // Pay the default amount (next instalment / full balance).
    const pay = () => {
        setPaying(true);
        router.post(route('invoices.public.checkout', invoice.public_id), {}, { onFinish: () => setPaying(false) });
    };

    // Pay a specific amount (custom box / selected instalments).
    const payCustom = () => {
        if (!customValid) return;
        setPaying(true);
        router.post(
            route('invoices.public.checkout', invoice.public_id),
            { amount_cents: customCents },
            { onFinish: () => setPaying(false) },
        );
    };

    const toggleInstalment = (i: number) => {
        const next = selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i];
        setSelected(next);
        const sum = next.reduce((t, idx) => t + (outstanding[idx]?.amount_cents ?? 0), 0);
        if (next.length > 0) setAmount(centsToInput(sum));
    };

    const openCustom = () => {
        setSelected([]);
        setAmount(centsToInput(invoice.payable_cents));
        setCustomOpen(true);
    };

    return (
        <div className="min-h-screen bg-neutral-100 py-12 print:bg-white print:py-0">
            <Head title={`Invoice ${invoice.number}`} />

            <div className="mx-auto max-w-3xl px-4">
                {paid && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
                        Thank you — your payment is being processed and will appear shortly.
                    </div>
                )}
                {props.flash?.success && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
                        {props.flash.success}
                    </div>
                )}
                {props.flash?.error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 print:hidden">
                        {props.flash.error}
                    </div>
                )}

                {/* Toolbar */}
                <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                        </svg>
                        Print
                    </button>
                    <a
                        href={route('invoices.public.pdf', invoice.public_id)}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download PDF
                    </a>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
                    <div className="flex items-start justify-between gap-6">
                        <div>
                            {studio_logo ? (
                                <img src={studio_logo} alt={studio_name ?? ''} className={`mb-3 ${({ small: 'max-h-8', medium: 'max-h-12', large: 'max-h-24', xlarge: 'max-h-36' } as Record<string, string>)[studio_logo_size ?? 'medium'] ?? 'max-h-12'} max-w-[220px] object-contain`} />
                            ) : null}
                            {studio_name && <p className="text-lg font-semibold text-neutral-900">{studio_name}</p>}
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-light uppercase tracking-[0.15em] text-neutral-900">Invoice</h1>
                            <p className="mt-1 font-mono text-sm text-neutral-500">{invoice.number}</p>
                            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[invoice.status]}`}>
                                {invoice.status}
                            </span>
                            <div className="mt-3 text-sm text-neutral-500">
                                <p>Issued: {fmtDate(invoice.issue_date)}</p>
                                <p>Due: {fmtDate(invoice.due_date)}</p>
                            </div>
                        </div>
                    </div>

                    {bill_to && (
                        <div className="mt-8">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Bill to</p>
                            <p className="mt-1 text-sm font-medium text-neutral-900">{bill_to.name}</p>
                            {bill_to.email && <p className="text-sm text-neutral-500">{bill_to.email}</p>}
                        </div>
                    )}

                    <div className="mt-8 overflow-x-auto">
                        <table className="w-full text-[15px]">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <th className="py-2">Description</th>
                                    <th className="py-2 text-right">Qty</th>
                                    <th className="py-2 text-right">Unit</th>
                                    <th className="py-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {invoice.items.map((it, i) => (
                                    <tr key={i}>
                                        <td className="py-2.5 text-neutral-800">{it.description}</td>
                                        <td className="py-2.5 text-right text-neutral-500">{it.quantity}</td>
                                        <td className="py-2.5 text-right text-neutral-500">{formatMoney(it.unit_amount_cents, invoice.currency)}</td>
                                        <td className="py-2.5 text-right text-neutral-800">
                                            {formatMoney(Math.round((parseFloat(String(it.quantity)) || 0) * it.unit_amount_cents), invoice.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <div className="w-full max-w-xs space-y-1.5 text-sm">
                            <div className="flex justify-between text-neutral-500">
                                <span>Subtotal</span><span>{formatMoney(invoice.subtotal_cents, invoice.currency)}</span>
                            </div>
                            {invoice.discount_cents > 0 && (
                                <div className="flex justify-between text-neutral-500">
                                    <span>Discount</span><span>−{formatMoney(invoice.discount_cents, invoice.currency)}</span>
                                </div>
                            )}
                            {invoice.tax_cents > 0 && (
                                <div className="flex justify-between text-neutral-500">
                                    <span>Tax ({Number(invoice.tax_rate)}%)</span><span>{formatMoney(invoice.tax_cents, invoice.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-base font-semibold text-neutral-900">
                                <span>Total</span><span>{formatMoney(invoice.total_cents, invoice.currency)}</span>
                            </div>
                            {invoice.amount_paid_cents > 0 && (
                                <>
                                    <div className="flex justify-between text-emerald-600">
                                        <span>Paid</span><span>−{formatMoney(invoice.amount_paid_cents, invoice.currency)}</span>
                                    </div>
                                    <div className="flex justify-between font-semibold text-neutral-900">
                                        <span>Balance</span><span>{formatMoney(invoice.balance_cents, invoice.currency)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {invoice.schedules.length > 0 && (
                        <div className="mt-6 border-t border-neutral-100 pt-4">
                            <p className="mb-2 text-xs font-medium text-neutral-400">Payment schedule</p>
                            <div className="space-y-1.5 text-sm">
                                {invoice.schedules.map((s, i) => (
                                    <div key={i} className="flex justify-between text-neutral-600">
                                        <span>{fmtDate(s.due_date)}</span>
                                        <span>{formatMoney(s.amount_cents, invoice.currency)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {invoice.notes && (
                        <div className="mt-6 border-t border-neutral-100 pt-4">
                            <p className="whitespace-pre-wrap text-sm text-neutral-600">{invoice.notes}</p>
                        </div>
                    )}
                </div>

                {/* Pay action */}
                <div className="mt-6 print:hidden">
                    {invoice.status === 'paid' ? (
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                            This invoice is paid in full. Thank you!
                        </p>
                    ) : can_pay_online ? (
                        <>
                            <button
                                onClick={pay}
                                disabled={paying}
                                className="w-full rounded-xl bg-neutral-900 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {paying ? 'Redirecting…' : `Pay ${formatMoney(invoice.payable_cents, invoice.currency)} now`}
                            </button>
                            <button
                                onClick={openCustom}
                                disabled={paying}
                                className="mt-2 w-full rounded-xl border border-neutral-300 py-3 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 disabled:opacity-50"
                            >
                                {outstanding.length > 1 ? 'Pay a custom amount / multiple payments' : 'Pay a custom amount'}
                            </button>
                        </>
                    ) : !bank_details && invoice.balance_cents > 0 ? (
                        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm text-neutral-500">
                            Online payment isn’t available for this invoice. Please contact {studio_name ?? 'the studio'} to arrange payment.
                        </p>
                    ) : null}

                    {/* Bank transfer details */}
                    {bank_details && invoice.balance_cents > 0 && (
                        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
                            <p className="text-sm font-semibold text-neutral-900">Pay by bank transfer</p>
                            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-neutral-600">{bank_details}</pre>
                        </div>
                    )}

                    {can_pay_online && <p className="mt-3 text-center text-xs text-neutral-400">Secured by Stripe</p>}
                </div>
            </div>

            {/* Custom amount modal */}
            {customOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCustomOpen(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-base font-semibold text-neutral-900">Choose your payment</h2>
                        <p className="mt-0.5 text-sm text-neutral-500">Balance due: {formatMoney(invoice.balance_cents, invoice.currency)}</p>

                        {outstanding.length > 1 && (
                            <div className="mt-4">
                                <p className="mb-2 text-xs font-medium text-neutral-400">Select payments to settle</p>
                                <div className="space-y-1.5">
                                    {outstanding.map((s, i) => (
                                        <label key={i} className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:border-neutral-300">
                                            <span className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(i)}
                                                    onChange={() => toggleInstalment(i)}
                                                    className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                                                />
                                                <span className="text-neutral-600">Due {fmtDate(s.due_date)}</span>
                                            </span>
                                            <span className="font-medium text-neutral-800">{formatMoney(s.amount_cents, invoice.currency)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-4">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Amount to pay</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
                                    {currencySymbol(invoice.currency)}
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => { setSelected([]); setAmount(e.target.value); }}
                                    className="w-full rounded-lg border border-neutral-300 py-2.5 pl-14 pr-3 text-right focus:border-neutral-400 focus:ring-neutral-400"
                                />
                            </div>
                            {customCents > invoice.balance_cents && (
                                <p className="mt-1 text-xs text-red-600">That’s more than the balance due.</p>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setCustomOpen(false)} className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800">
                                Cancel
                            </button>
                            <button
                                onClick={payCustom}
                                disabled={paying || !customValid}
                                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
                            >
                                {paying ? 'Redirecting…' : `Pay ${formatMoney(customCents, invoice.currency)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
