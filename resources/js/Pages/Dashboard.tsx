import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    Bar,
    BarChart,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface SeriesPoint {
    key: string;
    label: string;
    year: string;
    show_year: boolean;
    earned_cents?: number;
    projected_cents?: number;
}

interface TypeSlice {
    label: string;
    color: string;
    cents: number;
}

interface ClientRow {
    name: string;
    cents: number;
}

interface UpcomingRow {
    invoice_id: number;
    number: string;
    client: string;
    due_date: string;
    amount_cents: number;
}

interface Kpis {
    earned_last_12_cents: number;
    earned_this_month_cents: number;
    avg_month_cents: number;
    projected_total_cents: number;
    projected_next_12_cents: number;
    due_next_30_cents: number;
    overdue_cents: number;
    overdue_count: number;
    outstanding_cents: number;
}

interface DashboardProps extends PageProps {
    currency: string;
    earnings: SeriesPoint[];
    projected: SeriesPoint[];
    revenueByType: TypeSlice[];
    statusBreakdown: Record<string, number>;
    topClients: ClientRow[];
    upcomingPayments: UpcomingRow[];
    kpis: Kpis;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
    paid: { label: 'Paid', color: '#22c55e' },
    partial: { label: 'Partially paid', color: '#f59e0b' },
    sent: { label: 'Awaiting payment', color: '#3b82f6' },
    overdue: { label: 'Overdue', color: '#ef4444' },
    draft: { label: 'Draft', color: '#9ca3af' },
};

/** Compact axis labels, e.g. 7000000 cents → "£70k". */
function compactMoney(cents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format((cents ?? 0) / 100);
}

function monthTick(p: SeriesPoint): string {
    return p.show_year ? `${p.label} ’${p.year.slice(2)}` : p.label;
}

type ChartType = 'line' | 'bar';

