import CustomFieldEditor, { CustomValue } from '@/Components/CustomFieldEditor';
import Modal from '@/Components/Modal';
import PillSelect from '@/Components/PillSelect';
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
    sent: 'bg-blue-50 text-blue-700',
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
    sent: 'bg-blue-50 text-blue-700',
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
}: {
    project: Project | null;
    statuses: ProjectStatus[];
    types: ProjectType[];
    fields: ProjectFieldDefinition[];
    contacts: { id: number; name: string }[];
    onClose: () => void;
    onPatch: (field: keyof Project, value: string | number | null) => void;
    onPatchCustom: (key: string, value: CustomValue) => void;
}) {
    const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
    const [contracts, setContracts] = useState<ContractLite[]>([]);
    const [galleries, setGalleries] = useState<GalleryLite[]>([]);
    const [messages, setMessages] = useState<MessageLite[]>([]);
    const [openMessage, setOpenMessage] = useState<MessageLite | null>(null);
    const [loading, setLoading] = useState(false);
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
        setLoading(true);
        axios
            .get(route('projects.show', project.id))
            .then((r) => { setInvoices(r.data.invoices ?? []); setContracts(r.data.contracts ?? []); setNotes(r.data.notes ?? []); setGalleries(r.data.galleries ?? []); setMessages(r.data.messages ?? []); })
            .finally(() => setLoading(false));
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
                        <button onClick={onClose} className="shrink-0 text-neutral-400 hover:text-neutral-700">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Fields — stacked (label above control) on mobile, 2-col on sm+.
                        Each pair uses `sm:contents` so the wrapper dissolves into
                        the parent grid on desktop, preserving the original layout. */}
                    <div className="mt-4 grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-[7rem,1fr] sm:items-center sm:gap-x-4">
                        <div className="grid grid-cols-1 gap-1 sm:contents">
                            <span className="text-neutral-400">Client</span>
                            <SearchSelect options={contacts} value={project.contact_id} onChange={(id) => id && onPatch('contact_id', id)} placeholder="Search clients…" emptyText="No clients found" />
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

                    {/* Tagged messages */}
                    <Section title="Messages">
                        {loading ? (
                            <p className="text-sm text-neutral-400">Loading…</p>
                        ) : messages.length === 0 ? (
                            <p className="text-sm text-neutral-400">No messages tagged to this project yet. Tag one from the Messages page.</p>
                        ) : (
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
                        )}
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

                    {/* Invoices */}
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
                        {loading ? (
                            <p className="text-sm text-neutral-400">Loading…</p>
                        ) : invoices.length === 0 ? (
                            <p className="text-sm text-neutral-400">No invoices yet.</p>
                        ) : (
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
                        )}
                    </Section>

                    {/* Contracts */}
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
                        {loading ? (
                            <p className="text-sm text-neutral-400">Loading…</p>
                        ) : contracts.length === 0 ? (
                            <p className="text-sm text-neutral-400">No contracts yet.</p>
                        ) : (
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
                        )}
                    </Section>
                    {/* Galleries */}
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
                        {loading ? (
                            <p className="text-sm text-neutral-400">Loading…</p>
                        ) : galleries.length === 0 ? (
                            <p className="text-sm text-neutral-400">No galleries yet. Attach one from its settings.</p>
                        ) : (
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
                        )}
                    </Section>
                    <Section title="Meetings">
                        <p className="text-sm text-neutral-400">Meetings will appear here.</p>
                    </Section>
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
        </Modal>
    );
}
