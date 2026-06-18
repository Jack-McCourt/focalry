import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ContactRef {
    id: number;
    name: string;
    email?: string | null;
}

interface TemplateRef {
    id: number;
    name: string;
    body: string;
}

interface ConversationItem {
    id: number;
    subject: string;
    unread: boolean;
    status: 'open' | 'archived';
    last_message_at: string | null;
    tags: string[];
    contact: { id: number; name: string } | null;
    preview: string | null;
}

interface Attachment {
    name: string;
    url: string;
    size: number;
}

interface MessageItem {
    id: number;
    direction: 'outbound' | 'inbound';
    is_internal: boolean;
    body: string;
    author_name: string;
    status: string;
    opened_at: string | null;
    error: string | null;
    created_at: string;
    attachments: Attachment[];
}

interface Selected {
    id: number;
    subject: string;
    status: 'open' | 'archived';
    tags: string[];
    contact: { id: number; name: string; email: string | null; phone: string | null } | null;
    messages: MessageItem[];
}

const NO_TEXT = '(no text content)';

function fmtSize(bytes: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal, safe Markdown → HTML for message bubbles. Input is escaped first, so
// only the tags we generate here are ever rendered as HTML.
function renderMarkdown(raw: string) {
    let s = escapeHtml(raw);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline">$1</a>');
    return s.replace(/\n/g, '<br>');
}

function IconPaperclip({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
    );
}

function AttachButton({ onAdd, className, label }: { onAdd: (files: File[]) => void; className?: string; label?: string }) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <>
            <button type="button" onClick={() => ref.current?.click()} className={className ?? 'rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700'} title="Attach files">
                <IconPaperclip className="h-4 w-4" />
                {label && <span>{label}</span>}
            </button>
            <input ref={ref} type="file" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) onAdd(f); e.target.value = ''; }} />
        </>
    );
}

