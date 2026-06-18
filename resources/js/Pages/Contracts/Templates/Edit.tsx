import StudioManagerNav from '@/Components/StudioManagerNav';
import TemplateForm, { TemplateFormData } from '@/Components/TemplateForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ContractField, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

interface Template {
    id: number;
    name: string;
    body: string | null;
    fields: ContractField[] | null;
}

export default function Edit({ template }: PageProps<{ template: Template }>) {
    const { data, setData, put, processing, errors } = useForm<TemplateFormData>({
        name: template.name,
        body: template.body ?? '',
        fields: template.fields ?? [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('contracts.templates.update', template.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('contracts.templates.index')} className="text-neutral-400 hover:text-neutral-700">Templates</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Edit template</span>
                </div>
            }
        >
            <Head title="Edit template" />
            <StudioManagerNav active="contracts" />

            <form onSubmit={submit} className="px-4 py-8 sm:px-8">
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                    <TemplateForm data={data} setData={setData} errors={errors} />
                </div>
                <div className="mt-6 flex items-center gap-2">
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save changes'}</button>
                    <Link href={route('contracts.templates.index')} className="btn-secondary">Cancel</Link>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
