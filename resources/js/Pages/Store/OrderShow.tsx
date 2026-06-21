import StoreNav from '@/Components/StoreNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface Item {
    id: number;
    description: string;
    type: string;
    fulfilment: string;
    qty: number;
    unit_price_cents: number;
    cogs_cents: number;
    line_total_cents: number;
    photo_thumb: string | null;
    photo_filename: string | null;
}

interface Order {
    id: number;
    number: string;
    status: string;
    fulfilment: string;
    currency: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    shipping_name: string | null;
    shipping_line1: string | null;
    shipping_line2: string | null;
    shipping_city: string | null;
    shipping_region: string | null;
    shipping_postal_code: string | null;
    shipping_country: string | null;
    subtotal_cents: number;
    discount_cents: number;
    gift_card_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;
    platform_fee_cents: number;
    cogs_cents: number;
    payout_cents: number;
    refunded_cents: number;
    refundable_cents: number;
    payment_method: string;
    notes: string | null;
    coupon_code: string | null;
    shipping_method: string | null;
    collection: { title: string; slug: string } | null;
    paid_at: string | null;
    fulfilled_at: string | null;
    fulfil_after: string | null;
    created_at: string;
    items: Item[];
    refunds: { amount_cents: number; reason: string | null; created_at: string }[];
}

