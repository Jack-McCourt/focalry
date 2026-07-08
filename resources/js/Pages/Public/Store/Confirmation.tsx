import { formatMoney } from '@/lib/money';
import { Head } from '@inertiajs/react';

interface Item {
    description: string;
    qty: number;
    line_total_cents: number;
    is_digital: boolean;
    download_url: string | null;
}

interface Order {
    number: string;
    status: string;
    customer_name: string;
    currency: string;
    subtotal_cents: number;
    discount_cents: number;
    gift_card_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;
    items: Item[];
}

export default function Confirmation({
    studio,
    order,
}: {
    studio: { name: string; logo_url: string | null };
    order: Order;
}) {
    const c = order.currency;
    const paid = !['pending', 'cancelled'].includes(order.status);
    const hasDigital = order.items.some((i) => i.is_digital);

    return (
        <div className="min-h-screen bg-neutral-50 py-12">
            <Head title={`Order ${order.number}`} />
            <div className="mx-auto max-w-lg px-4">
                <div className="mb-6 text-center">
                    {studio.logo_url ? (
                        <img src={studio.logo_url} alt={studio.name} className="mx-auto h-10 object-contain" />
                    ) : (
                        <p className="text-sm font-semibold text-neutral-900">{studio.name}</p>
                    )}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        </div>
                        <h1 className="mt-3 text-lg font-semibold text-neutral-900">
                            {paid ? 'Thank you!' : 'Order received'}
                        </h1>
                        <p className="mt-1 text-sm text-neutral-500">
                            {paid
                                ? `Your order ${order.number} is confirmed.`
                                : `Order ${order.number} is awaiting payment.`}
                        </p>
                    </div>

                    <div className="mt-6 divide-y divide-neutral-50">
                        {order.items.map((i, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                <div className="min-w-0">
                                    <p className="truncate text-neutral-800">{i.description}</p>
                                    <p className="text-[11px] text-neutral-400">Qty {i.qty}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    {i.download_url && (
                                        <a href={i.download_url} className="text-xs font-medium text-brand hover:underline">Download</a>
                                    )}
                                    <span className="text-neutral-700">{formatMoney(i.line_total_cents, c)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 border-t border-neutral-100 pt-4 text-sm">
                        <Row label="Subtotal" value={formatMoney(order.subtotal_cents, c)} />
                        {order.discount_cents > 0 && <Row label="Discount" value={`−${formatMoney(order.discount_cents, c)}`} />}
                        {order.shipping_cents > 0 && <Row label="Shipping" value={formatMoney(order.shipping_cents, c)} />}
                        {order.tax_cents > 0 && <Row label="Tax" value={formatMoney(order.tax_cents, c)} />}
                        {order.gift_card_cents > 0 && <Row label="Gift card" value={`−${formatMoney(order.gift_card_cents, c)}`} />}
                        <div className="my-2 border-t border-neutral-100" />
                        <Row label="Total" value={formatMoney(order.total_cents, c)} bold />
                    </div>

                    {hasDigital && paid && (
                        <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                            Your digital downloads are ready above and have also been emailed to you.
                        </p>
                    )}
                </div>
            </div>
        </div>
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
