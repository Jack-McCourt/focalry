import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SeriesPoint {
    key: string;
    label: string;
    show_year: boolean;
    year: string;
    collected_cents: number;
    expenses_cents: number;
}
interface Slice {
    label: string;
    color: string;
    cents: number;
}
interface OverdueRow {
    invoice_id: number;
    number: string | null;
    client: string;
    due_date: string;
    days_late: number;
    amount_cents: number;
}
interface ReportProps {
    currency: string;
    range: { from: string; to: string };
    kpis: {
        collected_cents: number;
        avg_month_cents: number;
        order_count: number;
        outstanding_cents: number;
        overdue_cents: number;
    };
    revenueSeries: SeriesPoint[];
    revenueBySource: Slice[];
    revenueByType: Slice[];
    receivable: {
        outstanding_cents: number;
        overdue_cents: number;
        aging: { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number };
    };
    overdue: OverdueRow[];
    leads: {
        leads: number;
        converted: number;
        conversion_rate: number;
        new_projects: number;
        package_bookings: number;
        meetings_booked: number;
    };
    pnl: {
        revenue_cents: number;
        expenses_cents: number;
        profit_cents: number;
        margin: number;
    };
    expensesByCategory: Slice[];
}

const tooltipStyle = {
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
} as const;

function compactMoney(cents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format((cents ?? 0) / 100);
}

function iso(d: Date) {
    return d.toISOString().slice(0, 10);
}

type Preset = { label: string; from: string; to: string };

function presets(): Preset[] {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = (yr: number, mo: number) => iso(new Date(yr, mo, 1));
    const end = (yr: number, mo: number) => iso(new Date(yr, mo + 1, 0));
    return [
        { label: 'This month', from: start(y, m), to: iso(now) },
        { label: 'Last month', from: start(y, m - 1), to: end(y, m - 1) },
        { label: 'Last 12 months', from: start(y, m - 11), to: iso(now) },
        { label: 'This year', from: start(y, 0), to: iso(now) },
        { label: 'Last year', from: start(y - 1, 0), to: end(y - 1, 11) },
    ];
}

function Kpi({ label, value, sub, accent = 'text-neutral-900' }: { label: string; value: string; sub?: string; accent?: string }) {
    return (
        <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
        </div>
    );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
    return <p className="py-10 text-center text-sm text-neutral-400">{children}</p>;
}

