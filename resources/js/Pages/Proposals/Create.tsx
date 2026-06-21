import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, Link, useForm } from '@inertiajs/react';

interface PackageOpt { id: number; name: string; price_cents: number; deposit_cents: number | null; currency: string }
interface ContractOpt { id: number; title: string; project_id: number | null; status: string }
interface InvoiceOpt { id: number; label: string; project_id: number | null }

export default function Create({
    projects,
    packages,
    contracts,
    invoices,
    preselect_project_id,
}: PageProps<{
    projects: { id: number; name: string }[];
    packages: PackageOpt[];
    contracts: ContractOpt[];
    invoices: InvoiceOpt[];
    preselect_project_id: number | null;
}>) {
    const form = useForm<{
        project_id: string;
        title: string;
        intro: string;
        package_id: string;
        contract_id: string;
        invoice_id: string;
        require_signature: boolean;
        require_deposit: boolean;
    }>({
        project_id: preselect_project_id ? String(preselect_project_id) : '',
        title: '',
        intro: '',
        package_id: '',
        contract_id: '',
        invoice_id: '',
        require_signature: true,
        require_deposit: true,
    });

    const pid = form.data.project_id ? Number(form.data.project_id) : null;
    const projectContracts = contracts.filter((c) => !pid || c.project_id === pid);
    const projectInvoices = invoices.filter((i) => !pid || i.project_id === pid);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('proposals.store'));
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">New proposal</h1>}>
            <Head title="New proposal" />
            <StudioManagerNav active="proposals" />

            <form onSubmit={submit} className="mx-auto max-w-2xl px-4 sm:px-8 py-8 space-y-6">
                <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
                    <div>
                        <label className="label mb-1.5">Project</label>
                        <select value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} className="input">
                            <option value="">Choose a project…</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {form.errors.project_id && <p className="mt-1 text-xs text-red-600">{form.errors.project_id}</p>}
                    </div>
                    <div>
                        <label className="label mb-1.5">Title</label>
                        <input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} className="input" placeholder="e.g. Wedding photography proposal" />
                        {form.errors.title && <p className="mt-1 text-xs text-red-600">{form.errors.title}</p>}
                    </div>
                    <div>
                        <label className="label mb-1.5">Intro message (optional)</label>
                        <textarea value={form.data.intro} onChange={(e) => form.setData('intro', e.target.value)} rows={4} className="input" placeholder="A short note that appears at the top of the proposal." />
                    </div>
                </div>

                <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
                    <h2 className="text-sm font-semibold text-neutral-900">What's included</h2>
                    <div>
                        <label className="label mb-1.5">Package (optional — shown for context)</label>
                        <select value={form.data.package_id} onChange={(e) => form.setData('package_id', e.target.value)} className="input">
                            <option value="">None</option>
                            {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.price_cents, p.currency)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label mb-1.5">Contract to sign</label>
                        <select value={form.data.contract_id} onChange={(e) => form.setData('contract_id', e.target.value)} className="input">
                            <option value="">None</option>
                            {projectContracts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        {pid && projectContracts.length === 0 && (
                            <p className="mt-1 text-xs text-neutral-400">No contracts for this project yet — <Link href={route('contracts.create')} className="text-blue-600">create one</Link>.</p>
                        )}
                    </div>
                    <div>
                        <label className="label mb-1.5">Invoice / deposit to pay</label>
                        <select value={form.data.invoice_id} onChange={(e) => form.setData('invoice_id', e.target.value)} className="input">
                            <option value="">None</option>
                            {projectInvoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                        </select>
                        {pid && projectInvoices.length === 0 && (
                            <p className="mt-1 text-xs text-neutral-400">No invoices for this project yet — <Link href={route('invoices.create')} className="text-blue-600">create one</Link>.</p>
                        )}
                    </div>

                    <div className="space-y-2 border-t border-neutral-100 pt-4">
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input type="checkbox" checked={form.data.require_signature} onChange={(e) => form.setData('require_signature', e.target.checked)} className="rounded border-neutral-300" />
                            Require the contract to be signed to accept
                        </label>
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input type="checkbox" checked={form.data.require_deposit} onChange={(e) => form.setData('require_deposit', e.target.checked)} className="rounded border-neutral-300" />
                            Require the deposit to be paid to accept
                        </label>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={form.processing} className="btn-primary disabled:opacity-40">Create proposal</button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
