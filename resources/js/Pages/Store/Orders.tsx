import StoreNav from '@/Components/StoreNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import Paginator from '@/Components/Paginator';

interface OrderRow {
    id: number;
    number: string;
    customer_name: string;
    status: string;
    fulfilment: string;
    total_cents: number;
    currency: string;
    items_count: number;
    created_at: string;
}

interface Paginator<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-neutral-100 text-neutral-600',
    paid: 'bg-brand-50 text-brand-700',
    in_production: 'bg-amber-50 text-amber-700',
    shipped: 'bg-indigo-50 text-indigo-700',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-neutral-100 text-neutral-500',
    refunded: 'bg-rose-50 text-rose-700',
};

const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Orders({
    orders,
    filter_status,
    statuses,
    totals,
    default_currency,
}: PageProps<{
    orders: Paginator<OrderRow>;
    filter_status: string | null;
    statuses: string[];
    totals: { revenue_cents: number; payout_cents: number; open: number };
    default_currency: string;
}>) {
    const filter = (status: string | null) =>
        router.get(route('store.orders.index'), status ? { status } : {}, { preserveState: true, replace: true });

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Store</h1>}>
            <Head title="Store · Orders" />
            <StoreNav active="orders" />

            <div className="px-4 py-8 sm:px-8">
                <div className="mb-6 grid gap-3 sm:grid-cols-3">
                    <Stat label="Revenue" value={formatMoney(totals.revenue_cents, default_currency)} />
                    <Stat label="Your payout" value={formatMoney(totals.payout_cents, default_currency)} />
                    <Stat label="Open orders" value={String(totals.open)} />
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <Chip active={!filter_status} onClick={() => filter(null)}>All</Chip>
                    {statuses.map((s) => (
                        <Chip key={s} active={filter_status === s} onClick={() => filter(s)}>
                            {label(s)}
                        </Chip>
                    ))}
                </div>

                {orders.data.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No orders yet</p>
                        <p className="mt-1 text-sm text-neutral-400">Orders placed from your galleries show up here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium">Order</th>
                                    <th className="px-4 py-2.5 font-medium">Customer</th>
                                    <th className="px-4 py-2.5 font-medium">Status</th>
                                    <th className="px-4 py-2.5 font-medium">Items</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.data.map((o) => (
                                    <tr
                                        key={o.id}
                                        onClick={() => router.visit(route('store.orders.show', o.id))}
                                        className="cursor-pointer border-b border-neutral-50 hover:bg-neutral-50 last:border-0"
                                    >
                                        <td className="px-4 py-2.5">
                                            <span className="font-medium text-neutral-900">{o.number}</span>
                                            <span className="block text-[11px] text-neutral-400">
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-700">{o.customer_name}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_STYLES[o.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                                                {label(o.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-500">{o.items_count}</td>
                                        <td className="px-4 py-2.5 text-right font-medium text-neutral-900">
                                            {formatMoney(o.total_cents, o.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Paginator paginator={orders} />
            </div>
        </AuthenticatedLayout>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium text-neutral-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{value}</p>
        </div>
    );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
        >
            {children}
        </button>
    );
}
