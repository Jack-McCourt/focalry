import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface ContactRef {
    id: number;
    name: string;
    email?: string | null;
}

interface ConversationItem {
    id: number;
    subject: string;
    unread: boolean;
    status: 'open' | 'archived';
    last_message_at: string | null;
    contact: { id: number; name: string } | null;
    preview: string | null;
}

interface MessageItem {
    id: number;
    direction: 'outbound' | 'inbound';
    body: string;
    author_name: string;
    status: string;
    error: string | null;
    created_at: string;
}

interface Selected {
    id: number;
    subject: string;
    status: 'open' | 'archived';
    contact: { id: number; name: string; email: string | null; phone: string | null } | null;
    messages: MessageItem[];
}

function fmtTime(d: string | null) {
    if (!d) return '';
    const date = new Date(d);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
        ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Index({
    conversations,
    selected,
    filters,
    counts,
    contacts,
    inbound_configured,
}: PageProps<{
    conversations: ConversationItem[];
    selected: Selected | null;
    filters: { search: string; status: string };
    counts: { open: number; archived: number; unread: number };
    contacts: ContactRef[];
    inbound_configured: boolean;
}>) {
    const [search, setSearch] = useState(filters.search);
    const [composing, setComposing] = useState(false);
    const firstRender = useRef(true);
    const threadEnd = useRef<HTMLDivElement>(null);

    // Debounced search.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(route('messages.index'), { search, status: filters.status }, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    // Scroll to the newest message when a conversation loads.
    useEffect(() => {
        threadEnd.current?.scrollIntoView();
    }, [selected?.id, selected?.messages.length]);

    const setStatus = (status: string) => router.get(route('messages.index'), { status, search: search || undefined }, { preserveState: true, preserveScroll: true, replace: true });

    const reply = useForm({ body: '' });
    const sendReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !reply.data.body.trim()) return;
        reply.post(route('messages.reply', selected.id), { preserveScroll: true, onSuccess: () => reply.reset() });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Messages</h1>
                    <button onClick={() => setComposing(true)} className="btn-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        New message
                    </button>
                </div>
            }
        >
            <Head title="Messages" />

            <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
                {/* ── Left: conversation list ── */}
                <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-white">
                    <div className="border-b border-neutral-100 p-3">
                        <div className="relative">
                            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…" className="input pl-9" />
                        </div>
                        <div className="mt-2 flex gap-1">
                            {(['open', 'archived'] as const).map((s) => (
                                <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${filters.status === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                                    {s} {s === 'open' && counts.unread > 0 && <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 text-[10px] text-white">{counts.unread}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <p className="px-4 py-10 text-center text-sm text-neutral-400">No conversations.</p>
                        ) : (
                            conversations.map((c) => (
                                <Link
                                    key={c.id}
                                    href={route('messages.show', c.id)}
                                    preserveScroll
                                    className={`block border-b border-neutral-50 px-4 py-3 transition hover:bg-neutral-50 ${selected?.id === c.id ? 'bg-blue-50/60' : ''}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`truncate text-sm ${c.unread ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>{c.contact?.name ?? 'Unknown'}</span>
                                        <span className="shrink-0 text-[11px] text-neutral-400">{fmtTime(c.last_message_at)}</span>
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-1.5">
                                        {c.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                                        <span className={`truncate text-xs ${c.unread ? 'text-neutral-700' : 'text-neutral-400'}`}>{c.subject}</span>
                                    </div>
                                    {c.preview && <p className="mt-0.5 truncate text-xs text-neutral-400">{c.preview}</p>}
                                </Link>
                            ))
                        )}
                    </div>
                </aside>

                {/* ── Right: thread ── */}
                <div className="flex min-w-0 flex-1 flex-col bg-neutral-50">
                    {!inbound_configured && (
                        <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
                            Inbound replies aren't configured yet — set <code className="font-mono">MESSAGING_INBOUND_ADDRESS</code>. Outbound messages still send.
                        </div>
                    )}

                    {!selected ? (
                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                            <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                            <p className="mt-3 text-sm font-medium text-neutral-700">Select a conversation</p>
                            <p className="mt-1 text-sm text-neutral-400">or start a new message with a client.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-neutral-900">{selected.contact?.name ?? 'Unknown'}</p>
                                    <p className="truncate text-xs text-neutral-400">{selected.subject}{selected.contact?.email ? ` · ${selected.contact.email}` : ''}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <button onClick={() => router.post(route('messages.archive', selected.id), {}, { preserveScroll: true })} className="btn-secondary px-3 py-1.5 text-xs">
                                        {selected.status === 'archived' ? 'Restore' : 'Archive'}
                                    </button>
                                    <button
                                        onClick={() => confirm('Delete this conversation? This cannot be undone.') && router.delete(route('messages.destroy', selected.id))}
                                        className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                                        title="Delete conversation"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-6">
                                {selected.messages.map((m) => {
                                    const out = m.direction === 'outbound';
                                    return (
                                        <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${out ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-800'}`}>
                                                <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                                                <p className={`mt-1 text-[10px] ${out ? 'text-white/50' : 'text-neutral-400'}`}>
                                                    {m.author_name} · {fmtTime(m.created_at)}
                                                    {m.status === 'queued' && <span> · sending…</span>}
                                                    {m.status === 'failed' && <span className="text-red-300"> · failed to send</span>}
                                                </p>
                                                {m.status === 'failed' && m.error && <p className="mt-1 text-[10px] text-red-300">{m.error}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={threadEnd} />
                            </div>

                            <form onSubmit={sendReply} className="border-t border-neutral-200 bg-white p-3">
                                <div className="flex items-end gap-2">
                                    <textarea
                                        value={reply.data.body}
                                        onChange={(e) => reply.setData('body', e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(e); }}
                                        rows={2}
                                        placeholder="Write a reply…  (⌘/Ctrl + Enter to send)"
                                        className="input flex-1 resize-none"
                                    />
                                    <button type="submit" disabled={reply.processing || !reply.data.body.trim()} className="btn-primary">
                                        {reply.processing ? 'Sending…' : 'Send'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>

            <NewMessageModal show={composing} onClose={() => setComposing(false)} contacts={contacts} />
        </AuthenticatedLayout>
    );
}

function NewMessageModal({ show, onClose, contacts }: { show: boolean; onClose: () => void; contacts: ContactRef[] }) {
    const form = useForm({ contact_id: '', subject: '', body: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('messages.store'), { onSuccess: () => { form.reset(); onClose(); } });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">New message</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div>
                    <span className="label mb-1.5 block">To</span>
                    <select className="input" value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)}>
                        <option value="">Select a client…</option>
                        {contacts.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>
                        ))}
                    </select>
                    {form.errors.contact_id && <p className="mt-1 text-xs text-red-600">{form.errors.contact_id}</p>}
                    {contacts.length === 0 && <p className="mt-1 text-xs text-neutral-400">No contacts with an email address yet.</p>}
                </div>

                <div>
                    <span className="label mb-1.5 block">Subject</span>
                    <input className="input" value={form.data.subject} onChange={(e) => form.setData('subject', e.target.value)} />
                    {form.errors.subject && <p className="mt-1 text-xs text-red-600">{form.errors.subject}</p>}
                </div>

                <div>
                    <span className="label mb-1.5 block">Message</span>
                    <textarea className="input" rows={6} value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} />
                    {form.errors.body && <p className="mt-1 text-xs text-red-600">{form.errors.body}</p>}
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={form.processing} className="btn-primary">{form.processing ? 'Sending…' : 'Send message'}</button>
                </div>
            </form>
        </Modal>
    );
}
