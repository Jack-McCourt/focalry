import ContractForm, { ContractFormData, ProjectOption } from '@/Components/ContractForm';
import StudioManagerNav from '@/Components/StudioManagerNav';
import { InvoiceOption } from '@/Components/StudioFieldValues';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Contract, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Edit({
    contract,
    projects,
    invoices,
}: PageProps<{ contract: Contract; projects: ProjectOption[]; invoices: InvoiceOption[] }>) {
    const { data, setData, put, processing, errors } = useForm<ContractFormData>({
        project_id: contract.project_id,
        title: contract.title,
        body: contract.body ?? '',
        fields: contract.fields ?? [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('contracts.update', contract.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('contracts.index')} className="text-neutral-400 hover:text-neutral-700">Contracts</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Edit contract</span>
                </div>
            }
        >
            <Head title="Edit contract" />
            <StudioManagerNav active="contracts" />

            <form onSubmit={submit} className="px-4 py-8 sm:px-8">
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                    <ContractForm data={data} setData={setData} errors={errors} projects={projects} invoices={invoices} />
                </div>
                <div className="mt-6 flex items-center gap-2">
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save changes'}</button>
                    <Link href={route('contracts.show', contract.id)} className="btn-secondary">Cancel</Link>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
