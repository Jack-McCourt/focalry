import Modal from '@/Components/Modal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface Option {
    id: number;
    name: string;
}
interface TaskRow {
    id: number;
    title: string;
    notes: string | null;
    due_date: string | null;
    completed_at: string | null;
    project: Option | null;
    project_id: number | null;
    assignee: Option | null;
    assigned_to: number | null;
}
interface TemplateItem {
    id: number;
    title: string;
    offset_days: number;
    position: number;
}
interface ChecklistItem {
    title: string;
    offset_days: number;
    [key: string]: string | number;
}
interface Template {
    id: number;
    name: string;
    items: TemplateItem[];
}
interface Filters {
    filter: string;
    project: number | null;
    assignee: string | null;
}

function fmtDue(d: string | null): { label: string; overdue: boolean } {
    if (!d) return { label: 'No date', overdue: false };
    const date = new Date(d + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        overdue: date < today,
    };
}

export default function Index({
    tasks,
    projects,
    members,
    templates,
    filters,
}: PageProps<{
    tasks: TaskRow[];
    projects: Option[];
    members: Option[];
    templates: Template[];
    filters: Filters;
}>) {
    const [applyOpen, setApplyOpen] = useState(false);
    const [checklistOpen, setChecklistOpen] = useState(false);

    const add = useForm<{ title: string; project_id: string; due_date: string; assigned_to: string }>({
        title: '',
        project_id: '',
        due_date: '',
        assigned_to: '',
    });

    const setFilter = (patch: Partial<Filters>) =>
        router.get(route('tasks.index'), { ...filters, ...patch }, { preserveState: true, preserveScroll: true, replace: true });

    const submitAdd = (e: React.FormEvent) => {
        e.preventDefault();
        add.post(route('tasks.store'), {
            preserveScroll: true,
            onSuccess: () => add.reset(),
        });
    };

    const toggle = (t: TaskRow) =>
        router.post(route('tasks.toggle', t.id), {}, { preserveScroll: true, preserveState: true });

    const remove = async (t: TaskRow) => {
        if (await confirmDialog('Delete this task?')) router.delete(route('tasks.destroy', t.id), { preserveScroll: true });
    };

    const tabs = [
        { key: 'open', label: 'Open' },
        { key: 'done', label: 'Done' },
        { key: 'all', label: 'All' },
    ];

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>}
            actions={
                <>
                    <button onClick={() => setChecklistOpen(true)} className="btn-secondary">Checklists</button>
                    <button onClick={() => setApplyOpen(true)} className="btn-secondary">Apply checklist</button>
                </>
            }
        >
            <Head title="Tasks" />
            <StudioManagerNav active="tasks" />

            <div className="px-4 py-8 sm:px-8">
                {/* Quick add */}
                <form onSubmit={submitAdd} className="mb-6 rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                            value={add.data.title}
                            onChange={(e) => add.setData('title', e.target.value)}
                            placeholder="Add a task…"
                            className="input flex-1"
                        />
                        <select value={add.data.project_id} onChange={(e) => add.setData('project_id', e.target.value)} className="input sm:w-48">
                            <option value="">No project</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={add.data.assigned_to} onChange={(e) => add.setData('assigned_to', e.target.value)} className="input sm:w-40">
                            <option value="">Unassigned</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <input type="date" value={add.data.due_date} onChange={(e) => add.setData('due_date', e.target.value)} className="input sm:w-40" />
                        <button type="submit" disabled={add.processing || !add.data.title} className="btn-primary disabled:opacity-40">Add</button>
                    </div>
                    {add.errors.title && <p className="mt-1 text-xs text-red-600">{add.errors.title}</p>}
                </form>

                {/* Filters */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="flex gap-1.5">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setFilter({ filter: t.key })}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                    filters.filter === t.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <select
                        value={filters.project ?? ''}
                        onChange={(e) => setFilter({ project: e.target.value ? Number(e.target.value) : null })}
                        className="input w-auto text-sm"
                    >
                        <option value="">All projects</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                        value={filters.assignee ?? ''}
                        onChange={(e) => setFilter({ assignee: e.target.value || null })}
                        className="input w-auto text-sm"
                    >
                        <option value="">Anyone</option>
                        <option value="me">Assigned to me</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>

                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">No tasks here</p>
                        <p className="mt-1 text-sm text-neutral-500">Add one above, or apply a checklist to a project.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-50">
                        {tasks.map((t) => {
                            const due = fmtDue(t.due_date);
                            const done = !!t.completed_at;
                            return (
                                <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
                                    <button
                                        onClick={() => toggle(t)}
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                                            done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-300 hover:border-neutral-500'
                                        }`}
                                    >
                                        {done && (
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <p className={`truncate text-sm font-medium ${done ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{t.title}</p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                                            {t.project && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{t.project.name}</span>}
                                            {t.assignee && <span>· {t.assignee.name}</span>}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 text-xs ${!done && due.overdue ? 'font-medium text-red-600' : 'text-neutral-400'}`}>{due.label}</span>
                                    <button onClick={() => remove(t)} className="shrink-0 text-neutral-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ApplyChecklistModal open={applyOpen} onClose={() => setApplyOpen(false)} templates={templates} projects={projects} />
            <ChecklistsModal open={checklistOpen} onClose={() => setChecklistOpen(false)} templates={templates} />
        </AuthenticatedLayout>
    );
}

function ApplyChecklistModal({ open, onClose, templates, projects }: { open: boolean; onClose: () => void; templates: Template[]; projects: Option[] }) {
    const form = useForm({ template_id: '', project_id: '' });
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('tasks.apply-template'), { preserveScroll: true, onSuccess: () => { form.reset(); onClose(); } });
    };
    return (
        <Modal show={open} onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-neutral-900">Apply a checklist</h2>
                <div className="space-y-4">
                    <div>
                        <label className="label mb-1.5">Checklist</label>
                        <select value={form.data.template_id} onChange={(e) => form.setData('template_id', e.target.value)} className="input">
                            <option value="">Choose a checklist…</option>
                            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label mb-1.5">Project</label>
                        <select value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} className="input">
                            <option value="">Choose a project…</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <p className="mt-1 text-xs text-neutral-400">Due dates are set relative to the project's event date.</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={form.processing || !form.data.template_id || !form.data.project_id} className="btn-primary disabled:opacity-40">Apply</button>
                </div>
            </form>
        </Modal>
    );
}

function ChecklistsModal({ open, onClose, templates }: { open: boolean; onClose: () => void; templates: Template[] }) {
    const blank = { name: '', items: [{ title: '', offset_days: 0 }] as ChecklistItem[] };
    const [editing, setEditing] = useState<{ id: number | null; name: string; items: ChecklistItem[] } | null>(null);

    const startNew = () => setEditing({ id: null, ...blank });
    const startEdit = (t: Template) => setEditing({ id: t.id, name: t.name, items: t.items.map((i) => ({ title: i.title, offset_days: i.offset_days })) });

    const save = () => {
        if (!editing) return;
        const payload = { name: editing.name, items: editing.items.filter((i) => i.title.trim()) };
        const opts = { preserveScroll: true, onSuccess: () => setEditing(null) };
        if (editing.id) router.patch(route('task-templates.update', editing.id), payload, opts);
        else router.post(route('task-templates.store'), payload, opts);
    };

    const del = async (t: Template) => {
        if (await confirmDialog(`Delete "${t.name}"?`)) router.delete(route('task-templates.destroy', t.id), { preserveScroll: true });
    };

    return (
        <Modal show={open} onClose={onClose} maxWidth="lg">
            <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-neutral-900">Task checklists</h2>
                    {!editing && <button onClick={startNew} className="btn-primary">New checklist</button>}
                </div>

                {editing ? (
                    <div className="space-y-4">
                        <div>
                            <label className="label mb-1.5">Name</label>
                            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" placeholder="e.g. Post-wedding delivery" />
                        </div>
                        <div>
                            <label className="label mb-1.5">Tasks (days relative to event date — negative = before)</label>
                            <div className="space-y-2">
                                {editing.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            value={item.title}
                                            onChange={(e) => setEditing({ ...editing, items: editing.items.map((it, j) => j === i ? { ...it, title: e.target.value } : it) })}
                                            placeholder="Task title"
                                            className="input flex-1"
                                        />
                                        <input
                                            type="number"
                                            value={item.offset_days}
                                            onChange={(e) => setEditing({ ...editing, items: editing.items.map((it, j) => j === i ? { ...it, offset_days: Number(e.target.value) } : it) })}
                                            className="input w-24"
                                            title="Days from event date"
                                        />
                                        <button onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })} className="text-neutral-300 hover:text-red-500">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setEditing({ ...editing, items: [...editing.items, { title: '', offset_days: 0 }] })} className="mt-2 text-sm font-medium text-brand hover:text-brand-800">+ Add task</button>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                            <button onClick={save} disabled={!editing.name.trim()} className="btn-primary disabled:opacity-40">Save checklist</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {templates.length === 0 && <p className="py-8 text-center text-sm text-neutral-400">No checklists yet.</p>}
                        {templates.map((t) => (
                            <div key={t.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-neutral-900">{t.name}</p>
                                    <p className="text-xs text-neutral-400">{t.items.length} task{t.items.length === 1 ? '' : 's'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => startEdit(t)} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">Edit</button>
                                    <button onClick={() => del(t)} className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}
