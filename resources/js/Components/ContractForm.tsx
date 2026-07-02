import FieldDefinitionsEditor from '@/Components/FieldDefinitionsEditor';
import RichTextEditor from '@/Components/LazyRichTextEditor';
import SearchSelect from '@/Components/SearchSelect';
import StudioFieldValues, { InvoiceOption } from '@/Components/StudioFieldValues';
import { ContractField } from '@/types';

export interface ContractFormData {
    project_id: number | null;
    title: string;
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

export interface ProjectOption {
    id: number;
    name: string;
    email?: string | null;
    event_date?: string | null;
}

const isEmailField = (key: string) =>
    key === 'client_email' || key === 'contact_email' || key === 'email' || key.endsWith('_email');

/** Pre-fill studio-fill email + event-date fields from a selected project. */
export function fillFromProject(fields: ContractField[], proj: ProjectOption): ContractField[] {
    return fields.map((f) => {
        if (f.fill_by !== 'studio') return f;
        if (proj.email && isEmailField(f.key)) return { ...f, value: proj.email };
        if (proj.event_date && f.key === 'event_date' && f.type === 'date') return { ...f, value: proj.event_date };
        return f;
    });
}

export default function ContractForm({
    data,
    setData,
    errors,
    projects,
    invoices,
}: {
    data: ContractFormData;
    setData: <K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) => void;
    errors: Partial<Record<string, string>>;
    projects: ProjectOption[];
    invoices: InvoiceOption[];
}) {
    const tokens = [
        ...BUILTIN_TOKENS,
        ...data.fields.map((f) => ({ label: f.label || f.key, token: f.key })),
    ];

    const onProjectChange = (id: number | null) => {
        setData('project_id', id);
        // Pre-fill the client-email and event-date fields from the selected project.
        const proj = projects.find((p) => p.id === id);
        if (proj) setData('fields', fillFromProject(data.fields, proj));
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label mb-1.5">Contract title</label>
                    <input type="text" value={data.title} onChange={(e) => setData('title', e.target.value)} className="input" placeholder="e.g. Wedding Photography Agreement" />
                    {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
                </div>
                <div>
                    <label className="label mb-1.5">Project</label>
                    <SearchSelect options={projects} value={data.project_id} onChange={onProjectChange} placeholder="Search projects…" emptyText="No projects found" />
                    {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
                    <p className="mt-1 text-xs text-neutral-400">The client is taken from the project.</p>
                </div>
            </div>

            <StudioFieldValues
                fields={data.fields}
                onChange={(f) => setData('fields', f)}
                invoices={invoices}
                projectId={data.project_id}
                hint="These values are merged into the contract. Built-in fields like the client name and event date come from the project automatically."
            />

            <div>
                <label className="label mb-1.5">Contract</label>
                <RichTextEditor value={data.body} onChange={(html) => setData('body', html)} tokens={tokens} />
                <p className="mt-1.5 text-xs text-neutral-400">Use “Insert field” to drop a merge field anywhere in the text.</p>
            </div>

            <FieldDefinitionsEditor fields={data.fields} onChange={(f) => setData('fields', f)} />
        </div>
    );
}
