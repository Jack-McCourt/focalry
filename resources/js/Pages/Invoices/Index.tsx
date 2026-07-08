import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { Invoice, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import Paginator from '@/Components/Paginator';

interface Filters {
    search: string;
    status: string | null;
    sort: string | null;
    dir: 'asc' | 'desc';
}

type SortKey = 'number' | 'client' | 'issue_date' | 'due_date' | 'status' | 'total' | 'balance';

interface Summary {
    outstanding_cents: number;
    paid_cents: number;
    draft_count: number;
}

const STATUS_STYLES: Record<Invoice['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-brand-50 text-brand-700',
    partial: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    void: 'bg-neutral-100 text-neutral-400 line-through',
};

function StatusBadge({ status }: { status: Invoice['status'] }) {
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status]}`}>
            {status}
        </span>
    );
}

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function SortHeader({
    label,
    sortKey,
    filters,
    onSort,
    align = 'left',
    className = '',
}: {
    label: string;
    sortKey: SortKey;
    filters: Filters;
    onSort: (key: SortKey) => void;
    align?: 'left' | 'right';
    className?: string;
}) {
    const active = filters.sort === sortKey;
    return (
        <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`group inline-flex items-center gap-1 font-medium transition hover:text-neutral-700 ${
                    align === 'right' ? 'flex-row-reverse' : ''
                } ${active ? 'text-neutral-900' : 'text-neutral-400'}`}
            >
                {label}
                <span className="text-[10px] leading-none">
                    {active ? (filters.dir === 'asc' ? '▲' : '▼') : <span className="opacity-0 group-hover:opacity-40">▼</span>}
                </span>
            </button>
        </th>
    );
}

export default function Index({
    invoices,
    filters,
    summary,
    currency,
}: PageProps<{ invoices: Paginated<Invoice>; filters: Filters; summary: Summary; currency: string }>) {
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    const navigate = (params: { search?: string; status?: string | null; sort?: string | null; dir?: 'asc' | 'desc' }) => {
        const next = {
            search: 'search' in params ? params.search : search,
            status: 'status' in params ? params.status : filters.status,
            sort: 'sort' in params ? params.sort : filters.sort,
            dir: 'dir' in params ? params.dir : filters.dir,
        };
        router.get(
            route('invoices.index'),
            {
                search: next.search || undefined,
                status: next.status ?? undefined,
                sort: next.sort ?? undefined,
                dir: next.sort ? next.dir : undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => navigate({ search }), 300);
        return () => clearTimeout(t);
    }, [search]);

    const setStatus = (status: string | null) => navigate({ status });

    const toggleSort = (key: SortKey) => {
        // Same column → flip direction; new column → default desc.
        const dir: 'asc' | 'desc' = filters.sort === key && filters.dir === 'desc' ? 'asc' : 'desc';
        navigate({ sort: key, dir });
    };

    const statusTabs: { key: string | null; label: string }[] = [
        { key: null, label: 'All' },
        { key: 'draft', label: 'Draft' },
        { key: 'upcoming', label: 'Upcoming' },
        { key: 'past_due', label: 'Past Due' },
        { key: 'paid', label: 'Paid' },
        { key: 'cancelled', label: 'Cancelled' },
    ];

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>}
            actions={
                <>
                    <Link href={route('invoices.settings.edit')} className="btn-secondary">Settings</Link>
                    <Link href={route('invoices.create')} className="btn-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        New invoice
                    </Link>
                </>
            }
        >
            <Head title="Invoices" />
            <StudioManagerNav active="invoices" />

            <div className="px-4 py-8 sm:px-8">
                {/* Summary cards */}
                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs font-medium text-neutral-400">Outstanding</p>
                        <p className="mt-1 text-xl font-semibold text-neutral-900">{formatMoney(summary.outstanding_cents, currency)}</p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs font-medium text-neutral-400">Paid</p>
                        <p className="mt-1 text-xl font-semibold text-neutral-900">{formatMoney(summary.paid_cents, currency)}</p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs font-medium text-neutral-400">Drafts</p>
                        <p className="mt-1 text-xl font-semibold text-neutral-900">{summary.draft_count}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {statusTabs.map((t) => {
                            const active = (filters.status ?? null) === t.key;
                            return (
                                <button
                                    key={t.label}
                                    onClick={() => setStatus(t.key)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                        active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative sm:w-64">
                        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by number or client…"
                            className="input pl-9"
                        />
                    </div>
                </div>

                {invoices.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">
                            {filters.search || filters.status ? 'No matching invoices' : 'No invoices yet'}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                            {filters.search || filters.status ? 'Try a different search or filter.' : 'Create your first invoice to bill a client.'}
                        </p>
                        {!filters.search && !filters.status && (
                            <Link href={route('invoices.create')} className="btn-primary mt-6">New invoice</Link>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <SortHeader label="Number" sortKey="number" filters={filters} onSort={toggleSort} />
                                    <SortHeader label="Client" sortKey="client" filters={filters} onSort={toggleSort} />
                                    <SortHeader label="Issued" sortKey="issue_date" filters={filters} onSort={toggleSort} className="hidden sm:table-cell" />
                                    <SortHeader label="Due" sortKey="due_date" filters={filters} onSort={toggleSort} className="hidden md:table-cell" />
                                    <SortHeader label="Status" sortKey="status" filters={filters} onSort={toggleSort} />
                                    <SortHeader label="Total" sortKey="total" filters={filters} onSort={toggleSort} align="right" />
                                    <SortHeader label="Balance" sortKey="balance" filters={filters} onSort={toggleSort} align="right" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {invoices.data.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        onClick={() => router.visit(route('invoices.show', inv.id))}
                                        className="cursor-pointer transition hover:bg-neutral-50"
                                    >
                                        <td className="px-4 py-3 font-mono font-medium text-neutral-900">{inv.number}</td>
                                        <td className="px-4 py-3 text-neutral-600">{inv.contact?.name ?? '—'}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">{fmtDate(inv.issue_date)}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 md:table-cell">{fmtDate(inv.due_date)}</td>
                                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                                        <td className="px-4 py-3 text-right text-neutral-600">{formatMoney(inv.total_cents, inv.currency)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-neutral-900">
                                            {formatMoney(Math.max(0, inv.total_cents - inv.amount_paid_cents), inv.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Paginator paginator={invoices} />
            </div>
        </AuthenticatedLayout>
    );
}
