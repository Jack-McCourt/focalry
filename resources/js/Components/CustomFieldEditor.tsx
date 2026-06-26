import FileField, { FileRef } from '@/Components/FileField';
import ImageField, { ImageRef } from '@/Components/ImageField';
import { ProjectFieldDefinition } from '@/types';
import { useEffect, useState } from 'react';

export type CustomValue = string | number | boolean | null | ImageRef[] | FileRef[];

/** Renders the right inline editor for a custom field's value. Text-like inputs
 * commit on blur; checkbox/select/date commit immediately. */
export default function CustomFieldEditor({
    field,
    value,
    onChange,
    multiline = false,
}: {
    field: ProjectFieldDefinition;
    value: CustomValue;
    onChange: (v: CustomValue) => void;
    multiline?: boolean;
}) {
    const [local, setLocal] = useState<CustomValue>(value);
    useEffect(() => setLocal(value), [value]);

    const base = 'w-full rounded border-0 bg-transparent px-1 py-1 text-sm focus:ring-1 focus:ring-neutral-300';
    const str = local == null ? '' : String(local);

    switch (field.type) {
        case 'checkbox':
            return (
                <input
                    type="checkbox"
                    checked={!!local}
                    onChange={(e) => { setLocal(e.target.checked); onChange(e.target.checked); }}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                />
            );
        case 'number':
            return (
                <input
                    type="number"
                    value={str}
                    onChange={(e) => setLocal(e.target.value === '' ? null : Number(e.target.value))}
                    onBlur={() => onChange(local)}
                    className={base}
                />
            );
        case 'date':
            return (
                <input
                    type="date"
                    value={str}
                    onChange={(e) => { const v = e.target.value || null; setLocal(v); onChange(v); }}
                    className={base}
                />
            );
        case 'select':
            return (
                <select
                    value={str}
                    onChange={(e) => { const v = e.target.value || null; setLocal(v); onChange(v); }}
                    className={base}
                >
                    <option value="">—</option>
                    {(field.options ?? []).map((o) => (
                        <option key={o.label} value={o.label}>{o.label}</option>
                    ))}
                </select>
            );
        case 'long_text':
            return multiline ? (
                <textarea value={str} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} rows={3} className="input" />
            ) : (
                <input type="text" value={str} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} className={base} />
            );
        case 'url':
            return <input type="url" value={str} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} placeholder="https://" className={base} />;
        case 'image': {
            const imgs = Array.isArray(local) ? (local as ImageRef[]) : [];
            return <ImageField images={imgs} label={field.label} showThumbs={multiline} onChange={(v) => { setLocal(v); onChange(v); }} />;
        }
        case 'file': {
            const files = Array.isArray(local) ? (local as FileRef[]) : [];
            return <FileField files={files} label={field.label} onChange={(v) => { setLocal(v); onChange(v); }} />;
        }
        default:
            return <input type="text" value={str} onChange={(e) => setLocal(e.target.value)} onBlur={() => onChange(local)} className={base} />;
    }
}
