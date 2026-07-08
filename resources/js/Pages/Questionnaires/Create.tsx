import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

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

export default function Create({
    projects,
    templates,
    preselect_project_id,
}: PageProps<{ projects: { id: number; name: string }[]; templates: Template[]; preselect_project_id: number | null }>) {
    const form = useForm<{ project_id: string; title: string; template_id: string; questions: Question[] }>({
        project_id: preselect_project_id ? String(preselect_project_id) : '',
        title: '',
        template_id: '',
        questions: [{ label: '', type: 'text', options: [], required: false }],
    });

    const loadTemplate = (id: string) => {
        form.setData('template_id', id);
        const t = templates.find((t) => String(t.id) === id);
        if (t) {
            form.setData('questions', t.questions.map((q) => ({ ...q, options: q.options ?? [] })));
            if (!form.data.title) form.setData('title', t.name);
        }
    };

    const update = (i: number, patch: Partial<Question>) =>
        form.setData('questions', form.data.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, questions: d.questions.filter((q) => q.label.trim()) }));
        form.post(route('questionnaires.store'));
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">New questionnaire</h1>}>
            <Head title="New questionnaire" />
            <StudioManagerNav active="questionnaires" />

            <form onSubmit={submit} className="mx-auto max-w-3xl px-4 sm:px-8 py-8">
                <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="label mb-1.5">Project</label>
                            <select value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} className="input">
                                <option value="">Choose a project…</option>
                                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {form.errors.project_id && <p className="mt-1 text-xs text-red-600">{form.errors.project_id}</p>}
                        </div>
                        <div>
                            <label className="label mb-1.5">Start from a template</label>
                            <select value={form.data.template_id} onChange={(e) => loadTemplate(e.target.value)} className="input">
                                <option value="">Blank</option>
                                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="label mb-1.5">Title</label>
                        <input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} className="input" placeholder="e.g. Wedding details" />
                        {form.errors.title && <p className="mt-1 text-xs text-red-600">{form.errors.title}</p>}
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <h2 className="text-sm font-semibold text-neutral-900">Questions</h2>
                    {form.data.questions.map((q, i) => (
                        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
                            <div className="flex items-start gap-2">
                                <input value={q.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Question" className="input flex-1" />
                                <select value={q.type} onChange={(e) => update(i, { type: e.target.value as Question['type'] })} className="input w-36">
                                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <button type="button" onClick={() => form.setData('questions', form.data.questions.filter((_, j) => j !== i))} className="mt-2 text-neutral-300 hover:text-red-500">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            {q.type === 'select' && (
                                <input
                                    value={q.options.join(', ')}
                                    onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                                    placeholder="Options, comma separated"
                                    className="input mt-2"
                                />
                            )}
                            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                                <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="rounded border-neutral-300" />
                                Required
                            </label>
                        </div>
                    ))}
                    <button type="button" onClick={() => form.setData('questions', [...form.data.questions, { label: '', type: 'text', options: [], required: false }])} className="text-sm font-medium text-brand hover:text-brand-800">
                        + Add question
                    </button>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="submit" disabled={form.processing} className="btn-primary disabled:opacity-40">Create questionnaire</button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
