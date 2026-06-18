import ContractForm, { ContractFormData, fillFromProject, ProjectOption } from '@/Components/ContractForm';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { InvoiceOption } from '@/Components/StudioFieldValues';
import { ContractField, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

interface Template {
    id: number;
    name: string;
    body: string | null;
    fields: ContractField[] | null;
}

export default function Create({
    projects,
    invoices,
    templates,
    preselect_project_id,
}: PageProps<{ projects: ProjectOption[]; invoices: InvoiceOption[]; templates: Template[]; preselect_project_id: number | null }>) {
    const { data, setData, post, processing, errors } = useForm<ContractFormData>({
        project_id: preselect_project_id,
        title: '',
        body: '',
        fields: [],
    });

    const applyTemplate = (id: string) => {
        const tpl = templates.find((t) => String(t.id) === id);
        if (!tpl) return;
        setData('body', tpl.body ?? '');
        // If a project is already chosen, pre-fill the template's email + event-date fields.
        const proj = projects.find((p) => p.id === data.project_id);
        const fields = proj ? fillFromProject(tpl.fields ?? [], proj) : tpl.fields ?? [];
        setData('fields', fields);
        if (data.title.trim() === '') setData('title', `${tpl.name} Agreement`);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('contracts.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('contracts.index')} className="text-neutral-400 hover:text-neutral-700">Contracts</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">New contract</span>
                </div>
            }
        >
            <Head title="New contract" />
            <StudioManagerNav active="contracts" />

            <form onSubmit={submit} className="px-4 py-8 sm:px-8">
                {templates.length > 0 && (
                    <div className="mb-4 max-w-xs">
                        <label className="label mb-1.5">Start from a template</label>
                        <select onChange={(e) => applyTemplate(e.target.value)} className="input" defaultValue="">
                            <option value="">Blank contract</option>
                            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                    <ContractForm data={data} setData={setData} errors={errors} projects={projects} invoices={invoices} />
                </div>
                <div className="mt-6 flex items-center gap-2">
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Create contract'}</button>
                    <Link href={route('contracts.index')} className="btn-secondary">Cancel</Link>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
