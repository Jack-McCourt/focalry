import AdminLayout from '@/Layouts/AdminLayout';
import { formatMoney } from '@/lib/money';
import { Head, Link, router, useForm } from '@inertiajs/react';

interface StudioData {
    id: number;
    name: string;
    email: string;
    slug: string;
    plan: string;
    commission_rate: number;
    effective_commission: number;
    storage_used: number;
    storage_limit: number | null;
    storage_limit_override_gb: number | null;
    suspended_at: string | null;
    created_at: string;
    custom_domain: string | null;
    default_currency: string;
    users_count: number;
    subscription: { status: string; active: boolean } | null;
}

interface Props {
    studio: StudioData;
    users: { id: number; name: string; email: string; role: string }[];
    counts: { collections: number; orders: number };
    plans: { key: string; name: string }[];
    currency: string;
}

function formatBytes(bytes: number, limit: number | null): string {
    const GB = 1024 ** 3;
    const used = bytes >= GB ? `${(bytes / GB).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
    if (limit === null) return `${used} of Unlimited`;
    const lim = limit >= 1024 ** 4 ? `${(limit / 1024 ** 4).toFixed(0)} TB` : `${(limit / GB).toFixed(0)} GB`;
    return `${used} of ${lim}`;
}

export default function StudioShow({ studio, users, counts, plans, currency }: Props) {
    const { data, setData, patch, processing } = useForm<{
        plan: string;
        commission_rate: number;
        storage_limit_gb: string;
    }>({
        plan: studio.plan,
        commission_rate: studio.commission_rate,
        storage_limit_gb: studio.storage_limit_override_gb != null ? String(studio.storage_limit_override_gb) : '',
    });

    const save = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('admin.studios.update', studio.id), { preserveScroll: true });
    };

    const suspend = () =>
        router.post(route('admin.studios.suspend', studio.id), {}, { preserveScroll: true });

    const impersonate = (userId: number) =>
        router.post(route('admin.users.impersonate', userId));

    const destroy = () => {
        if (confirm(`Permanently delete "${studio.name}" and all its data? This cannot be undone.`)) {
            router.delete(route('admin.studios.destroy', studio.id));
        }
    };

    return (
        <AdminLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('admin.studios.index')} className="text-neutral-400 hover:text-neutral-700">
                        Studios
                    </Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">{studio.name}</span>
                </div>
            }
        >
            <Head title={`Admin · ${studio.name}`} />

            <div className="mx-auto max-w-5xl px-6 py-6">
                {studio.suspended_at && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        This studio is suspended — its users are locked out.
                    </div>
                )}

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Left: overview */}
                    <div className="space-y-5 lg:col-span-1">
                        <div className="rounded-xl border border-neutral-200 bg-white p-5">
                            <h2 className="text-sm font-semibold text-neutral-900">Overview</h2>
                            <dl className="mt-3 space-y-2 text-sm">
                                <Row label="Email" value={studio.email} />
                                <Row label="Slug" value={studio.slug} />
                                <Row label="Currency" value={studio.default_currency.toUpperCase()} />
                                <Row label="Domain" value={studio.custom_domain || '—'} />
                                <Row label="Storage" value={formatBytes(studio.storage_used, studio.storage_limit)} />
                                <Row label="Commission" value={`${studio.effective_commission}%`} />
                                <Row
                                    label="Subscription"
                                    value={studio.subscription ? studio.subscription.status : 'none'}
                                />
                                <Row label="Collections" value={String(counts.collections)} />
                                <Row label="Orders" value={String(counts.orders)} />
                                <Row label="Joined" value={new Date(studio.created_at).toLocaleDateString()} />
                            </dl>
                        </div>

                        <div className="rounded-xl border border-neutral-200 bg-white p-5">
                            <h2 className="text-sm font-semibold text-neutral-900">Danger zone</h2>
                            <div className="mt-3 space-y-2">
                                <button
                                    onClick={suspend}
                                    className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${
                                        studio.suspended_at
                                            ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                            : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                    }`}
                                >
                                    {studio.suspended_at ? 'Reinstate studio' : 'Suspend studio'}
                                </button>
                                <button
                                    onClick={destroy}
                                    className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                                >
                                    Delete studio
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: plan + users */}
                    <div className="space-y-5 lg:col-span-2">
                        <form onSubmit={save} className="rounded-xl border border-neutral-200 bg-white p-5">
                            <h2 className="text-sm font-semibold text-neutral-900">Plan &amp; billing override</h2>
                            <p className="mt-0.5 text-xs text-neutral-500">
                                Sets the studio’s tier directly. If they have a live Stripe subscription, change it in
                                Stripe to avoid divergence.
                            </p>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">Plan</span>
                                    <select
                                        value={data.plan}
                                        onChange={(e) => setData('plan', e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                                    >
                                        {plans.map((p) => (
                                            <option key={p.key} value={p.key}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">Commission rate (%)</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={data.commission_rate}
                                        onChange={(e) => setData('commission_rate', Number(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                                    />
                                    <span className="mt-1 block text-[11px] text-neutral-400">
                                        Only applied on the Free plan ({formatMoney(0, currency)} plans take 0%).
                                    </span>
                                </label>
                                <label className="block sm:col-span-2">
                                    <span className="text-xs font-medium text-neutral-500">Storage override (GB)</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step="any"
                                        value={data.storage_limit_gb}
                                        onChange={(e) => setData('storage_limit_gb', e.target.value)}
                                        placeholder="Leave blank to use the plan’s included storage"
                                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                                    />
                                    <span className="mt-1 block text-[11px] text-neutral-400">
                                        Overrides the plan cap for this studio only. Blank = plan default.
                                    </span>
                                </label>
                            </div>
                            <button
                                disabled={processing}
                                className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                            >
                                {processing ? 'Saving…' : 'Save changes'}
                            </button>
                        </form>

                        <div className="rounded-xl border border-neutral-200 bg-white p-5">
                            <h2 className="text-sm font-semibold text-neutral-900">Users ({studio.users_count})</h2>
                            <div className="mt-3 divide-y divide-neutral-100">
                                {users.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between py-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-neutral-900">
                                                {u.name}{' '}
                                                <span className="text-xs font-normal capitalize text-neutral-400">
                                                    · {u.role}
                                                </span>
                                            </p>
                                            <p className="truncate text-xs text-neutral-400">{u.email}</p>
                                        </div>
                                        <button
                                            onClick={() => impersonate(u.id)}
                                            className="ml-3 shrink-0 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                        >
                                            Log in as
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="truncate font-medium text-neutral-800">{value}</dd>
        </div>
    );
}
