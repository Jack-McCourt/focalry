import AdminLayout from '@/Layouts/AdminLayout';
import { formatMoney } from '@/lib/money';
import { Head, Link } from '@inertiajs/react';

interface Props {
    currency: string;
    stats: {
        studios: number;
        suspended: number;
        users: number;
        storage_used: number;
        mrr_cents: number;
        gmv_cents: number;
        orders: number;
    };
    plans: { key: string; name: string; count: number }[];
    recentStudios: { id: number; name: string; email: string; plan: string; created_at: string }[];
}

function formatBytes(bytes: number): string {
    const TB = 1024 ** 4;
    const GB = 1024 ** 3;
    const MB = 1024 ** 2;
    if (bytes >= TB) return `${(bytes / TB).toFixed(2)} TB`;
    if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
    return `${bytes} B`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
        </div>
    );
}

export default function AdminDashboard({ currency, stats, plans, recentStudios }: Props) {
    const maxCount = Math.max(1, ...plans.map((p) => p.count));

    return (
        <AdminLayout header={<h1 className="text-sm font-semibold text-neutral-900">Dashboard</h1>}>
            <Head title="Admin · Dashboard" />

            <div className="mx-auto max-w-6xl px-6 py-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Studios" value={String(stats.studios)} sub={`${stats.suspended} suspended`} />
                    <Stat label="Users" value={String(stats.users)} />
                    <Stat label="Est. MRR" value={formatMoney(stats.mrr_cents, currency)} sub="from active plans" />
                    <Stat label="Storage used" value={formatBytes(stats.storage_used)} sub="across all studios" />
                    <Stat label="GMV" value={formatMoney(stats.gmv_cents, currency)} sub={`${stats.orders} orders`} />
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    {/* Plan distribution */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        <h2 className="text-sm font-semibold text-neutral-900">Plan distribution</h2>
                        <div className="mt-4 space-y-3">
                            {plans.map((p) => (
                                <div key={p.key} className="flex items-center gap-3">
                                    <span className="w-16 shrink-0 text-xs text-neutral-500">{p.name}</span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                                        <div
                                            className="h-full rounded-full bg-rose-500"
                                            style={{ width: `${(p.count / maxCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-xs font-medium text-neutral-700">
                                        {p.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent studios */}
                    <div className="rounded-xl border border-neutral-200 bg-white p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-neutral-900">New studios</h2>
                            <Link href={route('admin.studios.index')} className="text-xs font-medium text-rose-600 hover:underline">
                                View all
                            </Link>
                        </div>
                        <div className="mt-3 divide-y divide-neutral-100">
                            {recentStudios.map((s) => (
                                <Link
                                    key={s.id}
                                    href={route('admin.studios.show', s.id)}
                                    className="flex items-center justify-between py-2.5 hover:opacity-70"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-neutral-900">{s.name}</p>
                                        <p className="truncate text-xs text-neutral-400">{s.email}</p>
                                    </div>
                                    <span className="ml-3 shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-600">
                                        {s.plan}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
