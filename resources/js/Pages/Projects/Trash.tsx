import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { confirmDialog } from '@/Components/ConfirmDialog';

const opts = { preserveScroll: true };

type TrashedProject = {
    id: number;
    name: string;
    event_date: string | null;
    status: { label: string; color: string } | null;
    contact: { id: number; name: string } | null;
    deleted_at: string | null;
    purges_at: string | null;
};

function daysUntil(iso: string | null): number | null {
    if (!iso) return null;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function Trash({
    projects,
    retention_days,
}: PageProps<{ projects: TrashedProject[]; retention_days: number }>) {
    const restore = (p: TrashedProject) => router.post(route('projects.restore', p.id), {}, opts);

    const purge = async (p: TrashedProject) => {
        if (await confirmDialog(`Permanently delete “${p.name}”? This cannot be undone.`)) {
            router.delete(route('projects.force-destroy', p.id), opts);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('projects.index')} className="text-neutral-400 hover:text-neutral-700">Projects</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Trash</span>
                </div>
            }
        >
            <Head title="Project trash" />
            <StudioManagerNav active="projects" />

            <div className="px-4 py-8 sm:px-8">
                <p className="mb-5 max-w-2xl text-xs text-neutral-500">
                    Deleted projects stay here for {retention_days} days, then they're permanently removed. Restore one to return it to your pipeline.
                </p>

                {projects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center">
                        <p className="text-sm text-neutral-400">The trash is empty.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                    <th className="px-4 py-2.5 font-medium">Project</th>
                                    <th className="px-4 py-2.5 font-medium">Client</th>
                                    <th className="px-4 py-2.5 font-medium">Deleted</th>
                                    <th className="px-4 py-2.5 font-medium">Auto-removes in</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p) => {
                                    const days = daysUntil(p.purges_at);
                                    return (
                                        <tr key={p.id} className="border-b border-neutral-50 last:border-0">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">{p.name}</div>
                                                {p.status && (
                                                    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-neutral-500">
                                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.status.color }} />
                                                        {p.status.label}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-neutral-600">{p.contact?.name ?? '—'}</td>
                                            <td className="px-4 py-3 text-neutral-500">{formatDate(p.deleted_at)}</td>
                                            <td className="px-4 py-3 text-neutral-500">
                                                {days === null ? '—' : days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button type="button" onClick={() => restore(p)} className="text-xs font-medium text-neutral-700 hover:text-neutral-900">Restore</button>
                                                    <button type="button" onClick={() => purge(p)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete forever</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
