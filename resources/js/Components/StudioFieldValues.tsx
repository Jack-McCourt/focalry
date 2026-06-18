import { formatMoney } from '@/lib/money';
import { ContractField } from '@/types';

export interface InvoiceOption {
    id: number;
    number: string;
    project_id: number | null;
    total_cents: number;
    currency: string;
}

/**
 * Renders an input for each studio-fill field so the photographer can enter its
 * value (merged into the contract / stored as a template default). Client-fill
 * fields are listed as a note — they are completed by the client at signing.
 *
 * Invoice-type fields link to an invoice (whose payment schedule is rendered
 * into the contract automatically); these need `invoices` to offer a picker,
 * otherwise they show a note (e.g. in a template, where no contract exists yet).
 */
export default function StudioFieldValues({
    fields,
    onChange,
    heading = 'Fill in your details',
    hint,
    invoices,
    projectId,
}: {
    fields: ContractField[];
    onChange: (fields: ContractField[]) => void;
    heading?: string;
    hint?: string;
    invoices?: InvoiceOption[];
    projectId?: number | null;
}) {
    const studioFields = fields.filter((f) => f.fill_by === 'studio');
    const clientFields = fields.filter((f) => f.fill_by === 'client');

    if (studioFields.length === 0) return null;

    const setValueFor = (key: string, value: ContractField['value']) =>
        onChange(fields.map((f) => (f.key === key ? { ...f, value } : f)));

    const invoiceInput = (f: ContractField) => {
        if (!invoices) {
            return <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-400">An invoice is linked when this is used in a contract.</p>;
        }
        // Prefer invoices on the selected project, but allow any if none match.
        const onProject = projectId ? invoices.filter((i) => i.project_id === projectId) : [];
        const list = onProject.length > 0 ? onProject : invoices;
        return (
            <select value={String(f.value ?? '')} onChange={(e) => setValueFor(f.key, e.target.value || null)} className="input">
                <option value="">No invoice linked</option>
                {list.map((i) => (
                    <option key={i.id} value={i.id}>{i.number} — {formatMoney(i.total_cents, i.currency)}</option>
                ))}
            </select>
        );
    };

    const valueInput = (f: ContractField) => {
        if (f.type === 'invoice') return invoiceInput(f);
        if (f.type === 'checkbox') {
            return (
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={!!f.value} onChange={(e) => setValueFor(f.key, e.target.checked)} className="rounded border-neutral-300" />
                    Yes
                </label>
            );
        }
        if (f.type === 'multiline') {
            return <textarea value={String(f.value ?? '')} onChange={(e) => setValueFor(f.key, e.target.value)} rows={3} className="input" />;
        }
        return <input type={f.type === 'date' ? 'date' : 'text'} value={String(f.value ?? '')} onChange={(e) => setValueFor(f.key, e.target.value)} className="input" />;
    };

    return (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <h3 className="mb-1 text-sm font-semibold text-neutral-800">{heading}</h3>
            {hint && <p className="mb-4 text-xs text-neutral-500">{hint}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
                {studioFields.map((f) => (
                    <div key={f.key} className={f.type === 'multiline' || f.type === 'invoice' ? 'sm:col-span-2' : ''}>
                        <label className="label mb-1.5">{f.label}</label>
                        {valueInput(f)}
                    </div>
                ))}
            </div>
            {clientFields.length > 0 && (
                <p className="mt-4 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-600">Client completes at signing:</span> {clientFields.map((f) => f.label).join(', ')}.
                </p>
            )}
        </div>
    );
}
