import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface DayPoint { date: string; views: number }
interface Counted { path?: string; referrer_host?: string; utm_source?: string; c: number }

export default function Analytics({
    range_days,
    series,
    total_views,
    total_leads,
    conversion,
    top_pages,
    top_referrers,
    unique_visitors,
    devices,
    top_sources,
    is_published,
}: PageProps<{
    public_url: string;
    is_published: boolean;
    range_days: number;
    series: DayPoint[];
    total_views: number;
    total_leads: number;
    conversion: number;
    top_pages: Counted[];
    top_referrers: Counted[];
    unique_visitors: number;
    devices: Record<string, number>;
    top_sources: Counted[];
}>) {
    const max = Math.max(1, ...series.map((d) => d.views));
    const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Website analytics</h1>}
        >
            <Head title="Website analytics" />

            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
                {!is_published && (
                    <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">Your site isn’t published yet, so there’s no traffic to measure.</p>
                )}

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label={`Views (${range_days}d)`} value={total_views.toLocaleString()} />
                    <Stat label="Unique visitors" value={unique_visitors.toLocaleString()} />
                    <Stat label={`Leads (${range_days}d)`} value={total_leads.toLocaleString()} />
                    <Stat label="Conversion" value={`${conversion}%`} />
                </div>

                {Object.keys(devices ?? {}).length > 0 && (
                    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
                        <p className="mb-3 text-sm font-semibold text-neutral-900">Devices</p>
                        {(() => {
                            const total = Object.values(devices).reduce((a, b) => a + Number(b), 0) || 1;
                            const order: [string, string][] = [['mobile', 'bg-neutral-900'], ['desktop', 'bg-neutral-500'], ['tablet', 'bg-neutral-300']];
                            return (
                                <>
                                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                                        {order.map(([k, cls]) => (devices[k] ? <div key={k} className={cls} style={{ width: `${(Number(devices[k]) / total) * 100}%` }} /> : null))}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
                                        {order.map(([k]) => (devices[k] ? <span key={k} className="capitalize">{k}: <strong className="text-neutral-800">{Math.round((Number(devices[k]) / total) * 100)}%</strong></span> : null))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
                    <p className="mb-4 text-sm font-semibold text-neutral-900">Page views</p>
                    <div className="flex h-40 items-end gap-0.5">
                        {series.map((d) => (
                            <div key={d.date} className="group relative flex-1" title={`${fmtDay(d.date)}: ${d.views}`}>
                                <div className="w-full rounded-t bg-neutral-900/80 transition group-hover:bg-neutral-900" style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views > 0 ? 2 : 0 }} />
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
                        <span>{series.length > 0 ? fmtDay(series[0].date) : ''}</span>
                        <span>{series.length > 0 ? fmtDay(series[series.length - 1].date) : ''}</span>
                    </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-3">
                    <TopList title="Top pages" rows={top_pages.map((r) => ({ label: r.path === '/' || !r.path ? 'Home' : `/${r.path}`, c: r.c }))} empty="No views yet." />
                    <TopList title="Top referrers" rows={top_referrers.map((r) => ({ label: r.referrer_host || 'Direct', c: r.c }))} empty="No referrers yet." />
                    <TopList title="Campaigns (utm_source)" rows={top_sources.map((r) => ({ label: r.utm_source || '—', c: r.c }))} empty="No campaign traffic yet — tag your links with ?utm_source=…" />
                </div>

                <p className="mt-6 text-xs text-neutral-400">Privacy-friendly counts — no cookies, IPs, or personal data are stored. Obvious bots are excluded.</p>
            </div>
        </AuthenticatedLayout>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
        </div>
    );
}

function TopList({ title, rows, empty }: { title: string; rows: { label: string; c: number }[]; empty: string }) {
    const max = Math.max(1, ...rows.map((r) => r.c));
    return (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="mb-4 text-sm font-semibold text-neutral-900">{title}</p>
            {rows.length === 0 ? (
                <p className="text-sm text-neutral-400">{empty}</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((r, i) => (
                        <div key={i} className="relative flex items-center justify-between overflow-hidden rounded-md px-2.5 py-1.5 text-sm">
                            <div className="absolute inset-y-0 left-0 rounded-md bg-neutral-100" style={{ width: `${(r.c / max) * 100}%` }} />
                            <span className="relative truncate text-neutral-700">{r.label}</span>
                            <span className="relative ml-2 font-medium text-neutral-900">{r.c}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