function Donut({ data, currency }: { data: Slice[]; currency: string }) {
    const total = data.reduce((s, d) => s + d.cents, 0);
    if (total === 0) return <EmptyHint>No revenue in this period.</EmptyHint>;
    return (
        <div className="flex items-center gap-6">
            <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="cents" nameKey="label" innerRadius={48} outerRadius={76} paddingAngle={2}>
                            {data.map((d) => (
                                <Cell key={d.label} fill={d.color} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatMoney(Number(v), currency)} contentStyle={tooltipStyle} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2">
                {data.map((d) => (
                    <li key={d.label} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 text-neutral-600">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            {d.label}
                        </span>
                        <span className="font-medium text-neutral-900">
                            {formatMoney(d.cents, currency)}
                            <span className="ml-1 text-xs text-neutral-400">{Math.round((d.cents / total) * 100)}%</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function Reports({
    currency,
    range,
    kpis,
    revenueSeries,
    revenueBySource,
    revenueByType,
    receivable,
    overdue,
    leads,
    pnl,
    expensesByCategory,
}: ReportProps) {
    const [from, setFrom] = useState(range.from);
    const [to, setTo] = useState(range.to);

    const apply = (f: string, t: string) => {
        setFrom(f);
        setTo(t);
        router.get(route('reports.index'), { from: f, to: t }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const aging = [
        { label: 'Current', cents: receivable.aging.current, tone: 'text-neutral-900' },
        { label: '1–30 days', cents: receivable.aging.d1_30, tone: 'text-amber-600' },
        { label: '31–60 days', cents: receivable.aging.d31_60, tone: 'text-amber-700' },
        { label: '61–90 days', cents: receivable.aging.d61_90, tone: 'text-red-600' },
        { label: '90+ days', cents: receivable.aging.d90_plus, tone: 'text-red-700' },
    ];

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Reports</h1>}>
            <Head title="Reports" />

            <div className="px-4 py-8 sm:px-8">
                {/* Range controls */}
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-light text-neutral-900">Business reports</h2>
                        <p className="mt-1 text-sm text-neutral-500">Revenue, receivables and conversion across every stream.</p>
                    </div>
                    <a
                        href={`${route('reports.export.revenue')}?from=${from}&to=${to}`}
                        className="btn-secondary px-3 py-2 text-xs"
                    >
                        Export revenue CSV
                    </a>
                </div>

                <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
                    <div className="flex flex-wrap gap-1.5">
                        {presets().map((p) => {
                            const active = p.from === from && p.to === to;
                            return (
                                <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => apply(p.from, p.to)}
                                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                                        active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="ml-auto flex items-end gap-2">
                        <label className="text-xs text-neutral-500">
                            From
                            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input mt-1 block text-xs" />
                        </label>
                        <label className="text-xs text-neutral-500">
                            To
                            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input mt-1 block text-xs" />
                        </label>
                        <button type="button" onClick={() => apply(from, to)} className="btn-primary px-3 py-2 text-xs">
                            Apply
                        </button>
                    </div>
                </div>

                {/* KPIs */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Kpi
                        label="Collected"
                        value={formatMoney(kpis.collected_cents, currency)}
                        sub={`${kpis.order_count} payment${kpis.order_count === 1 ? '' : 's'} in range`}
                        accent="text-emerald-600"
                    />
                    <Kpi label="Avg / month" value={formatMoney(kpis.avg_month_cents, currency)} sub="Across selected range" />
                    <Kpi label="Outstanding" value={formatMoney(kpis.outstanding_cents, currency)} sub="Unpaid invoice balances (now)" />
                    <Kpi
                        label="Overdue"
                        value={formatMoney(kpis.overdue_cents, currency)}
                        sub="Past their due date (now)"
                        accent={kpis.overdue_cents > 0 ? 'text-red-600' : 'text-neutral-900'}
                    />
                </div>

                {/* Revenue over time */}
                <div className="card mb-6 p-6">
                    <div className="mb-4 flex items-baseline justify-between">
                        <h3 className="font-semibold text-neutral-900">Revenue vs expenses</h3>
                        <span className="text-xs text-neutral-500">By month</span>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <XAxis
                                    dataKey="label"
                                    tickFormatter={(_, i) =>
                                        revenueSeries[i]?.show_year ? `${revenueSeries[i].label} ’${revenueSeries[i].year.slice(2)}` : revenueSeries[i]?.label
                                    }
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
                                    formatter={(v, name) => [formatMoney(Number(v), currency), name === 'collected_cents' ? 'Revenue' : 'Expenses']}
                                    labelFormatter={(_, pl) => {
                                        const p = pl?.[0]?.payload as SeriesPoint | undefined;
                                        return p ? `${p.label} ${p.year}` : '';
                                    }}
                                    contentStyle={tooltipStyle}
                                />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(v) => <span className="text-xs text-neutral-500">{v === 'collected_cents' ? 'Revenue' : 'Expenses'}</span>}
                                />
                                <Bar dataKey="collected_cents" fill="#2a305d" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                <Bar dataKey="expenses_cents" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Profit & loss */}
                <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">Profit &amp; loss</h3>
                        <dl className="space-y-3">
                            <div className="flex items-center justify-between">
                                <dt className="text-sm text-neutral-500">Revenue collected</dt>
                                <dd className="font-medium text-neutral-900">{formatMoney(pnl.revenue_cents, currency)}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-sm text-neutral-500">Expenses</dt>
                                <dd className="font-medium text-amber-600">−{formatMoney(pnl.expenses_cents, currency)}</dd>
                            </div>
                            <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                                <dt className="text-sm font-semibold text-neutral-900">Net profit</dt>
                                <dd className={`text-lg font-semibold ${pnl.profit_cents >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatMoney(pnl.profit_cents, currency)}
                                    <span className="ml-2 text-xs font-normal text-neutral-400">{pnl.margin}% margin</span>
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">Expenses by category</h3>
                        <Donut data={expensesByCategory} currency={currency} />
                    </div>
                </div>

                {/* Source + Type */}
                <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">By revenue stream</h3>
                        <Donut data={revenueBySource} currency={currency} />
                    </div>
                    <div className="card p-6">
                        <h3 className="mb-4 font-semibold text-neutral-900">By project type</h3>
                        <Donut data={revenueByType} currency={currency} />
                    </div>
                </div>

                {/* Accounts receivable */}
                <div className="card mb-6 p-6">
                    <div className="mb-4 flex items-baseline justify-between">
                        <h3 className="font-semibold text-neutral-900">Accounts receivable</h3>
                        <span className="text-xs text-neutral-500">As of today</span>
                    </div>
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {aging.map((a) => (
                            <div key={a.label} className="rounded-lg border border-neutral-200 p-3">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{a.label}</p>
                                <p className={`mt-1 text-lg font-semibold ${a.tone}`}>{formatMoney(a.cents, currency)}</p>
                            </div>
                        ))}
                    </div>
                    {overdue.length === 0 ? (
                        <EmptyHint>Nothing overdue. 🎉</EmptyHint>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                                        <th className="py-2 pr-4 font-medium">Invoice</th>
                                        <th className="py-2 pr-4 font-medium">Client</th>
                                        <th className="py-2 pr-4 font-medium">Due</th>
                                        <th className="py-2 pr-4 font-medium">Late</th>
                                        <th className="py-2 pr-4 text-right font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overdue.map((o) => (
                                        <tr
                                            key={`${o.invoice_id}-${o.due_date}`}
                                            className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50"
                                            onClick={() => router.visit(route('invoices.show', o.invoice_id))}
                                        >
                                            <td className="py-2.5 pr-4 font-medium text-neutral-900">{o.number ?? `#${o.invoice_id}`}</td>
                                            <td className="py-2.5 pr-4 text-neutral-600">{o.client}</td>
                                            <td className="py-2.5 pr-4 text-neutral-600">{o.due_date}</td>
                                            <td className="py-2.5 pr-4 text-red-600">{o.days_late}d</td>
                                            <td className="py-2.5 pr-4 text-right font-medium text-neutral-900">
                                                {formatMoney(o.amount_cents, currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Lead conversion */}
                <div className="card p-6">
                    <h3 className="mb-4 font-semibold text-neutral-900">Leads &amp; conversion</h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                        <Kpi label="New leads" value={String(leads.leads)} />
                        <Kpi label="Converted" value={String(leads.converted)} />
                        <Kpi label="Conversion" value={`${leads.conversion_rate}%`} accent="text-emerald-600" />
                        <Kpi label="New projects" value={String(leads.new_projects)} />
                        <Kpi label="Package bookings" value={String(leads.package_bookings)} />
                        <Kpi label="Meetings booked" value={String(leads.meetings_booked)} />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
