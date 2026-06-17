import InvoiceForm, { blankItem, InvoiceFormData, PaymentMethod } from '@/Components/InvoiceForm';
import InvoiceFormErrors from '@/Components/InvoiceFormErrors';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

interface Defaults {
    payment_methods: PaymentMethod[];
    tax_rate: number;
    notes: string;
}

export default function Create({
    projects,
    next_number,
    preselect_project_id,
    default_currency,
    defaults,
}: PageProps<{
    projects: { id: number; name: string }[];
    next_number: string;
    preselect_project_id: number | null;
    default_currency: string;
    defaults: Defaults;
}>) {
    const { data, setData, post, processing, errors } = useForm<InvoiceFormData>({
        project_id: preselect_project_id,
        number: next_number,
        currency: default_currency,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: '',
        discount_cents: 0,
        tax_rate: defaults.tax_rate ?? 0,
        notes: defaults.notes ?? '',
        payment_methods: defaults.payment_methods ?? ['card'],
        items: [blankItem()],
        schedules: [],
        reminder_offsets: [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('invoices.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('invoices.index')} className="text-neutral-400 hover:text-neutral-700">Invoices</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">New invoice</span>
                </div>
            }
        >
            <Head title="New invoice" />
            <StudioManagerNav active="invoices" />

            <form onSubmit={submit} className="px-8 py-8">
                <InvoiceFormErrors errors={errors} />
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                    <InvoiceForm data={data} setData={setData} errors={errors} projects={projects} />
                </div>
                <div className="mt-4">
                    <InvoiceFormErrors errors={errors} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <button type="submit" disabled={processing} className="btn-primary">
                        {processing ? 'Saving…' : 'Create invoice'}
                    </button>
                    <Link href={route('invoices.index')} className="btn-secondary">Cancel</Link>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
