import CustomFieldEditor, { CustomValue } from '@/Components/CustomFieldEditor';
import Modal from '@/Components/Modal';
import PillSelect from '@/Components/PillSelect';
import ShareProjectModal, { ProjectShareItem } from '@/Components/ShareProjectModal';
import SearchSelect from '@/Components/SearchSelect';
import { formatMoney } from '@/lib/money';
import { Project, ProjectFieldDefinition, ProjectStatus, ProjectType } from '@/types';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';

interface InvoiceLite {
    id: number;
    public_id: string;
    number: string;
    status: 'draft' | 'sent' | 'partial' | 'paid' | 'void';
    currency: string;
    total_cents: number;
    amount_paid_cents: number;
    balance_cents: number;
}

const INV_STATUS: Record<InvoiceLite['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-brand-50 text-brand-700',
    partial: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
    void: 'bg-neutral-100 text-neutral-400 line-through',
};

interface ContractLite {
    id: number;
    title: string;
    status: 'draft' | 'sent' | 'signed' | 'declined' | 'void';
}

const CON_STATUS: Record<ContractLite['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-brand-50 text-brand-700',
    signed: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-red-50 text-red-700',
    void: 'bg-neutral-100 text-neutral-400 line-through',
};

interface NoteEntry {
    id: number;
    body: string;
    created_at: string;
}

interface GalleryLite {
    id: number;
    title: string;
    status: string;
}

interface MessageLite {
    id: number;
    conversation_id: number;
    conversation_subject: string | null;
    author_name: string;
    direction: 'inbound' | 'outbound';
    body: string;
    created_at: string;
}

interface TaskLite {
    id: number;
    title: string;
    due_date: string | null;
    completed: boolean;
    assignee: string | null;
}

interface RelatedProject {
    id: number;
    name: string;
    event_date: string | null;
    status: { label: string; color: string } | null;
}

function csrf(): string {
    const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}
const xsrf = () => ({ headers: { 'X-XSRF-TOKEN': csrf() } });

function noteTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border-t border-neutral-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
                {action}
            </div>
            {children}
        </div>
    );
}