function AttachChips({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
    if (files.length === 0) return null;
    return (
        <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                    <IconPaperclip className="h-3 w-3" />
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <button type="button" onClick={() => onRemove(i)} className="text-neutral-400 hover:text-red-600">✕</button>
                </span>
            ))}
        </div>
    );
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
    templates,
    all_tags,
    compose_contact_id,
    inbound_configured,
}: PageProps<{
    conversations: ConversationItem[];
    selected: Selected | null;
    filters: { search: string; status: string };
    counts: { open: number; archived: number; unread: number };
    contacts: ContactRef[];
    templates: TemplateRef[];
    all_tags: string[];
    compose_contact_id: number | null;
    inbound_configured: boolean;
}>) {
    const [search, setSearch] = useState(filters.search);
    const [composing, setComposing] = useState(!!compose_contact_id);
    const [managingTemplates, setManagingTemplates] = useState(false);
    const [mode, setMode] = useState<'reply' | 'note'>('reply');
    const [threadSearch, setThreadSearch] = useState('');
    const firstRender = useRef(true);
    const threadEnd = useRef<HTMLDivElement>(null);
    const replyRef = useRef<HTMLTextAreaElement>(null);

    // Debounced conversation-list search.
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

    // Scroll to the newest message when a conversation loads. Reset per-thread UI.
    useEffect(() => {
        threadEnd.current?.scrollIntoView();
        setThreadSearch('');
        setMode('reply');
    }, [selected?.id]);

    useEffect(() => {
        threadEnd.current?.scrollIntoView();
    }, [selected?.messages.length]);

    const setStatus = (status: string) => router.get(route('messages.index'), { status, search: search || undefined }, { preserveState: true, preserveScroll: true, replace: true });

    const reply = useForm<{ body: string; attachments: File[] }>({ body: '', attachments: [] });
    const note = useForm<{ body: string }>({ body: '' });

    const sendReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || (!reply.data.body.trim() && reply.data.attachments.length === 0)) return;
        reply.post(route('messages.reply', selected.id), { preserveScroll: true, forceFormData: true, onSuccess: () => reply.reset() });
    };

    const sendNote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !note.data.body.trim()) return;
        note.post(route('messages.note', selected.id), { preserveScroll: true, onSuccess: () => note.reset() });
    };

    // Wrap the current textarea selection with Markdown markers.
    const applyFormat = (marker: string, placeholder: string) => {
        const ta = replyRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = reply.data.body;
        const sel = val.slice(start, end) || placeholder;
        reply.setData('body', val.slice(0, start) + marker + sel + marker + val.slice(end));
        requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = start + marker.length;
            ta.selectionEnd = start + marker.length + sel.length;
        });
    };

    const applyLink = () => {
        const ta = replyRef.current;
        if (!ta) return;
        const url = window.prompt('Link URL', 'https://');
        if (!url) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = reply.data.body;
        const sel = val.slice(start, end) || 'link text';
        reply.setData('body', `${val.slice(0, start)}[${sel}](${url})${val.slice(end)}`);
    };

    const insertTemplate = (id: string) => {
        const t = templates.find((x) => String(x.id) === id);
        if (!t) return;
        const body = reply.data.body;
        reply.setData('body', body ? `${body}\n\n${t.body}` : t.body);
        requestAnimationFrame(() => replyRef.current?.focus());
    };

    const setTags = (tags: string[]) => {
        if (!selected) return;
        router.patch(route('messages.tags', selected.id), { tags }, { preserveScroll: true, preserveState: true });
    };

    const visibleMessages = useMemo(() => {
        if (!selected) return [];
        const q = threadSearch.trim().toLowerCase();
        if (!q) return selected.messages;
        return selected.messages.filter((m) => m.body.toLowerCase().includes(q));
    }, [selected, threadSearch]);

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
                                    {c.tags.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {c.tags.map((t) => (
                                                <span key={t} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">{t}</span>
                                            ))}
                                        </div>
                                    )}
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
                            <div className="border-b border-neutral-200 bg-white px-5 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-neutral-900">{selected.contact?.name ?? 'Unknown'}</p>
                                        <p className="truncate text-xs text-neutral-400">{selected.subject}{selected.contact?.email ? ` · ${selected.contact.email}` : ''}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <input
                                            type="search"
                                            value={threadSearch}
                                            onChange={(e) => setThreadSearch(e.target.value)}
                                            placeholder="Find in thread…"
                                            className="input h-8 w-40 text-xs"
                                        />
                                        <button onClick={() => router.post(route('messages.unread', selected.id))} className="btn-secondary px-3 py-1.5 text-xs" title="Mark unread and return to inbox">
                                            Mark unread
                                        </button>
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
                                <TagEditor tags={selected.tags} allTags={all_tags} onChange={setTags} />
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-6">
                                {visibleMessages.length === 0 && threadSearch.trim() !== '' && (
                                    <p className="py-6 text-center text-sm text-neutral-400">No messages match “{threadSearch}”.</p>
                                )}
                                {visibleMessages.map((m) => {
                                    if (m.is_internal) {
                                        return (
                                            <div key={m.id} className="flex justify-center">
                                                <div className="max-w-[80%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                                    <p className="mb-0.5 flex items-center gap-1 font-medium">
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                                        Internal note · {m.author_name}
                                                    </p>
                                                    <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                                                    <p className="mt-1 text-[10px] text-amber-700/70">{fmtTime(m.created_at)}</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    const out = m.direction === 'outbound';
                                    const hasBody = m.body && m.body !== NO_TEXT;
                                    return (
                                        <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${out ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-800'}`}>
                                                {hasBody && <p className="whitespace-pre-line leading-relaxed [&_a]:underline" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }} />}
                                                {m.attachments.length > 0 && (
                                                    <div className={`space-y-1 ${hasBody ? 'mt-2' : ''}`}>
                                                        {m.attachments.map((a, i) => (
                                                            <a key={i} href={a.url} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 text-xs hover:underline ${out ? 'text-white/90' : 'text-blue-700'}`}>
                                                                <IconPaperclip className="h-3.5 w-3.5 shrink-0" />
                                                                <span className="truncate">{a.name}</span>
                                                                {a.size > 0 && <span className="shrink-0 opacity-60">({fmtSize(a.size)})</span>}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                <p className={`mt-1 text-[10px] ${out ? 'text-white/50' : 'text-neutral-400'}`}>
                                                    {m.author_name} · {fmtTime(m.created_at)}
                                                    {m.status === 'queued' && <span> · sending…</span>}
                                                    {m.status === 'failed' && <span className="text-red-300"> · failed to send</span>}
                                                    {out && m.status === 'sent' && (m.opened_at ? <span> · Seen {fmtTime(m.opened_at)}</span> : <span> · Sent</span>)}
                                                </p>
                                                {m.status === 'failed' && m.error && <p className="mt-1 text-[10px] text-red-300">{m.error}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={threadEnd} />
                            </div>

                            {/* ── Composer ── */}
                            <div className="border-t border-neutral-200 bg-white">
                                <div className="flex items-center gap-1 px-3 pt-2">
                                    {(['reply', 'note'] as const).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setMode(m)}
                                            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${mode === m ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}
                                        >
                                            {m === 'note' ? 'Internal note' : 'Reply'}
                                        </button>
                                    ))}
                                </div>

                                {mode === 'reply' ? (
                                    <form onSubmit={sendReply} className="p-3 pt-2">
                                        <AttachChips files={reply.data.attachments} onRemove={(i) => reply.setData('attachments', reply.data.attachments.filter((_, idx) => idx !== i))} />
                                        <div className="mb-1.5 flex items-center gap-1">
                                            <button type="button" onClick={() => applyFormat('**', 'bold')} className="rounded px-2 py-1 text-xs font-bold text-neutral-500 hover:bg-neutral-100" title="Bold">B</button>
                                            <button type="button" onClick={() => applyFormat('*', 'italic')} className="rounded px-2 py-1 text-xs italic text-neutral-500 hover:bg-neutral-100" title="Italic">I</button>
                                            <button type="button" onClick={applyLink} className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100" title="Insert link">🔗</button>
                                            <span className="mx-1 h-4 w-px bg-neutral-200" />
                                            {templates.length > 0 && (
                                                <select onChange={(e) => { insertTemplate(e.target.value); e.target.value = ''; }} defaultValue="" className="rounded border-neutral-200 bg-white py-1 text-xs text-neutral-500">
                                                    <option value="">Insert template…</option>
                                                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            )}
                                            <button type="button" onClick={() => setManagingTemplates(true)} className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">Manage</button>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <AttachButton onAdd={(f) => reply.setData('attachments', [...reply.data.attachments, ...f])} />
                                            <textarea
                                                ref={replyRef}
                                                value={reply.data.body}
                                                onChange={(e) => reply.setData('body', e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(e); }}
                                                rows={2}
                                                placeholder="Write a reply…  (⌘/Ctrl + Enter to send · **bold**, *italic*)"
                                                className="input flex-1 resize-none"
                                            />
                                            <button type="submit" disabled={reply.processing || (!reply.data.body.trim() && reply.data.attachments.length === 0)} className="btn-primary">
                                                {reply.processing ? 'Sending…' : 'Send'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={sendNote} className="p-3 pt-2">
                                        <div className="flex items-end gap-2">
                                            <textarea
                                                value={note.data.body}
                                                onChange={(e) => note.setData('body', e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendNote(e); }}
                                                rows={2}
                                                placeholder="Add an internal note — only your team sees this, the client is not emailed."
                                                className="input flex-1 resize-none border-amber-200 bg-amber-50/40 focus:border-amber-300"
                                            />
                                            <button type="submit" disabled={note.processing || !note.data.body.trim()} className="btn-secondary">
                                                {note.processing ? 'Saving…' : 'Add note'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <NewMessageModal show={composing} onClose={() => setComposing(false)} contacts={contacts} defaultContactId={compose_contact_id} />
            <TemplatesModal show={managingTemplates} onClose={() => setManagingTemplates(false)} templates={templates} />
        </AuthenticatedLayout>
    );
}

function TagEditor({ tags, allTags, onChange }: { tags: string[]; allTags: string[]; onChange: (tags: string[]) => void }) {
    const [value, setValue] = useState('');

    const add = (raw: string) => {
        const t = raw.trim();
        if (!t || tags.includes(t)) { setValue(''); return; }
        onChange([...tags, t]);
        setValue('');
    };

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {t}
                    <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-neutral-400 hover:text-red-600">✕</button>
                </span>
            ))}
            <input
                list="conversation-tags"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(value); } }}
                onBlur={() => add(value)}
                placeholder="+ label"
                className="w-24 border-0 bg-transparent p-0 text-xs text-neutral-500 focus:ring-0"
            />
            <datalist id="conversation-tags">
                {allTags.map((t) => <option key={t} value={t} />)}
            </datalist>
        </div>
    );
}

function NewMessageModal({ show, onClose, contacts, defaultContactId }: { show: boolean; onClose: () => void; contacts: ContactRef[]; defaultContactId: number | null }) {
    const form = useForm<{ contact_id: string; subject: string; body: string; attachments: File[] }>({ contact_id: defaultContactId ? String(defaultContactId) : '', subject: '', body: '', attachments: [] });

    // Keep the preselected contact in sync when opening from a contact profile.
    useEffect(() => {
        if (show && defaultContactId) form.setData('contact_id', String(defaultContactId));
    }, [show, defaultContactId]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('messages.store'), { forceFormData: true, onSuccess: () => { form.reset(); onClose(); } });
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
                    <textarea className="input" rows={6} value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} placeholder="Supports **bold**, *italic*, and [links](https://…)" />
                    {form.errors.body && <p className="mt-1 text-xs text-red-600">{form.errors.body}</p>}
                </div>

                <div>
                    <AttachChips files={form.data.attachments} onRemove={(i) => form.setData('attachments', form.data.attachments.filter((_, idx) => idx !== i))} />
                    <AttachButton onAdd={(f) => form.setData('attachments', [...form.data.attachments, ...f])} className="btn-secondary px-3 py-1.5 text-xs" label="Attach files" />
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={form.processing} className="btn-primary">{form.processing ? 'Sending…' : 'Send message'}</button>
                </div>
            </form>
        </Modal>
    );
}

function TemplatesModal({ show, onClose, templates }: { show: boolean; onClose: () => void; templates: TemplateRef[] }) {
    const form = useForm({ name: '', body: '' });

    const add = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('message-templates.store'), { preserveScroll: true, onSuccess: () => form.reset() });
    };

    const remove = (id: number) => {
        if (confirm('Delete this template?')) router.delete(route('message-templates.destroy', id), { preserveScroll: true });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Canned replies</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto">
                    {templates.length === 0 ? (
                        <p className="py-4 text-center text-sm text-neutral-400">No templates yet. Save your common replies below.</p>
                    ) : (
                        templates.map((t) => (
                            <div key={t.id} className="rounded-lg border border-neutral-200 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-neutral-900">{t.name}</p>
                                    <button onClick={() => remove(t.id)} className="shrink-0 text-xs text-red-600 hover:text-red-800">Delete</button>
                                </div>
                                <p className="mt-1 whitespace-pre-line text-xs text-neutral-500">{t.body}</p>
                            </div>
                        ))
                    )}
                </div>

                <form onSubmit={add} className="space-y-3 border-t border-neutral-100 pt-4">
                    <div>
                        <span className="label mb-1.5 block">Template name</span>
                        <input className="input" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="e.g. Booking confirmation" />
                        {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
                    </div>
                    <div>
                        <span className="label mb-1.5 block">Body</span>
                        <textarea className="input" rows={4} value={form.data.body} onChange={(e) => form.setData('body', e.target.value)} />
                        {form.errors.body && <p className="mt-1 text-xs text-red-600">{form.errors.body}</p>}
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={form.processing} className="btn-primary">{form.processing ? 'Saving…' : 'Save template'}</button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
