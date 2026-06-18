import FieldDefinitionsEditor from '@/Components/FieldDefinitionsEditor';
import RichTextEditor from '@/Components/RichTextEditor';
import StudioFieldValues from '@/Components/StudioFieldValues';
import { ContractField } from '@/types';

export interface TemplateFormData {
    name: string;
    body: string;
    fields: ContractField[];
}

const BUILTIN_TOKENS = [
    { label: 'Client name', token: 'client_name' },
    { label: 'Project name', token: 'project_name' },
    { label: 'Event date', token: 'event_date' },
    { label: 'Studio name', token: 'studio_name' },
    { label: "Today's date", token: 'today' },
];

export default function TemplateForm({
    data,
    setData,
    errors,
}: {
    data: TemplateFormData;
    setData: <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => void;
    errors: Partial<Record<string, string>>;
}) {
    const tokens = [
        ...BUILTIN_TOKENS,
        ...data.fields.map((f) => ({ label: f.label || f.key, token: f.key })),
    ];

    return (
        <div className="space-y-6">
            <div className="max-w-md">
                <label className="label mb-1.5">Template name</label>
                <input type="text" value={data.name} onChange={(e) => setData('name', e.target.value)} className="input" placeholder="e.g. Wedding Photography" />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <StudioFieldValues
                fields={data.fields}
                onChange={(f) => setData('fields', f)}
                heading="Default values"
                hint="Optional — anything entered here is pre-filled when this template is used. Built-in fields like client name and event date come from the project automatically."
            />

            <div>
                <label className="label mb-1.5">Contract body</label>
                <RichTextEditor value={data.body} onChange={(html) => setData('body', html)} tokens={tokens} />
                <p className="mt-1.5 text-xs text-neutral-400">Use “Insert field” to drop a merge field anywhere in the text.</p>
            </div>

            <FieldDefinitionsEditor fields={data.fields} onChange={(f) => setData('fields', f)} defaultOpen />
        </div>
    );
}