export default function ProjectDrawer({
    project,
    statuses,
    types,
    fields,
    contacts,
    onClose,
    onPatch,
    onPatchCustom,
    onOpenProject,
}: {
    project: Project | null;
    statuses: ProjectStatus[];
    types: ProjectType[];
    fields: ProjectFieldDefinition[];
    contacts: { id: number; name: string }[];
    onClose: () => void;
    onPatch: (field: keyof Project, value: string | number | null) => void;
    onPatchCustom: (key: string, value: CustomValue) => void;
    onOpenProject: (id: number) => void;
}) {
    const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
    const [contracts, setContracts] = useState<ContractLite[]>([]);
    const [galleries, setGalleries] = useState<GalleryLite[]>([]);
    const [messages, setMessages] = useState<MessageLite[]>([]);
    const [tasks, setTasks] = useState<TaskLite[]>([]);
    const [related, setRelated] = useState<RelatedProject[]>([]);
    const [shares, setShares] = useState<ProjectShareItem[]>([]);
    const [shareOpen, setShareOpen] = useState(false);
    const [openMessage, setOpenMessage] = useState<MessageLite | null>(null);
    const [name, setName] = useState('');
    const [notes, setNotes] = useState<NoteEntry[]>([]);
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [editNoteText, setEditNoteText] = useState('');

    useEffect(() => {
        if (!project) return;
        setName(project.name);
        setNoteText('');
        // Clear so the previous project's items don't flash while this one loads.
        setInvoices([]); setContracts([]); setGalleries([]); setMessages([]); setTasks([]); setNotes([]); setRelated([]); setShares([]);
        axios
            .get(route('projects.show', project.id))
            .then((r) => { setInvoices(r.data.invoices ?? []); setContracts(r.data.contracts ?? []); setNotes(r.data.notes ?? []); setGalleries(r.data.galleries ?? []); setMessages(r.data.messages ?? []); setTasks(r.data.tasks ?? []); setRelated(r.data.related_projects ?? []); setShares(r.data.shares ?? []); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.id]);

    const addNote = () => {
        if (!project || noteText.trim() === '') return;
        setSavingNote(true);
        axios
            .post(route('projects.notes.store', project.id), { body: noteText.trim() }, xsrf())
            .then((r) => { setNotes((ns) => [r.data.note, ...ns]); setNoteText(''); })
            .finally(() => setSavingNote(false));
    };

    const deleteNote = (id: number) => {
        axios.delete(route('project-notes.destroy', id), xsrf()).then(() => setNotes((ns) => ns.filter((n) => n.id !== id)));
    };

    const startEditNote = (n: NoteEntry) => { setEditingNoteId(n.id); setEditNoteText(n.body); };

    const saveEditNote = () => {
        if (editingNoteId === null || editNoteText.trim() === '') return;
        const id = editingNoteId;
        axios.patch(route('project-notes.update', id), { body: editNoteText.trim() }, xsrf()).then((r) => {
            setNotes((ns) => ns.map((n) => (n.id === id ? r.data.note : n)));
            setEditingNoteId(null);
        });
    };

    return (
        <Modal show={!!project} onClose={onClose} maxWidth="2xl">
            {project && (
                <div className="max-h-[90vh] overflow-y-auto p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => name !== project.name && onPatch('name', name)}
                            className="w-full rounded border-0 bg-transparent px-1 text-lg font-semibold text-neutral-900 focus:ring-1 focus:ring-neutral-300"
                        />
                        <div className="flex shrink-0 items-center gap-1">
                            <a
                                href={route('projects.preview', project.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                                title="Open a printable read-only view"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                View
                            </a>
                            <button
                                onClick={() => setShareOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                                title="Share a read-only copy"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                                </svg>
                                Share
                            </button>
                            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Fields — stacked (label above control) on mobile, 2-col on sm+.
                        Each pair uses `sm:contents` so the wrapper dissolves into
                        the parent grid on desktop, preserving the original layout. */}
                    <div className="mt-4 grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-[7rem,1fr] sm:items-center sm:gap-x-4">
                        <div className="grid grid-cols-1 gap-1 sm:contents">
                            <span className="text-neutral-400">Client</span>
                            <div className="flex items-center gap-1.5">
                                <div className="min-w-0 flex-1">
                                    <SearchSelect options={contacts} value={project.contact_id} onChange={(id) => id && onPatch('contact_id', id)} placeholder="Search clients…" emptyText="No clients found" />
                                </div>
                                {project.contact_id && (
                                    <a
                                        href={route('contacts.show', project.contact_id)}
                                        className="shrink-0 rounded-md border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
                                        title="View client"
                                        aria-label="View client"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-1 sm:contents">
                            <span className="text-neutral-400">Type</span>
                            <PillSelect options={types} value={project.type_id} onChange={(id) => onPatch('type_id', id)} placeholder="Set type" />
                        </div>

                        <div className="grid grid-cols-1 gap-1 sm:contents">
                            <span className="text-neutral-400">Status</span>
                            <PillSelect options={statuses} value={project.status_id} onChange={(id) => onPatch('status_id', id)} placeholder="Set status" />
                        </div>

                        <div className="grid grid-cols-1 gap-1 sm:contents">
                            <span className="text-neutral-400">Event date</span>
                            <input
                                type="date"
                                value={project.event_date ?? ''}
                                onChange={(e) => onPatch('event_date', e.target.value || null)}
                                className="input w-44"
                            />
                        </div>
                    </div>

                    {/* Notes timeline */}
                    <Section title="Notes">
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    rows={2}
                                    placeholder="Add a note…"
                                    className="input flex-1"
                                />
                                <button type="button" onClick={addNote} disabled={savingNote || !noteText.trim()} className="btn-primary h-fit disabled:opacity-40">
                                    Add
                                </button>
                            </div>
                            {notes.length === 0 ? (
                                <p className="text-sm text-neutral-400">No notes yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {notes.map((n) => (
                                        <li key={n.id} className="group/note rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2">
                                            {editingNoteId === n.id ? (
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={editNoteText}
                                                        onChange={(e) => setEditNoteText(e.target.value)}
                                                        rows={2}
                                                        className="input"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" onClick={() => setEditingNoteId(null)} className="text-xs text-neutral-500 hover:text-neutral-800">Cancel</button>
                                                        <button type="button" onClick={saveEditNote} disabled={!editNoteText.trim()} className="btn-primary px-3 py-1 text-xs disabled:opacity-40">Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="whitespace-pre-wrap text-sm text-neutral-700">{n.body}</p>
                                                        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition group-hover/note:opacity-100">
                                                            <button type="button" onClick={() => startEditNote(n)} className="text-neutral-300 hover:text-neutral-700" title="Edit note">
                                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                                            </button>
                                                            <button type="button" onClick={() => deleteNote(n.id)} className="text-neutral-300 hover:text-red-500" title="Delete note">
                                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="mt-1 text-[11px] text-neutral-400">{noteTime(n.created_at)}</p>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </Section>

                    {/* Custom fields */}
                    {fields.length > 0 && (
                        <Section title="Details">
                            <div className="pb-4 text-sm">
                                {fields.map((f) => (
                                    <div key={f.id} className="flex flex-col gap-1 rounded px-2 py-1.5 odd:bg-neutral-50 sm:flex-row sm:items-center sm:gap-4">
                                        <span className="w-full shrink-0 text-neutral-400 sm:w-32">{f.label}</span>
                                        <div className="flex-1">
                                            <CustomFieldEditor
                                                field={f}
                                                value={(project.custom_fields[f.key] ?? null) as CustomValue}
                                                onChange={(v) => onPatchCustom(f.key, v)}
                                                multiline
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Invoices — only shown when the project has any */}
                    {invoices.length > 0 && (
                        <Section
                            title="Invoices"
                            action={
                                <button
                                    type="button"
                                    onClick={() => router.visit(`/invoices/create?project=${project.id}`)}
                                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                                >
                                    + New invoice
                                </button>
                            }
                        >
                            <div className="space-y-2">
                                {invoices.map((inv) => (
                                    <button
                                        type="button"
                                        key={inv.id}
                                        onClick={() => router.visit(route('invoices.show', inv.id))}
                                        className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-300"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-medium text-neutral-900">{inv.number}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${INV_STATUS[inv.status]}`}>{inv.status}</span>
                                        </div>
                                        <div className="text-right text-sm">
                                            <span className="font-medium text-neutral-800">{formatMoney(inv.total_cents, inv.currency)}</span>
                                            {inv.balance_cents > 0 && inv.amount_paid_cents > 0 && (
                                                <span className="ml-2 text-xs text-amber-600">{formatMoney(inv.balance_cents, inv.currency)} due</span>
                                            )}
                                            {inv.balance_cents > 0 && inv.amount_paid_cents === 0 && inv.status !== 'draft' && (
                                                <span className="ml-2 text-xs text-neutral-400">unpaid</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Contracts — only shown when the project has any */}
                    {contracts.length > 0 && (
                        <Section
                            title="Contracts"
                            action={
                                <button
                                    type="button"
                                    onClick={() => router.visit(`/contracts/create?project=${project.id}`)}
                                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                                >
                                    + New contract
                                </button>
                            }
                        >
                            <div className="space-y-2">
                                {contracts.map((c) => (
                                    <button
                                        type="button"
                                        key={c.id}
                                        onClick={() => router.visit(route('contracts.show', c.id))}
                                        className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-300"
                                    >
                                        <span className="truncate text-sm font-medium text-neutral-900">{c.title}</span>
                                        <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${CON_STATUS[c.status]}`}>{c.status}</span>
                                    </button>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Galleries — only shown when the project has any */}
                    {galleries.length > 0 && (
                        <Section
                            title="Galleries"
                            action={
                                <button
                                    type="button"
                                    onClick={() => router.visit(route('collections.create'))}
                                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                                >
                                    + New gallery
                                </button>
                            }
                        >
                            <div className="space-y-2">
                                {galleries.map((g) => (
                                    <button
                                        type="button"
                                        key={g.id}
                                        onClick={() => router.visit(route('collections.show', g.id))}
                                        className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-300"
                                    >
                                        <span className="truncate text-sm font-medium text-neutral-900">{g.title}</span>
                                        <span className={`ml-2 shrink-0 text-[11px] font-medium ${g.status === 'published' ? 'text-emerald-600' : 'text-neutral-400'}`}>
                                            {g.status === 'published' ? 'Published' : 'Draft'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Tasks — only shown when the project has any */}
                    {tasks.length > 0 && (
                        <Section
                            title="Tasks"
                            action={
                                <button
                                    type="button"
                                    onClick={() => router.visit(route('tasks.index'))}
                                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                                >
                                    View all
                                </button>
                            }
                        >
                            <ul className="space-y-1.5">
                                {tasks.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2"
                                    >
                                        <span
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                                t.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-300'
                                            }`}
                                        >
                                            {t.completed && (
                                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className={`min-w-0 flex-1 truncate text-sm ${t.completed ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>
                                            {t.title}
                                        </span>
                                        {t.assignee && <span className="shrink-0 text-[11px] text-neutral-400">{t.assignee}</span>}
                                        {t.due_date && (
                                            <span className="shrink-0 text-[11px] text-neutral-400">
                                                {new Date(t.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {/* Other projects for the same client — above Messages. */}
                    {related.length > 0 && (
                        <Section title="Other projects for this client">
                            <ul className="space-y-2">
                                {related.map((rp) => (
                                    <li key={rp.id}>
                                        <button
                                            type="button"
                                            onClick={() => onOpenProject(rp.id)}
                                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-300"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium text-neutral-800">{rp.name}</span>
                                                {rp.event_date && (
                                                    <span className="text-xs text-neutral-400">
                                                        {new Date(rp.event_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                )}
                                            </span>
                                            {rp.status && (
                                                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${rp.status.color}20`, color: rp.status.color }}>
                                                    {rp.status.label}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {/* Tagged messages — only shown when the project has any */}
                    {messages.length > 0 && (
                        <Section title="Messages">
                            <ul className="space-y-2">
                                {messages.map((m) => (
                                    <li key={m.id}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenMessage(m)}
                                            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-300"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-xs font-medium text-neutral-700">
                                                    {m.direction === 'inbound' ? m.author_name : `${m.author_name} (you)`}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-neutral-400">{noteTime(m.created_at)}</span>
                                            </div>
                                            <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-neutral-600">{m.body}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                </div>
            )}

            {/* Full tagged-message popup, with a deep link back to its place in the thread */}
            <Modal show={!!openMessage} onClose={() => setOpenMessage(null)} maxWidth="lg">
                {openMessage && (
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-neutral-900">
                                    {openMessage.direction === 'inbound' ? openMessage.author_name : `${openMessage.author_name} (you)`}
                                </p>
                                <p className="truncate text-xs text-neutral-400">
                                    {openMessage.conversation_subject ?? 'Conversation'} · {noteTime(openMessage.created_at)}
                                </p>
                            </div>
                            <button onClick={() => setOpenMessage(null)} className="shrink-0 text-neutral-400 hover:text-neutral-700">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="mt-4 max-h-[55vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                            {openMessage.body}
                        </p>
                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => router.visit(`${route('messages.show', openMessage.conversation_id)}#message-${openMessage.id}`)}
                                className="btn-primary"
                            >
                                View in conversation
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {project && (
                <ShareProjectModal
                    show={shareOpen}
                    onClose={() => setShareOpen(false)}
                    projectId={project.id}
                    shares={shares}
                    onChange={setShares}
                />
            )}
        </Modal>
    );
}
