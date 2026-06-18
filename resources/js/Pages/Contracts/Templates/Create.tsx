import StudioManagerNav from '@/Components/StudioManagerNav';
import TemplateForm, { TemplateFormData } from '@/Components/TemplateForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm<TemplateFormData>({
        name: '',
        body: '',
        fields: [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('contracts.templates.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('contracts.templates.index')} className="text-neutral-400 hover:text-neutral-700">Templates</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">New template</span>
                </div>
            }
        >
            <Head title="New template" />
            <StudioManagerNav active="contracts" />

            <form onSubmit={submit} className="px-4 py-8 sm:px-8">
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                    <TemplateForm data={data} setData={setData} errors={errors} />
                </div>
                <div className="mt-6 flex items-center gap-2">
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Create template'}</button>
                    <Link href={route('contracts.templates.index')} className="btn-secondary">Cancel</Link>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
