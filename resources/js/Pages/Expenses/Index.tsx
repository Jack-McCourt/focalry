import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';
import Paginator from '@/Components/Paginator';

interface ExpenseRow {
    id: number;
    spent_on: string;
    category: string;
    vendor: string | null;
    description: string | null;
    amount_cents: number;
    currency: string;
    project: { id: number; name: string } | null;
    billable: boolean;
    has_receipt: boolean;
}
interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}
interface ExpensesProps {
    currency: string;
    range: { from: string; to: string };
    filters: { category: string; project_id: number | null };
    expenses: Paginated<ExpenseRow>;
    total_cents: number;
    byCategory: { label: string; cents: number }[];
    categories: string[];
    projects: { id: number; name: string }[];
}

type FormState = {
    spent_on: string;
    category: string;
    vendor: string;
    description: string;
    amount: string;
    currency: string;
    project_id: string;
    billable: boolean;
    notes: string;
    receipt: File | null;
};

function blankForm(currency: string): FormState {
    return {
        spent_on: new Date().toISOString().slice(0, 10),
        category: '',
        vendor: '',
        description: '',
        amount: '',
        currency,
        project_id: '',
        billable: false,
        notes: '',
        receipt: null,
    };
}

function ExpenseModal({
    show,
    onClose,
    editing,
    currency,
    categories,
    projects,
}: {
    show: boolean;
    onClose: () => void;
    editing: ExpenseRow | null;
    currency: string;
    categories: string[];
    projects: { id: number; name: string }[];
}) {
    const form = useForm<FormState>(
        editing
            ? {
                  spent_on: editing.spent_on,
                  category: editing.category,
                  vendor: editing.vendor ?? '',
                  description: editing.description ?? '',
                  amount: centsToInput(editing.amount_cents),
                  currency: editing.currency,
                  project_id: editing.project ? String(editing.project.id) : '',
                  billable: editing.billable,
                  notes: '',
                  receipt: null,
              }
            : blankForm(currency),
    );

    const amountError = (form.errors as Record<string, string>).amount_cents;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            amount_cents: toCents(data.amount),
            billable: data.billable ? 1 : 0,
            project_id: data.project_id || '',
        }));
        const opts = { forceFormData: true, preserveScroll: true, onSuccess: () => onClose() };
        if (editing) {
            form.post(route('expenses.update', editing.id), opts);
        } else {
            form.post(route('expenses.store'), opts);
        }
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="xl">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-5 text-base font-semibold text-neutral-900">{editing ? 'Edit expense' : 'New expense'}</h2>

                <div className="grid grid-cols-2 gap-4">
                    <label className="text-xs font-medium text-neutral-500">
                        Date
                        <input type="date" value={form.data.spent_on} onChange={(e) => form.setData('spent_on', e.target.value)} className="input mt-1 block w-full" />
                        {form.errors.spent_on && <p className="mt-1 text-xs text-red-600">{form.errors.spent_on}</p>}
                    </label>
                    <label className="text-xs font-medium text-neutral-500">
                        Amount
                        <input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={form.data.amount}
                            onChange={(e) => form.setData('amount', e.target.value)}
                            className="input mt-1 block w-full"
                        />
                        {amountError && <p className="mt-1 text-xs text-red-600">{amountError}</p>}
                    </label>
                    <label className="col-span-2 text-xs font-medium text-neutral-500">
                        Category
                        <input
                            list="expense-categories"
                            value={form.data.category}
                            onChange={(e) => form.setData('category', e.target.value)}
                            placeholder="Choose or type a category"
                            className="input mt-1 block w-full"
                        />
                        <datalist id="expense-categories">
                            {categories.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                        {form.errors.category && <p className="mt-1 text-xs text-red-600">{form.errors.category}</p>}
                    </label>
                    <label className="text-xs font-medium text-neutral-500">
                        Vendor
                        <input value={form.data.vendor} onChange={(e) => form.setData('vendor', e.target.value)} className="input mt-1 block w-full" />
                    </label>
                    <label className="text-xs font-medium text-neutral-500">
                        Project (optional)
                        <select value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} className="input mt-1 block w-full">
                            <option value="">—</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="col-span-2 text-xs font-medium text-neutral-500">
                        Description
                        <input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} className="input mt-1 block w-full" />
                    </label>
                    <label className="col-span-2 text-xs font-medium text-neutral-500">
                        Receipt (optional)
                        <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf,.webp,.heic"
                            onChange={(e) => form.setData('receipt', e.target.files?.[0] ?? null)}
                            className="mt-1 block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
                        />
                        {form.errors.receipt && <p className="mt-1 text-xs text-red-600">{form.errors.receipt}</p>}
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={form.data.billable} onChange={(e) => form.setData('billable', e.target.checked)} className="rounded border-neutral-300" />
                        Billable to client
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
                        Cancel
                    </button>
                    <button type="submit" disabled={form.processing} className="btn-primary px-4 py-2 text-sm">
                        {form.processing ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function Expenses({ currency, range, filters, expenses, total_cents, byCategory, categories, projects }: ExpensesProps) {
    const [from, setFrom] = useState(range.from);
    const [to, setTo] = useState(range.to);
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<ExpenseRow | null>(null);

    const reload = (params: Record<string, string | number | null>) =>
        router.get(route('expenses.index'), { from, to, category: filters.category, project_id: filters.project_id, ...params }, { preserveState: true, preserveScroll: true, replace: true });

    const openNew = () => {
        setEditing(null);
        setModal(true);
    };
    const openEdit = (row: ExpenseRow) => {
        setEditing(row);
        setModal(true);
    };
    const remove = async (row: ExpenseRow) => {
        if (await confirmDialog('Delete this expense?')) {
            router.delete(route('expenses.destroy', row.id), { preserveScroll: true });
        }
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Expenses</h1>}>
            <Head title="Expenses" />

            <div className="px-4 py-8 sm:px-8">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-light text-neutral-900">Expenses</h2>
                        <p className="mt-1 text-sm text-neutral-500">Track costs and see true profit alongside your reports.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={`${route('expenses.export')}?from=${from}&to=${to}`} className="btn-secondary px-3 py-2 text-xs">
                            Export CSV
                        </a>
                        <button onClick={openNew} className="btn-primary px-3 py-2 text-sm">
                            New expense
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
                    <label className="text-xs text-neutral-500">
                        From
                        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input mt-1 block text-xs" />
                    </label>
                    <label className="text-xs text-neutral-500">
                        To
                        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input mt-1 block text-xs" />
                    </label>
                    <label className="text-xs text-neutral-500">
                        Category
                        <select value={filters.category} onChange={(e) => reload({ category: e.target.value })} className="input mt-1 block text-xs">
                            <option value="">All</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="button" onClick={() => reload({ from, to })} className="btn-primary px-3 py-2 text-xs">
                        Apply
                    </button>
                    <div className="ml-auto text-right">
                        <p className="text-xs uppercase tracking-wide text-neutral-400">Total</p>
                        <p className="text-xl font-semibold text-neutral-900">{formatMoney(total_cents, currency)}</p>
                    </div>
                </div>

                {/* Category chips */}
                {byCategory.length > 0 && (
                    <div className="mb-6 flex flex-wrap gap-2">
                        {byCategory.map((c) => (
                            <span key={c.label} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                                {c.label} · <span className="font-medium text-neutral-900">{formatMoney(c.cents, currency)}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Table */}
                <div className="card overflow-x-auto">
                    {expenses.data.length === 0 ? (
                        <p className="py-16 text-center text-sm text-neutral-400">No expenses in this period. Add your first one.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium">Category</th>
                                    <th className="px-4 py-3 font-medium">Details</th>
                                    <th className="px-4 py-3 font-medium">Project</th>
                                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.data.map((e) => (
                                    <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                                        <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{e.spent_on}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-neutral-900">{e.category}</span>
                                            {e.billable && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand">Billable</span>}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">
                                            {[e.vendor, e.description].filter(Boolean).join(' · ') || '—'}
                                            {e.has_receipt && (
                                                <a href={route('expenses.receipt', e.id)} target="_blank" rel="noreferrer" className="ml-2 text-xs text-neutral-400 underline hover:text-neutral-700">
                                                    receipt
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">{e.project?.name ?? '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">{formatMoney(e.amount_cents, e.currency)}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            <button onClick={() => openEdit(e)} className="text-xs text-neutral-500 hover:text-neutral-900">
                                                Edit
                                            </button>
                                            <button onClick={() => remove(e)} className="ml-3 text-xs text-red-500 hover:text-red-700">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <Paginator paginator={expenses} />
            </div>

            <ExpenseModal show={modal} onClose={() => setModal(false)} editing={editing} currency={currency} categories={categories} projects={projects} />
        </AuthenticatedLayout>
    );
}