function ChartTypeToggle({
    value,
    onChange,
}: {
    value: ChartType;
    onChange: (t: ChartType) => void;
}) {
    const options: { type: ChartType; label: string }[] = [
        { type: 'line', label: 'Line' },
        { type: 'bar', label: 'Bar' },
    ];
    return (
        <div className="inline-flex rounded-md border border-neutral-200 p-0.5">
            {options.map((o) => (
                <button
                    key={o.type}
                    type="button"
                    onClick={() => onChange(o.type)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                        value === o.type
                            ? 'bg-neutral-900 text-white'
                            : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function Dashboard(props: DashboardProps) {
    const { auth } = usePage<PageProps>().props;
    const {
        currency,
        earnings,
        projected,
        revenueByType,
        statusBreakdown,
        topClients,
        upcomingPayments,
        kpis,
    } = props;

    const typeTotal = revenueByType.reduce((s, t) => s + t.cents, 0);

    const [earningsChart, setEarningsChart] = useState<ChartType>('line');
    const [projectedChart, setProjectedChart] = useState<ChartType>('line');

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Dashboard</h1>}
        >
            <Head title="Dashboard" />

            <div className="px-4 py-8 sm:px-8">
                {/* Welcome */}
                <div className="mb-8">
                    <h2 className="text-2xl font-light text-neutral-900">
                        Welcome back, {auth.user?.name?.split(' ')[0]}.
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        Your business at a glance — earnings, projections, and what's due.
                    </p>
                </div>

                {/* KPI cards */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Kpi
                        label="Collected (last 12 mo)"
                        value={formatMoney(kpis.earned_last_12_cents, currency)}
                        sub={`${formatMoney(kpis.earned_this_month_cents, currency)} this month`}
                        accent="text-neutral-900"
                    />
                    <Kpi
                        label="Projected (next 24 mo)"
                        value={formatMoney(kpis.projected_total_cents, currency)}
                        sub={`${formatMoney(kpis.projected_next_12_cents, currency)} in next 12 mo`}
                        accent="text-emerald-600"
                    />
                    <Kpi
                        label="Overdue"
                        value={formatMoney(kpis.overdue_cents, currency)}
                        sub={`${kpis.overdue_count} payment${kpis.overdue_count === 1 ? '' : 's'} past due`}
                        accent={kpis.overdue_cents > 0 ? 'text-red-600' : 'text-neutral-900'}
                    />
                    <Kpi
                        label="Avg / month"
                        value={formatMoney(kpis.avg_month_cents, currency)}
                        sub={`${formatMoney(kpis.outstanding_cents, currency)} outstanding`}
                        accent="text-neutral-900"
                    />
                </div>

                {/* Earnings chart */}
                <div className="card mb-6 p-6">
                    <div className="mb-4 flex items-baseline justify-between">
                        <h3 className="font-semibold text-neutral-900">Earnings</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-neutral-500">Collected · last 12 months</span>
                            <ChartTypeToggle value={earningsChart} onChange={setEarningsChart} />
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {earningsChart === 'line' ? (
                                <LineChart data={earnings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis
                                        dataKey="label"
                                        tickFormatter={(_, i) => monthTick(earnings[i])}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        width={56}
                                        tickFormatter={(v) => compactMoney(v, currency)}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: '#e5e7eb' }}
                                        formatter={(v) => [formatMoney(Number(v), currency), 'Collected']}
                                        labelFormatter={(_, pl) => {
                                            const p = pl?.[0]?.payload as SeriesPoint | undefined;
                                            return p ? `${p.label} ${p.year}` : '';
                                        }}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="earned_cents"
                                        stroke="#4f46e5"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            ) : (
                                <BarChart data={earnings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis
                                        dataKey="label"
                                        tickFormatter={(_, i) => monthTick(earnings[i])}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        width={56}
                                        tickFormatter={(v) => compactMoney(v, currency)}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f3f4f6' }}
                                        formatter={(v) => [formatMoney(Number(v), currency), 'Collected']}
                                        labelFormatter={(_, pl) => {
                                            const p = pl?.[0]?.payload as SeriesPoint | undefined;
                                            return p ? `${p.label} ${p.year}` : '';
                                        }}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar dataKey="earned_cents" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Projected chart */}
                <div className="card mb-6 p-6">
                    <div className="mb-4 flex items-baseline justify-between">
                        <h3 className="font-semibold text-neutral-900">Projected income</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-neutral-500">
                                Outstanding instalments · next 24 months
                            </span>
                            <ChartTypeToggle value={projectedChart} onChange={setProjectedChart} />
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {projectedChart === 'line' ? (
                                <LineChart data={projected} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis
                                        dataKey="label"
                                        tickFormatter={(_, i) => monthTick(projected[i])}
                                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                                        interval={0}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        width={56}
                                        tickFormatter={(v) => compactMoney(v, currency)}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: '#e5e7eb' }}
                                        formatter={(v) => [formatMoney(Number(v), currency), 'Projected']}
                                        labelFormatter={(_, pl) => {
                                            const p = pl?.[0]?.payload as SeriesPoint | undefined;
                                            return p ? `${p.label} ${p.year}` : '';
                                        }}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="projected_cents"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            ) : (
                                <BarChart data={projected} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis
                                        dataKey="label"
                                        tickFormatter={(_, i) => monthTick(projected[i])}
                                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                                        interval={0}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        width={56}
                                        tickFormatter={(v) => compactMoney(v, currency)}
                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f3f4f6' }}
                                        formatter={(v) => [formatMoney(Number(v), currency), 'Projected']}
                                        labelFormatter={(_, pl) => {
                                            const p = pl?.[0]?.payload as SeriesPoint | undefined;
                                            return p ? `${p.label} ${p.year}` : '';
                                        }}
                                        contentStyle={tooltipStyle}
                                    />
                                    <Bar dataKey="projected_cents" fill="#10b981" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue by type + status */}
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">Revenue by type</h3>
                        {typeTotal === 0 ? (
                            <EmptyHint>No revenue recorded yet.</EmptyHint>
                        ) : (
                            <div className="flex items-center gap-6">
                                <div className="relative h-44 w-44 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={revenueByType}
                                                dataKey="cents"
                                                nameKey="label"
                                                innerRadius={55}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                stroke="none"
                                            >
                                                {revenueByType.map((t) => (
                                                    <Cell key={t.label} fill={t.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(v, n) => [formatMoney(Number(v), currency), n]}
                                                contentStyle={tooltipStyle}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                                            Total
                                        </span>
                                        <span className="text-sm font-semibold text-neutral-900">
                                            {formatMoney(typeTotal, currency)}
                                        </span>
                                    </div>
                                </div>
                                <ul className="flex-1 space-y-2">
                                    {revenueByType.map((t) => (
                                        <li key={t.label} className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-neutral-600">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: t.color }}
                                                />
                                                {t.label}
                                            </span>
                                            <span className="font-medium text-neutral-900">
                                                {formatMoney(t.cents, currency)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">Invoice status</h3>
                        <ul className="space-y-3">
                            {Object.entries(STATUS_META).map(([key, meta]) => {
                                const count = statusBreakdown[key] ?? 0;
                                const total = Object.values(statusBreakdown).reduce((s, n) => s + n, 0) || 1;
                                return (
                                    <li key={key}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-neutral-600">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: meta.color }}
                                                />
                                                {meta.label}
                                            </span>
                                            <span className="font-medium text-neutral-900">{count}</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${(count / total) * 100}%`,
                                                    backgroundColor: meta.color,
                                                }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* Top clients + upcoming payments */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">Top clients</h3>
                        {topClients.length === 0 ? (
                            <EmptyHint>No payments yet.</EmptyHint>
                        ) : (
                            <ul className="space-y-3">
                                {topClients.map((c) => (
                                    <li key={c.name} className="flex items-center justify-between text-sm">
                                        <span className="truncate text-neutral-700">{c.name}</span>
                                        <span className="ml-3 shrink-0 font-medium text-neutral-900">
                                            {formatMoney(c.cents, currency)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="card p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold text-neutral-900">Upcoming payments</h3>
                            <Link href="/invoices" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                                All invoices →
                            </Link>
                        </div>
                        {upcomingPayments.length === 0 ? (
                            <EmptyHint>Nothing due in the near future.</EmptyHint>
                        ) : (
                            <ul className="divide-y divide-neutral-100">
                                {upcomingPayments.map((u) => (
                                    <li key={`${u.invoice_id}-${u.due_date}-${u.amount_cents}`}>
                                        <Link
                                            href={`/invoices/${u.invoice_id}`}
                                            className="flex items-center justify-between py-2.5 text-sm hover:opacity-70"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-neutral-800">{u.client}</span>
                                                <span className="text-xs text-neutral-400">
                                                    {u.number} · due{' '}
                                                    {new Date(u.due_date).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </span>
                                            <span className="ml-3 shrink-0 font-medium text-neutral-900">
                                                {formatMoney(u.amount_cents, currency)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

const tooltipStyle = {
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
} as const;

function Kpi({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: string;
    sub: string;
    accent: string;
}) {
    return (
        <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
            <p className="mt-1 text-xs text-neutral-500">{sub}</p>
        </div>
    );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
    return <p className="py-8 text-center text-sm text-neutral-400">{children}</p>;
}
