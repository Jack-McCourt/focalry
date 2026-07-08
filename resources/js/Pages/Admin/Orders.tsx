import AdminLayout from '@/Layouts/AdminLayout';
import { formatMoney } from '@/lib/money';
import { Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Paginator from '@/Components/Paginator';

interface OrderRow {
    id: number;
    number: string;
    customer_name: string;
    status: string;
    total_cents: number;
    payout_cents: number;
    currency: string;
    studio: { id: number; name: string } | null;
    created_at: string;
}

interface Props {
    orders: Paginated<OrderRow>;
    filters: { status: string | null; search: string };
    statuses: string[];
    currency: string;
    totals: { gmv_cents: number; payout_cents: number; count: number };
}

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-neutral-100 text-neutral-500',
    paid: 'bg-brand-50 text-brand-700',
    in_production: 'bg-amber-50 text-amber-700',
    shipped: 'bg-indigo-50 text-indigo-700',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-neutral-100 text-neutral-400',
    refunded: 'bg-red-50 text-red-600',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
        </div>
    );
}

export default function AdminOrders({ orders, filters, statuses, currency, totals }: Props) {
    const [search, setSearch] = useState(filters.search);

    const apply = (params: Record<string, string | null>) =>
        router.get(route('admin.orders.index'), { status: filters.status, search, ...params }, { preserveState: true, replace: true });

    return (
        <AdminLayout header={<h1 className="text-sm font-semibold text-neutral-900">Orders</h1>}>
            <Head title="Admin · Orders" />

            <div className="mx-auto max-w-6xl px-6 py-6">
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                    <Stat label="GMV" value={formatMoney(totals.gmv_cents, currency)} sub={`${totals.count} orders`} />
                    <Stat label="Studio payouts" value={formatMoney(totals.payout_cents, currency)} />
                    <Stat
                        label="Platform take"
                        value={formatMoney(totals.gmv_cents - totals.payout_cents, currency)}
                        sub="GMV − payouts"
                    />
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            apply({ search });
                        }}
                        className="flex gap-2"
                    >
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Order #, customer…"
                            className="w-56 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                        />
                    </form>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => apply({ status: e.target.value || null })}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                    >
                        <option value="">All statuses</option>
                        {statuses.map((s) => (
                            <option key={s} value={s}>
                                {s.replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                <th className="px-4 py-3 font-medium">Order</th>
                                <th className="px-4 py-3 font-medium">Studio</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 text-right font-medium">Total</th>
                                <th className="px-4 py-3 text-right font-medium">Payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {orders.data.map((o) => (
                                <tr key={o.id} className="hover:bg-neutral-50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-neutral-900">{o.number}</p>
                                        <p className="text-xs text-neutral-400">{o.customer_name}</p>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600">
                                        {o.studio ? (
                                            <Link
                                                href={route('admin.studios.show', o.studio.id)}
                                                className="hover:text-rose-600 hover:underline"
                                            >
                                                {o.studio.name}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[o.status] ?? 'bg-neutral-100 text-neutral-500'}`}
                                        >
                                            {o.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-neutral-700">
                                        {formatMoney(o.total_cents, o.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-neutral-500">
                                        {formatMoney(o.payout_cents, o.currency)}
                                    </td>
                                </tr>
                            ))}
                            {orders.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-400">
                                        No orders found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Paginator paginator={orders} />
            </div>
        </AdminLayout>
    );
}
