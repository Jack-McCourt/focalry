import AdminLayout from '@/Layouts/AdminLayout';
import { Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface StudioRow {
    id: number;
    name: string;
    email: string;
    plan: string;
    users_count: number;
    storage_used: number;
    storage_limit: number | null;
    suspended: boolean;
    created_at: string;
}

interface Props {
    studios: Paginated<StudioRow>;
    filters: { search: string };
}

function formatBytes(bytes: number, limit: number | null): string {
    const GB = 1024 ** 3;
    const used = bytes >= GB ? `${(bytes / GB).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
    if (limit === null) return `${used} / ∞`;
    const lim = limit >= 1024 ** 4 ? `${(limit / 1024 ** 4).toFixed(0)} TB` : `${(limit / GB).toFixed(0)} GB`;
    return `${used} / ${lim}`;
}

export default function StudiosIndex({ studios, filters }: Props) {
    const [search, setSearch] = useState(filters.search);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('admin.studios.index'), search ? { search } : {}, { preserveState: true, replace: true });
    };

    return (
        <AdminLayout header={<h1 className="text-sm font-semibold text-neutral-900">Studios</h1>}>
            <Head title="Admin · Studios" />

            <div className="mx-auto max-w-6xl px-6 py-6">
                <form onSubmit={submit} className="mb-4 flex gap-2">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email or slug…"
                        className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                    />
                    <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
                        Search
                    </button>
                </form>

                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                <th className="px-4 py-3 font-medium">Studio</th>
                                <th className="px-4 py-3 font-medium">Plan</th>
                                <th className="px-4 py-3 font-medium">Users</th>
                                <th className="px-4 py-3 font-medium">Storage</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {studios.data.map((s) => (
                                <tr
                                    key={s.id}
                                    onClick={() => router.visit(route('admin.studios.show', s.id))}
                                    className="cursor-pointer hover:bg-neutral-50"
                                >
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-neutral-900">{s.name}</p>
                                        <p className="text-xs text-neutral-400">{s.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-600">
                                            {s.plan}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600">{s.users_count}</td>
                                    <td className="px-4 py-3 text-xs text-neutral-500">
                                        {formatBytes(s.storage_used, s.storage_limit)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {s.suspended ? (
                                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                                                Suspended
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {studios.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-400">
                                        No studios found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {(studios.prev_page_url || studios.next_page_url) && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">
                            Page {studios.current_page} of {studios.last_page} · {studios.total} total
                        </span>
                        <div className="flex gap-2">
                            <Link
                                href={studios.prev_page_url ?? '#'}
                                preserveState
                                className={`rounded-lg border px-3 py-1.5 ${studios.prev_page_url ? 'border-neutral-300 hover:bg-neutral-50' : 'pointer-events-none border-neutral-100 text-neutral-300'}`}
                            >
                                Previous
                            </Link>
                            <Link
                                href={studios.next_page_url ?? '#'}
                                preserveState
                                className={`rounded-lg border px-3 py-1.5 ${studios.next_page_url ? 'border-neutral-300 hover:bg-neutral-50' : 'pointer-events-none border-neutral-100 text-neutral-300'}`}
                            >
                                Next
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