const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function OrderShow({ order, statuses }: PageProps<{ order: Order; statuses: string[] }>) {
    const c = order.currency;
    const [refunding, setRefunding] = useState(false);
    const [refundAmount, setRefundAmount] = useState(centsToInput(order.refundable_cents));
    const [refundReason, setRefundReason] = useState('');

    const setStatus = (status: string) =>
        router.post(route('store.orders.status', order.id), { status }, { preserveScroll: true });

    const fulfil = () => router.post(route('store.orders.fulfil', order.id), {}, { preserveScroll: true });

    const recordOffline = () => {
        if (confirm('Mark this order as paid offline? This will trigger fulfilment.')) {
            router.post(route('store.orders.offline', order.id), {}, { preserveScroll: true });
        }
    };

    const submitRefund = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(
            route('store.orders.refund', order.id),
            { amount_cents: toCents(refundAmount), reason: refundReason },
            { preserveScroll: true, onSuccess: () => setRefunding(false) },
        );
    };

    const isPaid = !['pending', 'cancelled'].includes(order.status);
    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Store</h1>}>
            <Head title={`Order ${order.number}`} />
            <StoreNav active="orders" />

            <div className="px-4 py-6 sm:px-8">
                <Link href={route('store.orders.index')} className="text-xs text-neutral-400 hover:text-neutral-700">
                    ← All orders
                </Link>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900">{order.number}</h2>
                        <p className="text-xs text-neutral-400">
                            {new Date(order.created_at).toLocaleString()} · {label(order.fulfilment)} fulfilment
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={order.status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border-neutral-300 text-sm">
                            {statuses.map((s) => (
                                <option key={s} value={s}>{label(s)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-3">
                    {/* Items + totals */}
                    <div className="space-y-5 lg:col-span-2">
                        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                            {order.items.map((i) => (
                                <div key={i.id} className="flex items-center gap-3 border-b border-neutral-50 px-4 py-3 last:border-0">
                                    {i.photo_thumb ? (
                                        <img src={i.photo_thumb} alt="" className="h-12 w-12 rounded object-cover" />
                                    ) : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">
                                            {label(i.type)}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-neutral-900">{i.description}</p>
                                        <p className="text-[11px] text-neutral-400">
                                            {i.photo_filename ? `${i.photo_filename} · ` : ''}{label(i.fulfilment)}
                                        </p>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="text-neutral-700">{i.qty} × {formatMoney(i.unit_price_cents, c)}</p>
                                        <p className="font-medium text-neutral-900">{formatMoney(i.line_total_cents, c)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
                            <Row label="Subtotal" value={formatMoney(order.subtotal_cents, c)} />
                            {order.discount_cents > 0 && <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`} value={`−${formatMoney(order.discount_cents, c)}`} />}
                            {order.shipping_cents > 0 && <Row label={`Shipping${order.shipping_method ? ` (${order.shipping_method})` : ''}`} value={formatMoney(order.shipping_cents, c)} />}
                            {order.tax_cents > 0 && <Row label="Tax" value={formatMoney(order.tax_cents, c)} />}
                            {order.gift_card_cents > 0 && <Row label="Gift card" value={`−${formatMoney(order.gift_card_cents, c)}`} />}
                            <div className="my-2 border-t border-neutral-100" />
                            <Row label="Total" value={formatMoney(order.total_cents, c)} bold />
                            {order.refunded_cents > 0 && <Row label="Refunded" value={`−${formatMoney(order.refunded_cents, c)}`} />}
                        </div>

                        {/* Ledger */}
                        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Ledger</p>
                            <Row label="Client paid" value={formatMoney(order.total_cents, c)} />
                            <Row label="Lab cost of goods" value={`−${formatMoney(order.cogs_cents, c)}`} />
                            <Row label="Platform fee" value={`−${formatMoney(order.platform_fee_cents, c)}`} />
                            <div className="my-2 border-t border-neutral-100" />
                            <Row label="Your payout" value={formatMoney(order.payout_cents, c)} bold />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-5">
                        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Customer</p>
                            <p className="font-medium text-neutral-900">{order.customer_name}</p>
                            <p className="text-neutral-600">{order.customer_email}</p>
                            {order.customer_phone && <p className="text-neutral-600">{order.customer_phone}</p>}
                            {order.collection && (
                                <p className="mt-2 text-xs text-neutral-400">
                                    From gallery: <a href={`/g/${order.collection.slug}`} className="text-blue-600 hover:underline">{order.collection.title}</a>
                                </p>
                            )}
                        </div>

                        {order.shipping_line1 && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Ship to</p>
                                <p className="text-neutral-700">{order.shipping_name}</p>
                                <p className="text-neutral-600">{order.shipping_line1}</p>
                                {order.shipping_line2 && <p className="text-neutral-600">{order.shipping_line2}</p>}
                                <p className="text-neutral-600">
                                    {order.shipping_city}{order.shipping_region ? `, ${order.shipping_region}` : ''} {order.shipping_postal_code}
                                </p>
                                <p className="text-neutral-600">{order.shipping_country}</p>
                            </div>
                        )}

                        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Payment & fulfilment</p>
                            <Row label="Payment" value={isPaid ? `Paid (${order.payment_method})` : 'Unpaid'} />
                            {order.paid_at && <Row label="Paid" value={new Date(order.paid_at).toLocaleDateString()} />}
                            {order.fulfilled_at
                                ? <Row label="Fulfilled" value={new Date(order.fulfilled_at).toLocaleDateString()} />
                                : order.fulfil_after && <Row label="Fulfil after" value={new Date(order.fulfil_after).toLocaleString()} />}

                            <div className="mt-3 flex flex-col gap-2">
                                {!isPaid && (
                                    <button onClick={recordOffline} className="btn-secondary w-full justify-center text-xs">Record offline payment</button>
                                )}
                                {isPaid && !order.fulfilled_at && (
                                    <button onClick={fulfil} className="btn-primary w-full justify-center text-xs">Fulfil now</button>
                                )}
                                {isPaid && order.refundable_cents > 0 && (
                                    <button onClick={() => setRefunding((v) => !v)} className="btn-secondary w-full justify-center text-xs">
                                        {refunding ? 'Cancel refund' : 'Issue refund'}
                                    </button>
                                )}
                            </div>

                            {refunding && (
                                <form onSubmit={submitRefund} className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                                    <div>
                                        <span className="label">Amount (max {formatMoney(order.refundable_cents, c)})</span>
                                        <input className={field} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                                    </div>
                                    <div>
                                        <span className="label">Reason (optional)</span>
                                        <input className={field} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                                    </div>
                                    <button type="submit" className="btn-primary w-full justify-center text-xs">Refund</button>
                                </form>
                            )}

                            {order.refunds.length > 0 && (
                                <div className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                                    {order.refunds.map((r, i) => (
                                        <p key={i}>Refunded {formatMoney(r.amount_cents, c)} · {new Date(r.created_at).toLocaleDateString()}{r.reason ? ` — ${r.reason}` : ''}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className={bold ? 'font-semibold text-neutral-900' : 'text-neutral-500'}>{label}</span>
            <span className={bold ? 'font-semibold text-neutral-900' : 'text-neutral-700'}>{value}</span>
        </div>
    );
}
