import InvoiceForm, { blankItem, InvoiceFormData, PaymentMethod } from '@/Components/InvoiceForm';
import InvoiceFormErrors from '@/Components/InvoiceFormErrors';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Invoice, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Edit({
    invoice,
    projects,
}: PageProps<{ invoice: Invoice; projects: { id: number; name: string }[] }>) {
    const { data, setData, put, processing, errors } = useForm<InvoiceFormData>({
        project_id: invoice.project_id,
        number: invoice.number,
        currency: invoice.currency,
        issue_date: invoice.issue_date ?? '',
        due_date: invoice.due_date ?? '',
        discount_cents: invoice.discount_cents,
        tax_rate: invoice.tax_rate,
        notes: invoice.notes ?? '',
        payment_methods: (invoice.payment_methods as PaymentMethod[] | null) ?? ['card'],
        items:
            invoice.items && invoice.items.length > 0
                ? invoice.items.map((it) => ({
                      description: it.description,
                      quantity: it.quantity,
                      unit_amount_cents: it.unit_amount_cents,
                  }))
                : [blankItem()],
        schedules: (invoice.schedules ?? []).map((s) => ({
            amount_cents: s.amount_cents,
            due_date: s.due_date ?? '',
        })),
        reminder_offsets: invoice.reminder_offsets ?? [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('invoices.update', invoice.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('invoices.index')} className="text-neutral-400 hover:text-neutral-700">Invoices</Link>
                    <span className="text-neutral-300">/</span>
                    <Link href={route('invoices.show', invoice.id)} className="text-neutral-400 hover:text-neutral-700">{invoice.number}</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Edit</span>
                </div>
            }
        >
            <Head title={`Edit ${invoice.number}`} />
            <StudioManagerNav active="invoices" />

            <form onSubmit={submit} className="px-4 sm:px-8 py-8">
                <InvoiceFormErrors errors={errors} />
                <div className="rounded-xl border border-neutral-200 bg-white p-6">
                    <InvoiceForm data={data} setData={setData} errors={errors} projects={projects} />
                </div>
                <div className="mt-4">
                    <InvoiceFormErrors errors={errors} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <button type="submit" disabled={processing} className="btn-primary">
                        {processing ? 'Saving…' : 'Save invoice'}
                    </button>
                    <Link href={route('invoices.show', invoice.id)} className="btn-secondary">Cancel</Link>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
