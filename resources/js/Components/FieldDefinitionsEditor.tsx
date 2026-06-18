import { ContractField, ContractFieldType } from '@/types';
import { useState } from 'react';

const FIELD_TYPES: { value: ContractFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'multiline', label: 'Paragraph' },
    { value: 'date', label: 'Date' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'invoice', label: 'Invoice schedule' },
];

function slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

/** Collapsible editor for the contract's merge-field definitions (label/type/fill-by). */
export default function FieldDefinitionsEditor({
    fields,
    onChange,
    defaultOpen = false,
}: {
    fields: ContractField[];
    onChange: (fields: ContractField[]) => void;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState<ContractFieldType>('text');
    const [newFillBy, setNewFillBy] = useState<'studio' | 'client'>('studio');

    const addField = () => {
        if (newLabel.trim() === '') return;
        let key = slug(newLabel);
        const existing = new Set(fields.map((f) => f.key));
        let i = 1;
        while (existing.has(key)) key = `${slug(newLabel)}_${++i}`;
        onChange([...fields, { key, label: newLabel.trim(), type: newType, fill_by: newFillBy, value: null }]);
        setNewLabel('');
    };

    const updateField = (i: number, patch: Partial<ContractField>) =>
        onChange(fields.map((f, idx) => {
            if (idx !== i) return f;
            const next = { ...f, ...patch };
            // Only the studio can link an invoice, so invoice fields are studio-fill.
            if (next.type === 'invoice') next.fill_by = 'studio';
            return next;
        }));
    const removeField = (i: number) => onChange(fields.filter((_, idx) => idx !== i));

    return (
        <div className="rounded-lg border border-neutral-200">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-neutral-700">
                <span>Manage fields {fields.length > 0 && <span className="text-neutral-400">({fields.length})</span>}</span>
                <svg className={`h-4 w-4 text-neutral-400 transition ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="border-t border-neutral-200 p-4">
                    <p className="mb-3 text-xs text-neutral-500">Define the editable fields used in the contract. “Studio fills” fields are completed by you; “Client fills” fields are completed by the client at signing. Insert a field into the text with “Insert field”.</p>
                    <div className="space-y-2">
                        {fields.map((f, i) => (
                            <div key={f.key} className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">{`{{${f.key}}}`}</code>
                                <input type="text" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} className="input flex-1 min-w-[8rem]" />
                                <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as ContractFieldType })} className="input w-32">
                                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <select value={f.fill_by} onChange={(e) => updateField(i, { fill_by: e.target.value as 'studio' | 'client' })} disabled={f.type === 'invoice'} className="input w-36 disabled:opacity-50">
                                    <option value="studio">Studio fills</option>
                                    <option value="client">Client fills</option>
                                </select>
                                <button type="button" onClick={() => removeField(i)} className="text-neutral-300 hover:text-red-500" title="Remove field">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addField())} placeholder="New field label…" className="input flex-1 min-w-[8rem]" />
                            <select value={newType} onChange={(e) => setNewType(e.target.value as ContractFieldType)} className="input w-32">
                                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <select value={newFillBy} onChange={(e) => setNewFillBy(e.target.value as 'studio' | 'client')} className="input w-36">
                                <option value="studio">Studio fills</option>
                                <option value="client">Client fills</option>
                            </select>
                            <button type="button" onClick={addField} disabled={!newLabel.trim()} className="btn-secondary disabled:opacity-40">Add</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
