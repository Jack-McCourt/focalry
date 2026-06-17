import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { Invoice, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface Filters {
    search: string;
    status: string | null;
}

interface Summary {
    outstanding_cents: number;
    paid_cents: number;
    draft_count: number;
}

const STATUS_STYLES: Record<Invoice['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-blue-50 text-blue-700',
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

export default function Index({
    invoices,
    filters,
    summary,
    currency,
}: PageProps<{ invoices: Paginated<Invoice>; filters: Filters; summary: Summary; currency: string }>) {
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('invoices.index'),
                { search, status: filters.status ?? undefined },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const setStatus = (status: string | null) => {
        router.get(
            route('invoices.index'),
            { search: search || undefined, status: status ?? undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const statusTabs: { key: string | null; label: string }[] = [
        { key: null, label: 'All' },
        { key: 'draft', label: 'Draft' },
        { key: 'sent', label: 'Sent' },
        { key: 'partial', label: 'Partial' },
        { key: 'paid', label: 'Paid' },
        { key: 'void', label: 'Void' },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>
                    <div className="flex items-center gap-2">
                        <Link href={route('invoices.settings.edit')} className="btn-secondary">Settings</Link>
                        <Link href={route('invoices.create')} className="btn-primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            New invoice
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title="Invoices" />
            <StudioManagerNav active="invoices" />

            <div className="px-8 py-8">
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
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <th className="px-4 py-3">Number</th>
                                    <th className="px-4 py-3">Client</th>
                                    <th className="hidden px-4 py-3 sm:table-cell">Issued</th>
                                    <th className="hidden px-4 py-3 md:table-cell">Due</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Balance</th>
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

                {invoices.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                        {invoices.prev_page_url && (
                            <button onClick={() => router.get(invoices.prev_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">Previous</button>
                        )}
                        <span className="text-xs text-neutral-500">Page {invoices.current_page} of {invoices.last_page}</span>
                        {invoices.next_page_url && (
                            <button onClick={() => router.get(invoices.next_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">Next</button>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
