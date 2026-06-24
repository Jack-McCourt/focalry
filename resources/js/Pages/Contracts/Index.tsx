import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Contract, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface Filters {
    search: string;
    status: string | null;
}

type ContractRow = {
    id: number;
    title: string;
    status: Contract['status'];
    project: { id: number; name: string } | null;
    contact: { name: string } | null;
    updated_at: string;
};

const STATUS_STYLES: Record<Contract['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-blue-50 text-blue-700',
    signed: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-red-50 text-red-700',
    void: 'bg-neutral-100 text-neutral-400 line-through',
};

function StatusBadge({ status }: { status: Contract['status'] }) {
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
    contracts,
    filters,
}: PageProps<{ contracts: Paginated<ContractRow>; filters: Filters }>) {
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('contracts.index'),
                { search, status: filters.status ?? undefined },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const setStatus = (status: string | null) => {
        router.get(
            route('contracts.index'),
            { search: search || undefined, status: status ?? undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const statusTabs: { key: string | null; label: string }[] = [
        { key: null, label: 'All' },
        { key: 'draft', label: 'Draft' },
        { key: 'sent', label: 'Sent' },
        { key: 'signed', label: 'Signed' },
        { key: 'declined', label: 'Declined' },
        { key: 'void', label: 'Void' },
    ];

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>}
            actions={
                <>
                    <Link href={route('contracts.templates.index')} className="btn-secondary">Templates</Link>
                    <Link href={route('contracts.create')} className="btn-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        New contract
                    </Link>
                </>
            }
        >
            <Head title="Contracts" />
            <StudioManagerNav active="contracts" />

            <div className="px-4 sm:px-8 py-8">
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
                        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title…" className="input pl-9" />
                    </div>
                </div>

                {contracts.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">
                            {filters.search || filters.status ? 'No matching contracts' : 'No contracts yet'}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                            {filters.search || filters.status ? 'Try a different search or filter.' : 'Create a contract to send to a client for signing.'}
                        </p>
                        {!filters.search && !filters.status && (
                            <Link href={route('contracts.create')} className="btn-primary mt-6">New contract</Link>
                        )}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <th className="px-4 py-3">Title</th>
                                    <th className="hidden px-4 py-3 sm:table-cell">Project</th>
                                    <th className="hidden px-4 py-3 md:table-cell">Client</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {contracts.data.map((c) => (
                                    <tr key={c.id} onClick={() => router.visit(route('contracts.show', c.id))} className="cursor-pointer transition hover:bg-neutral-50">
                                        <td className="px-4 py-3 font-medium text-neutral-900">{c.title}</td>
                                        <td className="hidden px-4 py-3 text-neutral-600 sm:table-cell">{c.project?.name ?? '—'}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 md:table-cell">{c.contact?.name ?? '—'}</td>
                                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                        <td className="px-4 py-3 text-right text-neutral-500">{fmtDate(c.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {contracts.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                        {contracts.prev_page_url && (
                            <button onClick={() => router.get(contracts.prev_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">Previous</button>
                        )}
                        <span className="text-xs text-neutral-500">Page {contracts.current_page} of {contracts.last_page}</span>
                        {contracts.next_page_url && (
                            <button onClick={() => router.get(contracts.next_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">Next</button>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
