import Modal from '@/Components/Modal';
import SendEmailModal from '@/Components/SendEmailModal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { centsToInput, currencySymbol, formatMoney, toCents } from '@/lib/money';
import { EmailDefaults, Invoice, PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

const STATUS_STYLES: Record<Invoice['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-brand-50 text-brand-700',
    partial: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    void: 'bg-neutral-100 text-neutral-400 line-through',
};

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function PaymentModal({ invoice, show, onClose }: { invoice: Invoice; show: boolean; onClose: () => void }) {
    const balance = Math.max(0, invoice.total_cents - invoice.amount_paid_cents);
    const { data, setData, post, processing, errors, reset } = useForm({
        amount_cents: balance,
        method: 'manual' as 'manual' | 'stripe',
        reference: '',
        paid_on: new Date().toISOString().slice(0, 10),
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('invoices.payments.store', invoice.id), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-5 text-base font-semibold text-neutral-900">Record payment</h2>
                <div className="space-y-4">
                    <div>
                        <label className="label mb-1.5">Amount</label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{currencySymbol(invoice.currency)}</span>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                defaultValue={centsToInput(data.amount_cents)}
                                onChange={(e) => setData('amount_cents', toCents(e.target.value))}
                                className="input pl-6"
                            />
                        </div>
                        {errors.amount_cents && <p className="mt-1 text-xs text-red-600">{errors.amount_cents}</p>}
                        <p className="mt-1 text-xs text-neutral-400">Balance due: {formatMoney(balance, invoice.currency)}</p>
                    </div>
                    <div>
                        <label className="label mb-1.5">Method</label>
                        <div className="flex gap-2">
                            {(['manual', 'stripe'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setData('method', m)}
                                    className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition ${
                                        data.method === m ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                                    }`}
                                >
                                    {m === 'manual' ? 'Manual / offline' : 'Stripe'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label mb-1.5">Reference</label>
                            <input type="text" value={data.reference} onChange={(e) => setData('reference', e.target.value)} placeholder="Cheque #, etc." className="input" />
                        </div>
                        <div>
                            <label className="label mb-1.5">Date</label>
                            <input type="date" value={data.paid_on} onChange={(e) => setData('paid_on', e.target.value)} className="input" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Record payment'}</button>
                </div>
            </form>
        </Modal>
    );
}

export default function Show({ invoice, email_defaults }: PageProps<{ invoice: Invoice; email_defaults: EmailDefaults }>) {
    const [showPayment, setShowPayment] = useState(false);
    const [emailOpen, setEmailOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const balance = Math.max(0, invoice.total_cents - invoice.amount_paid_cents);
    const items = invoice.items ?? [];
    const payments = invoice.payments ?? [];
    const schedules = invoice.schedules ?? [];
    const reminderOffsets = invoice.reminder_offsets ?? [];

    // Allocate recorded payments across instalments in order to flag which are covered.
    let allocated = invoice.amount_paid_cents;
    const scheduleRows = schedules.map((s) => {
        const covered = Math.min(allocated, s.amount_cents);
        allocated -= covered;
        return { ...s, paid: s.amount_cents > 0 && covered >= s.amount_cents };
    });

    const reminderLabel: Record<number, string> = {
        [-7]: '7 days before',
        [-3]: '3 days before',
        0: 'On the due date',
        3: '3 days after',
        7: '7 days after',
    };

    const canEdit = invoice.status !== 'paid' && invoice.status !== 'void';
    const canPay = invoice.status !== 'void' && balance > 0;

    const post = (name: string) => router.post(route(name, invoice.id), {}, { preserveScroll: true });

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Link href={route('invoices.index')} className="text-neutral-400 hover:text-neutral-700">Invoices</Link>
                        <span className="text-neutral-300">/</span>
                        <span className="font-mono font-semibold text-neutral-900">{invoice.number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={`/i/${invoice.public_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                            title="See this invoice as your client sees it"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            View
                        </a>
                        <a
                            href={`/i/${invoice.public_id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                            title="Download a PDF of this invoice"
                        >
                            PDF
                        </a>
                        <button onClick={() => setEmailOpen(true)} className="btn-secondary">Email client</button>
                        {invoice.status === 'draft' && (
                            <button onClick={() => post('invoices.sent')} className="btn-secondary">Mark as sent</button>
                        )}
                        {canPay && (
                            <button onClick={() => setShowPayment(true)} className="btn-primary">Record payment</button>
                        )}
                        {canEdit && (
                            <Link href={route('invoices.edit', invoice.id)} className="btn-secondary">Edit</Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={invoice.number} />
            <StudioManagerNav active="invoices" />

            <div className="px-4 py-8 sm:px-8">
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Document */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-8 lg:col-span-2">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="font-mono text-xl font-semibold text-neutral-900">{invoice.number}</h2>
                                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[invoice.status]}`}>
                                    {invoice.status}
                                </span>
                            </div>
                            <div className="text-right text-sm text-neutral-500">
                                <p>Issued: {fmtDate(invoice.issue_date)}</p>
                                <p>Due: {fmtDate(invoice.due_date)}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
                            {invoice.contact && (
                                <div>
                                    <p className="text-xs font-medium text-neutral-400">Bill to</p>
                                    <Link href={route('contacts.show', invoice.contact.id)} className="text-sm font-medium text-neutral-900 hover:underline">
                                        {invoice.contact.name}
                                    </Link>
                                    {invoice.contact.email && <p className="text-sm text-neutral-500">{invoice.contact.email}</p>}
                                </div>
                            )}
                            {invoice.project && (
                                <div>
                                    <p className="text-xs font-medium text-neutral-400">Project</p>
                                    <Link href={`/projects`} className="text-sm font-medium text-neutral-900 hover:underline">
                                        {invoice.project.name}
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                        <th className="py-2">Description</th>
                                        <th className="py-2 text-right">Qty</th>
                                        <th className="py-2 text-right">Unit</th>
                                        <th className="py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {items.map((it, i) => (
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

                        {/* Totals */}
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
                                            <span>Balance</span><span>{formatMoney(balance, invoice.currency)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {invoice.notes && (
                            <div className="mt-6 border-t border-neutral-100 pt-4">
                                <p className="text-xs font-medium text-neutral-400">Notes</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{invoice.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Payment link */}
                        {invoice.status !== 'draft' && invoice.status !== 'void' && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-6">
                                <h3 className="mb-2 text-sm font-semibold text-neutral-900">Payment link</h3>
                                <p className="mb-3 text-xs text-neutral-500">Share this link so your client can view and pay online.</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard?.writeText(`${window.location.origin}/i/${invoice.public_id}`);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 1500);
                                        }}
                                        className="btn-secondary flex-1 justify-center text-xs"
                                    >
                                        {copied ? 'Copied!' : 'Copy link'}
                                    </button>
                                    <a
                                        href={`/i/${invoice.public_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary justify-center text-xs"
                                    >
                                        Open
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Payment schedule */}
                        {scheduleRows.length > 0 && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-6">
                                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Payment schedule</h3>
                                <div className="space-y-2.5">
                                    {scheduleRows.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <div>
                                                <span className="font-medium text-neutral-800">{formatMoney(s.amount_cents, invoice.currency)}</span>
                                                <span className="ml-2 text-xs text-neutral-400">{fmtDate(s.due_date)}</span>
                                            </div>
                                            {s.paid ? (
                                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Paid</span>
                                            ) : (
                                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">Due</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reminders */}
                        {reminderOffsets.length > 0 && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-6">
                                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Payment reminders</h3>
                                <ul className="space-y-1.5 text-sm text-neutral-600">
                                    {[...reminderOffsets].sort((a, b) => a - b).map((o) => (
                                        <li key={o} className="flex items-center gap-2">
                                            <svg className="h-3.5 w-3.5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {reminderLabel[o] ?? `${o} days`}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 text-xs text-neutral-400">Sent automatically to the client by email.</p>
                            </div>
                        )}

                        {/* Payments */}
                        {payments.length > 0 && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-6">
                                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Payments received</h3>
                                <div className="space-y-2">
                                    {payments.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between text-sm">
                                            <div>
                                                <span className="font-medium text-neutral-800">{formatMoney(p.amount_cents, invoice.currency)}</span>
                                                <span className="ml-2 text-neutral-400 capitalize">{p.method}</span>
                                                {p.reference && <span className="ml-2 text-neutral-400">· {p.reference}</span>}
                                            </div>
                                            <span className="text-neutral-400">{fmtDate(p.paid_on)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Secondary actions */}
                <div className="mt-6 flex items-center gap-3">
                    {invoice.status !== 'void' && invoice.status !== 'paid' && (
                        <button onClick={async () => { if (await confirmDialog('Void this invoice?')) post('invoices.void'); }} className="text-sm text-neutral-500 hover:text-neutral-800">
                            Void invoice
                        </button>
                    )}
                    <button
                        onClick={async () => { if (await confirmDialog('Delete this invoice? This cannot be undone.')) router.delete(route('invoices.destroy', invoice.id)); }}
                        className="text-sm text-red-500 hover:text-red-700"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <PaymentModal invoice={invoice} show={showPayment} onClose={() => setShowPayment(false)} />
            <SendEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} defaults={email_defaults} />
        </AuthenticatedLayout>
    );
}
