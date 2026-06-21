import AdminLayout from '@/Layouts/AdminLayout';
import { Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

interface LogRow {
    id: number;
    action: string;
    description: string | null;
    actor: string;
    ip: string | null;
    meta: Record<string, unknown> | null;
    created_at: string;
}

interface Props {
    logs: Paginated<LogRow>;
    filters: { action: string };
    actions: string[];
}

const ACTION_STYLES: Record<string, string> = {
    'studio.suspend': 'bg-amber-50 text-amber-700',
    'studio.delete': 'bg-red-50 text-red-600',
    'content.takedown_collection': 'bg-red-50 text-red-600',
    'content.takedown_site': 'bg-red-50 text-red-600',
    'impersonate.start': 'bg-rose-50 text-rose-700',
    'impersonate.stop': 'bg-neutral-100 text-neutral-500',
};

export default function AdminAudit({ logs, filters, actions }: Props) {
    return (
        <AdminLayout header={<h1 className="text-sm font-semibold text-neutral-900">Audit log</h1>}>
            <Head title="Admin · Audit log" />

            <div className="mx-auto max-w-5xl px-6 py-6">
                <div className="mb-4">
                    <select
                        value={filters.action}
                        onChange={(e) =>
                            router.get(
                                route('admin.audit.index'),
                                e.target.value ? { action: e.target.value } : {},
                                { preserveState: true, replace: true },
                            )
                        }
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                    >
                        <option value="">All actions</option>
                        {actions.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                <th className="px-4 py-3 font-medium">When</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                                <th className="px-4 py-3 font-medium">Details</th>
                                <th className="px-4 py-3 font-medium">Admin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {logs.data.map((log) => (
                                <tr key={log.id} className="align-top hover:bg-neutral-50">
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-400">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_STYLES[log.action] ?? 'bg-neutral-100 text-neutral-600'}`}
                                        >
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-700">
                                        {log.description}
                                        {log.ip && <span className="ml-2 text-[11px] text-neutral-300">{log.ip}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-500">{log.actor}</td>
                                </tr>
                            ))}
                            {logs.data.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-neutral-400">
                                        No activity yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {(logs.prev_page_url || logs.next_page_url) && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">
                            Page {logs.current_page} of {logs.last_page} · {logs.total} total
                        </span>
                        <div className="flex gap-2">
                            <Link
                                href={logs.prev_page_url ?? '#'}
                                preserveState
                                className={`rounded-lg border px-3 py-1.5 ${logs.prev_page_url ? 'border-neutral-300 hover:bg-neutral-50' : 'pointer-events-none border-neutral-100 text-neutral-300'}`}
                            >
                                Previous
                            </Link>
                            <Link
                                href={logs.next_page_url ?? '#'}
                                preserveState
                                className={`rounded-lg border px-3 py-1.5 ${logs.next_page_url ? 'border-neutral-300 hover:bg-neutral-50' : 'pointer-events-none border-neutral-100 text-neutral-300'}`}
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
