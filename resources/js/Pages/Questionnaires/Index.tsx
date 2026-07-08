import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

type Status = 'draft' | 'sent' | 'completed';
interface Row {
    id: number;
    title: string;
    status: Status;
    project: { id: number; name: string } | null;
    contact: { name: string } | null;
    updated_at: string;
}

const STATUS_STYLES: Record<Status, string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-brand-50 text-brand-700',
    completed: 'bg-emerald-50 text-emerald-700',
};

export default function Index({ questionnaires, filters }: PageProps<{ questionnaires: Row[]; filters: { status: string | null } }>) {
    const setStatus = (status: string | null) =>
        router.get(route('questionnaires.index'), { status: status ?? undefined }, { preserveState: true, preserveScroll: true, replace: true });

    const tabs: { key: string | null; label: string }[] = [
        { key: null, label: 'All' },
        { key: 'draft', label: 'Draft' },
        { key: 'sent', label: 'Sent' },
        { key: 'completed', label: 'Completed' },
    ];

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>}
            actions={
                <>
                    <Link href={route('questionnaires.templates.index')} className="btn-secondary">Templates</Link>
                    <Link href={route('questionnaires.create')} className="btn-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        New questionnaire
                    </Link>
                </>
            }
        >
            <Head title="Questionnaires" />
            <StudioManagerNav active="questionnaires" />

            <div className="px-4 py-8 sm:px-8">
                <div className="mb-6 flex flex-wrap gap-1.5">
                    {tabs.map((t) => {
                        const active = (filters.status ?? null) === t.key;
                        return (
                            <button key={t.label} onClick={() => setStatus(t.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {questionnaires.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">No questionnaires yet</p>
                        <p className="mt-1 text-sm text-neutral-500">Send a wedding-details form and the answers flow back to the project.</p>
                        <Link href={route('questionnaires.create')} className="btn-primary mt-6">New questionnaire</Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
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
                                {questionnaires.map((q) => (
                                    <tr key={q.id} onClick={() => router.visit(route('questionnaires.show', q.id))} className="cursor-pointer transition hover:bg-neutral-50">
                                        <td className="px-4 py-3 font-medium text-neutral-900">{q.title}</td>
                                        <td className="hidden px-4 py-3 text-neutral-600 sm:table-cell">{q.project?.name ?? '—'}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 md:table-cell">{q.contact?.name ?? '—'}</td>
                                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[q.status]}`}>{q.status}</span></td>
                                        <td className="px-4 py-3 text-right text-neutral-500">{new Date(q.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
