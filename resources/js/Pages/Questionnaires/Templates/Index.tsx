import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface Question {
    label: string;
    type: 'text' | 'textarea' | 'date' | 'select' | 'checkbox' | 'image' | 'file';
    options: string[];
    required: boolean;
}
interface Template {
    id: number;
    name: string;
    description: string | null;
    questions: Question[];
}

const TYPES = [
    { value: 'text', label: 'Short text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown' },
    { value: 'checkbox', label: 'Yes / no' },
    { value: 'image', label: 'Image upload' },
    { value: 'file', label: 'File upload' },
];

type Editing = { id: number | null; name: string; description: string; questions: Question[] };

export default function Index({ templates }: PageProps<{ templates: Template[] }>) {
    const [editing, setEditing] = useState<Editing | null>(null);

    const startNew = () => setEditing({ id: null, name: '', description: '', questions: [{ label: '', type: 'text', options: [], required: false }] });
    const startEdit = (t: Template) => setEditing({ id: t.id, name: t.name, description: t.description ?? '', questions: t.questions.map((q) => ({ ...q, options: q.options ?? [] })) });

    const update = (i: number, patch: Partial<Question>) =>
        editing && setEditing({ ...editing, questions: editing.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

    const move = (i: number, dir: -1 | 1) => {
        if (!editing) return;
        const to = i + dir;
        if (to < 0 || to >= editing.questions.length) return;
        const questions = [...editing.questions];
        [questions[i], questions[to]] = [questions[to], questions[i]];
        setEditing({ ...editing, questions });
    };

    const save = () => {
        if (!editing) return;
        const payload = { name: editing.name, description: editing.description, questions: editing.questions.filter((q) => q.label.trim()) } as unknown as Record<string, never>;
        const opts = { preserveScroll: true, onSuccess: () => setEditing(null) };
        if (editing.id) router.patch(route('questionnaire-templates.update', editing.id), payload, opts);
        else router.post(route('questionnaire-templates.store'), payload, opts);
    };

    const del = async (t: Template) => {
        if (await confirmDialog(`Delete "${t.name}"?`)) router.delete(route('questionnaire-templates.destroy', t.id), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Questionnaire templates</h1>}
            actions={
                <>
                    <Link href={route('questionnaires.index')} className="btn-secondary">Back</Link>
                    {!editing && <button onClick={startNew} className="btn-primary">New template</button>}
                </>
            }
        >
            <Head title="Questionnaire templates" />
            <StudioManagerNav active="questionnaires" />

            <div className="mx-auto max-w-3xl px-4 sm:px-8 py-8">
                {editing ? (
                    <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
                        <div>
                            <label className="label mb-1.5">Name</label>
                            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" placeholder="e.g. Engagement shoot details" />
                        </div>
                        <div>
                            <label className="label mb-1.5">Description (optional)</label>
                            <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input" />
                        </div>
                        <div>
                            <label className="label mb-2">Questions</label>
                            <div className="space-y-3">
                                {editing.questions.map((q, i) => (
                                    <div key={i} className="rounded-lg border border-neutral-200 p-3">
                                        <div className="flex items-start gap-2">
                                            <div className="mt-1 flex flex-col text-neutral-300">
                                                <button onClick={() => move(i, -1)} disabled={i === 0} className="leading-none hover:text-neutral-700 disabled:opacity-30 disabled:hover:text-neutral-300" title="Move up">↑</button>
                                                <button onClick={() => move(i, 1)} disabled={i === editing.questions.length - 1} className="leading-none hover:text-neutral-700 disabled:opacity-30 disabled:hover:text-neutral-300" title="Move down">↓</button>
                                            </div>
                                            <input value={q.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Question" className="input flex-1" />
                                            <select value={q.type} onChange={(e) => update(i, { type: e.target.value as Question['type'] })} className="input w-36">
                                                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                            <button onClick={() => setEditing({ ...editing, questions: editing.questions.filter((_, j) => j !== i) })} className="mt-2 text-neutral-300 hover:text-red-500">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        {q.type === 'select' && (
                                            <input value={q.options.join(', ')} onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Options, comma separated" className="input mt-2" />
                                        )}
                                        <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                                            <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="rounded border-neutral-300" />
                                            Required
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setEditing({ ...editing, questions: [...editing.questions, { label: '', type: 'text', options: [], required: false }] })} className="mt-2 text-sm font-medium text-brand hover:text-brand-800">+ Add question</button>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                            <button onClick={save} disabled={!editing.name.trim()} className="btn-primary disabled:opacity-40">Save template</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {templates.length === 0 && <p className="py-12 text-center text-sm text-neutral-400">No templates yet.</p>}
                        {templates.map((t) => (
                            <div key={t.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-neutral-900">{t.name}</p>
                                    <p className="text-xs text-neutral-400">{t.questions.length} question{t.questions.length === 1 ? '' : 's'}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => startEdit(t)} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">Edit</button>
                                    <button onClick={() => del(t)} className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
