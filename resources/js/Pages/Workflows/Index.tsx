import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

interface Row {
    id: number;
    name: string;
    trigger: string;
    trigger_label: string;
    trigger_status: string | null;
    is_active: boolean;
    steps_count: number;
    runs_count: number;
}

export default function Index({ workflows }: PageProps<{ workflows: Row[]; triggers: Record<string, string> }>) {
    const toggle = (w: Row) => router.post(route('workflows.toggle', w.id), {}, { preserveScroll: true });

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>
                    <Link href={route('workflows.create')} className="btn-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        New workflow
                    </Link>
                </div>
            }
        >
            <Head title="Workflows" />
            <StudioManagerNav active="workflows" />

            <div className="px-4 sm:px-8 py-8">
                <p className="mb-6 max-w-2xl text-sm text-neutral-500">
                    Automate your studio: when something happens — a project is booked, an invoice is paid, a contract is signed — run a series of steps like sending an email, creating tasks or sending a questionnaire.
                </p>

                {workflows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">No workflows yet</p>
                        <p className="mt-1 text-sm text-neutral-500">Set up your first automation to save hours of repetitive admin.</p>
                        <Link href={route('workflows.create')} className="btn-primary mt-6">New workflow</Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {workflows.map((w) => (
                            <div key={w.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-4">
                                <Link href={route('workflows.edit', w.id)} className="min-w-0 flex-1">
                                    <p className="font-medium text-neutral-900">{w.name}</p>
                                    <p className="mt-0.5 text-sm text-neutral-500">
                                        When: {w.trigger_label}{w.trigger_status ? ` → ${w.trigger_status}` : ''} · {w.steps_count} step{w.steps_count === 1 ? '' : 's'} · run {w.runs_count}×
                                    </p>
                                </Link>
                                <div className="ml-4 flex items-center gap-4">
                                    <button
                                        onClick={() => toggle(w)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${w.is_active ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                                        title={w.is_active ? 'Active' : 'Paused'}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${w.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                    <Link href={route('workflows.edit', w.id)} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">Edit</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
