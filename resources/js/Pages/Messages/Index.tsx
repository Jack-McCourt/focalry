import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

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
    project_id: number | null;
    body: string;
    author_name: string;
    status: string;
    opened_at: string | null;
    error: string | null;
    created_at: string;
    attachments: Attachment[];
}

interface ProjectRef {
    id: number;
    name: string;
}

interface Selected {
    id: number;
    subject: string;
    status: 'open' | 'archived';
    tags: string[];
    contact: { id: number; name: string; email: string | null; phone: string | null } | null;
    projects: ProjectRef[];
    messages: MessageItem[];
}

const NO_TEXT = '(no text content)';

function fmtSize(bytes: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Server caps attachments at 15 MB; reject oversize files up front so the send
// doesn't silently fail (PHP/Laravel would drop them with no visible error).
const MAX_ATTACH_MB = 15;
function withinAttachLimit(files: File[]): File[] {
    const ok = files.filter((f) => f.size <= MAX_ATTACH_MB * 1024 * 1024);
    if (ok.length < files.length) alert(`Some files are larger than ${MAX_ATTACH_MB} MB and were skipped.`);
    return ok;
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
    // Images (![alt](url)) before links, since the syntax overlaps.
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" class="my-1.5 max-h-80 max-w-full rounded-lg border border-neutral-200" />');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline">$1</a>');
    return s.replace(/\n/g, '<br>');
}

// ── Gmail-like rich composer ────────────────────────────────────────────────
// A contentEditable editor where bold/italic/links/images render live, then
// serialises back to the Markdown the backend already stores — so the send and
// email-render pipeline is unchanged.

interface LinkableItem { type: string; label: string; meta: string; url: string }

interface RichComposerHandle {
    clear: () => void;
    focus: () => void;
    exec: (cmd: string, value?: string) => void;
    insertHtml: (html: string) => void;
    insertImages: (files: File[]) => void;
    hasContent: () => boolean;
}

// Serialise the editor DOM to the constrained Markdown subset we support.
function domToMarkdown(root: HTMLElement): string {
    const walk = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as HTMLElement;
        const inner = Array.from(el.childNodes).map(walk).join('');
        switch (el.tagName.toLowerCase()) {
            case 'br': return '\n';
            case 'b': case 'strong': return inner.trim() ? `**${inner}**` : inner;
            case 'i': case 'em': return inner.trim() ? `*${inner}*` : inner;
            case 'a': { const href = el.getAttribute('href') ?? ''; return href ? `[${inner || href}](${href})` : inner; }
            case 'img': { const src = el.getAttribute('src') ?? ''; return src ? `![${el.getAttribute('alt') ?? ''}](${src})` : ''; }
            case 'div': case 'p': return inner + '\n';
            default: return inner;
        }
    };
    return walk(root).replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/^\n+|\n+$/g, '');
}

function xsrfToken(): string {
    return decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
}

const RichComposer = forwardRef<RichComposerHandle, {
    value: string;
    onChange: (md: string) => void;
    onSend?: () => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}>(function RichComposer({ value, onChange, onSend, placeholder, className, autoFocus }, ref) {
    const edRef = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);
    const [empty, setEmpty] = useState(true);

    // Remember the caret/selection so inserts (image, document link) land where
    // the user was typing — even after a picker modal briefly steals focus.
    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && edRef.current?.contains(sel.anchorNode)) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    };
    const focusWithCaret = () => {
        const el = edRef.current;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        if (savedRange.current && sel) {
            sel.removeAllRanges();
            sel.addRange(savedRange.current);
        }
    };

    const sync = () => {
        const el = edRef.current;
        if (!el) return;
        saveSelection();
        const md = domToMarkdown(el);
        setEmpty(md.trim() === '' && !el.querySelector('img'));
        onChange(md);
    };

    // Hydrate once from the markdown value — also runs on remount (expand toggle).
    useEffect(() => {
        const el = edRef.current;
        if (!el) return;
        el.innerHTML = value ? renderMarkdown(value) : '';
        setEmpty(!value);
        if (autoFocus) requestAnimationFrame(() => el.focus());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const exec = (cmd: string, val?: string) => { focusWithCaret(); document.execCommand(cmd, false, val); sync(); };

    // Insert at the saved caret via the Range API (works even while a picker modal
    // still holds focus — no execCommand/focus required, so nothing jumps to top).
    const insertHtml = (html: string) => {
        const el = edRef.current;
        if (!el) return;
        const range = savedRange.current && el.contains(savedRange.current.commonAncestorContainer) ? savedRange.current : null;
        if (range) {
            range.deleteContents();
            const frag = range.createContextualFragment(html);
            const last = frag.lastChild;
            range.insertNode(frag);
            if (last) { range.setStartAfter(last); range.collapse(true); savedRange.current = range.cloneRange(); }
        } else {
            el.focus();
            document.execCommand('insertHTML', false, html);
        }
        sync();
    };

    const uploadImage = async (file: File): Promise<string> => {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(route('messages.inline-image'), {
            method: 'POST', body: fd, credentials: 'same-origin',
            headers: { 'X-XSRF-TOKEN': xsrfToken(), Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('upload failed');
        return (await res.json()).url as string;
    };

    const insertImages = (files: File[]) => {
        files.filter((f) => f.type.startsWith('image/')).forEach(async (file) => {
            try {
                const url = await uploadImage(file);
                insertHtml(`<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;" />`);
            } catch { alert('Could not upload that image.'); }
        });
    };

    useImperativeHandle(ref, () => ({
        clear() { if (edRef.current) { edRef.current.innerHTML = ''; sync(); } },
        focus() { edRef.current?.focus(); },
        exec, insertHtml, insertImages,
        hasContent() { const el = edRef.current; return !!el && (domToMarkdown(el).trim() !== '' || !!el.querySelector('img')); },
    }));

    return (
        <div className="relative flex-1">
            {empty && placeholder && (
                <p className="pointer-events-none absolute left-0 top-0 select-none text-sm text-neutral-400">{placeholder}</p>
            )}
            <div
                ref={edRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                onInput={sync}
                onKeyUp={saveSelection}
                onMouseUp={saveSelection}
                onBlur={saveSelection}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend?.(); } }}
                onPaste={(e) => {
                    const img = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
                    if (img) { e.preventDefault(); const f = img.getAsFile(); if (f) insertImages([f]); return; }
                    e.preventDefault();
                    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                    sync();
                }}
                onDrop={(e) => {
                    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
                    if (files.length) { e.preventDefault(); insertImages(files); }
                }}
                className={`max-w-none break-words text-sm leading-relaxed outline-none [&_a]:text-blue-600 [&_a]:underline [&_img]:my-1.5 [&_img]:max-h-80 [&_img]:max-w-full [&_img]:rounded-lg ${className ?? ''}`}
            />
        </div>
    );
});

// Toolbar shared by the reply composer and the new-message modal.
function ComposerToolbar({ composer, onLinkDocument, onExpand, expanded, children }: {
    composer: React.RefObject<RichComposerHandle>;
    onLinkDocument?: () => void;
    onExpand?: () => void;
    expanded?: boolean;
    children?: React.ReactNode;
}) {
    const imgInput = useRef<HTMLInputElement>(null);
    const btn = 'rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100';
    const insertLink = () => {
        const url = window.prompt('Link URL', 'https://');
        if (!url) return;
        if (window.getSelection()?.toString()) composer.current?.exec('createLink', url);
        else composer.current?.insertHtml(`<a href="${url}">${url}</a>`);
    };
    return (
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => composer.current?.exec('bold')} className={`${btn} font-bold`} title="Bold (⌘/Ctrl+B)">B</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => composer.current?.exec('italic')} className={`${btn} italic`} title="Italic (⌘/Ctrl+I)">I</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} className={btn} title="Insert link">🔗</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => imgInput.current?.click()} className={btn} title="Insert image">🖼️</button>
            <input ref={imgInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) composer.current?.insertImages(f); e.target.value = ''; }} />
            {onLinkDocument && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onLinkDocument} className={btn} title="Link a document or invoice">📎 Link document</button>}
            <span className="mx-1 h-4 w-px bg-neutral-200" />
            {children}
            {onExpand && (
                <button type="button" onClick={onExpand} className={`${btn} ml-auto`} title={expanded ? 'Shrink' : 'Expand'}>
                    {expanded ? '🗗 Shrink' : '🗖 Expand'}
                </button>
            )}
        </div>
    );
}

// Modal that lists the contact's invoices/contracts/galleries to link.
function LinkDocumentModal({ show, onClose, conversationId, onPick }: {
    show: boolean; onClose: () => void; conversationId: number | null; onPick: (item: LinkableItem) => void;
}) {
    const [items, setItems] = useState<LinkableItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show || !conversationId) return;
        setLoading(true);
        fetch(route('messages.linkables', conversationId), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setItems(d.items ?? []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [show, conversationId]);

    const icon = (t: string) => ({ invoice: '💳', contract: '📝', gallery: '🖼️', questionnaire: '❓', proposal: '📄' }[t] ?? '🔗');

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Link a document</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>
                {loading ? (
                    <p className="py-8 text-center text-sm text-neutral-400">Loading…</p>
                ) : items.length === 0 ? (
                    <p className="py-8 text-center text-sm text-neutral-400">Nothing to link for this client yet.</p>
                ) : (
                    <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
                        {items.map((it, i) => (
                            <li key={i}>
                                <button type="button" onClick={() => { onPick(it); onClose(); }} className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-neutral-50">
                                    <span className="text-lg">{icon(it.type)}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-neutral-800">{it.label}</span>
                                        <span className="block text-xs capitalize text-neutral-400">{it.type} · {it.meta}</span>
                                    </span>
                                    <span className="text-xs text-blue-600">Insert</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    );
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

function IconTag({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
    );
}

/** Tag/untag a single message to one of the contact's projects. */
function ProjectTag({ message, projects }: { message: MessageItem; projects: ProjectRef[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    if (projects.length === 0) return null;

    const current = projects.find((p) => p.id === message.project_id) ?? null;

    const tag = (projectId: number | null) => {
        setOpen(false);
        router.post(route('messages.tag-project', message.id), { project_id: projectId }, { preserveScroll: true });
    };

    return (
        <div className="relative mt-1" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                    current
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        : 'text-neutral-400 opacity-0 hover:text-neutral-600 group-hover:opacity-100'
                }`}
            >
                <IconTag className="h-3 w-3" />
                {current ? current.name : 'Tag to project'}
            </button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-neutral-100 bg-white py-1 text-xs shadow-lg">
                    <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Tag to project</p>
                    {projects.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => tag(p.id)}
                            className={`block w-full truncate px-3 py-1.5 text-left hover:bg-neutral-50 ${p.id === message.project_id ? 'font-medium text-indigo-700' : 'text-neutral-700'}`}
                        >
                            {p.name}
                        </button>
                    ))}
                    {current && (
                        <>
                            <div className="my-1 border-t border-neutral-100" />
                            <button onClick={() => tag(null)} className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50">
                                Remove tag
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
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
    // The "New message" button opens a lightweight contact picker; the actual
    // compose happens inline in the thread pane (see draftContact below).
    const [composing, setComposing] = useState(false);
    // When arriving with ?compose={id} and no conversation is selected, we're
    // starting a fresh thread with that contact — render a draft pane for them.
    const draftContact = !selected && compose_contact_id ? contacts.find((c) => c.id === compose_contact_id) ?? null : null;
    const [managingTemplates, setManagingTemplates] = useState(false);
    const [threadSearch, setThreadSearch] = useState('');
    const firstRender = useRef(true);
    const threadEnd = useRef<HTMLDivElement>(null);
    const composerRef = useRef<RichComposerHandle>(null);
    const [expanded, setExpanded] = useState(false);
    const [linking, setLinking] = useState(false);
    const [highlightId, setHighlightId] = useState<number | null>(null);

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

    // Scroll to the newest message when a conversation loads — or, when arriving
    // via a #message-{id} deep link (e.g. from a project drawer), scroll to and
    // briefly highlight that specific message instead. Reset per-thread UI.
    useEffect(() => {
        setThreadSearch('');
        const hash = window.location.hash.match(/^#message-(\d+)$/);
        const targetId = hash ? Number(hash[1]) : null;
        if (targetId && selected?.messages.some((m) => m.id === targetId)) {
            // Defer until the thread has rendered.
            requestAnimationFrame(() => {
                document.getElementById(`message-${targetId}`)?.scrollIntoView({ block: 'center' });
            });
            setHighlightId(targetId);
            const t = setTimeout(() => setHighlightId(null), 2500);
            return () => clearTimeout(t);
        }
        threadEnd.current?.scrollIntoView();
    }, [selected?.id]);

    useEffect(() => {
        threadEnd.current?.scrollIntoView();
    }, [selected?.messages.length]);

    // The email is sent by a queued job that flips the message to sent/failed.
    // Poll the open thread while anything is still 'queued' so "sending…" updates
    // on its own without a manual reload; stop once nothing is pending.
    useEffect(() => {
        if (!selected?.messages.some((m) => m.status === 'queued')) return;
        const id = setInterval(() => {
            router.reload({ only: ['selected'] });
        }, 3000);
        return () => clearInterval(id);
    }, [selected]);

    const setStatus = (status: string) => router.get(route('messages.index'), { status, search: search || undefined }, { preserveState: true, preserveScroll: true, replace: true });

    const reply = useForm<{ body: string; attachments: File[] }>({ body: '', attachments: [] });

    const sendReply = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!reply.data.body.trim() && reply.data.attachments.length === 0) return;

        if (selected) {
            reply.transform((d) => d);
            reply.post(route('messages.reply', selected.id), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => { reply.reset(); composerRef.current?.clear(); setExpanded(false); },
            });
            return;
        }

        // Draft mode: first message to a contact creates the conversation.
        if (draftContact) {
            reply.transform((d) => ({ ...d, contact_id: draftContact.id }));
            reply.post(route('messages.store'), {
                forceFormData: true,
                onSuccess: () => { reply.reset(); reply.transform((d) => d); composerRef.current?.clear(); setExpanded(false); },
            });
        }
    };

    const insertTemplate = (id: string) => {
        const t = templates.find((x) => String(x.id) === id);
        if (!t) return;
        composerRef.current?.insertHtml(renderMarkdown(t.body));
    };

    const linkDocument = (item: LinkableItem) => {
        composerRef.current?.insertHtml(`<a href="${item.url}">${item.label}</a>&nbsp;`);
    };

    // Shared reply composer, rendered inline or inside the expanded modal. Only
    // one instance is mounted at a time so `composerRef` is unambiguous.
    const renderComposer = (isExpanded: boolean) => (
        <form onSubmit={sendReply} className={isExpanded ? 'flex h-full flex-col p-4' : 'p-3 pt-2'}>
            <AttachChips files={reply.data.attachments} onRemove={(i) => reply.setData('attachments', reply.data.attachments.filter((_, idx) => idx !== i))} />
            <ComposerToolbar composer={composerRef} onLinkDocument={() => setLinking(true)} onExpand={() => setExpanded((v) => !v)} expanded={isExpanded}>
                {templates.length > 0 && (
                    <select onChange={(e) => { insertTemplate(e.target.value); e.target.value = ''; }} defaultValue="" className="rounded border-neutral-200 bg-white py-1 text-xs text-neutral-500">
                        <option value="">Insert template…</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                )}
                <button type="button" onClick={() => setManagingTemplates(true)} className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">Manage templates</button>
            </ComposerToolbar>
            <div className={`flex gap-2 ${isExpanded ? 'min-h-0 flex-1 items-stretch' : 'items-end'}`}>
                <AttachButton onAdd={(f) => reply.setData('attachments', [...reply.data.attachments, ...withinAttachLimit(f)])} />
                <div className={`flex-1 rounded-md border border-neutral-200 px-3 py-2 ${isExpanded ? 'overflow-y-auto' : 'max-h-44 overflow-y-auto'}`}>
                    <RichComposer
                        ref={composerRef}
                        value={reply.data.body}
                        onChange={(md) => reply.setData('body', md)}
                        onSend={() => sendReply()}
                        placeholder={selected ? 'Write a reply…  (⌘/Ctrl + Enter to send)' : 'Write your message…  (⌘/Ctrl + Enter to send)'}
                        autoFocus={isExpanded}
                        className={isExpanded ? 'min-h-[40vh]' : 'min-h-[2.25rem]'}
                    />
                </div>
                <button type="submit" disabled={reply.processing || (!reply.data.body.trim() && reply.data.attachments.length === 0)} className="btn-primary self-end">
                    {reply.processing ? 'Sending…' : 'Send'}
                </button>
            </div>
            {reply.errors.attachments && <p className="mt-1 text-xs text-red-600">{reply.errors.attachments}</p>}
            {reply.errors.body && <p className="mt-1 text-xs text-red-600">{reply.errors.body}</p>}
        </form>
    );

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

                    {!selected && !draftContact ? (
                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                            <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                            <p className="mt-3 text-sm font-medium text-neutral-700">Select a conversation</p>
                            <p className="mt-1 text-sm text-neutral-400">or start a new message with a client.</p>
                        </div>
                    ) : !selected && draftContact ? (
                        <>
                            <div className="border-b border-neutral-200 bg-white px-5 py-3">
                                <p className="truncate text-sm font-semibold text-neutral-900">{draftContact.name}</p>
                                <p className="truncate text-xs text-neutral-400">New message{draftContact.email ? ` · ${draftContact.email}` : ''}</p>
                            </div>
                            <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-neutral-400">
                                <p>No messages yet — write the first one below.</p>
                            </div>
                            <div className="border-t border-neutral-200 bg-white">
                                {renderComposer(false)}
                            </div>
                        </>
                    ) : selected ? (
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
                                    const out = m.direction === 'outbound';
                                    const hasBody = m.body && m.body !== NO_TEXT;
                                    return (
                                        <div key={m.id} id={`message-${m.id}`} className={`group flex flex-col ${out ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm transition ${out ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-800'} ${highlightId === m.id ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
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
                                            {!m.is_internal && <ProjectTag message={m} projects={selected.projects} />}
                                        </div>
                                    );
                                })}
                                <div ref={threadEnd} />
                            </div>

                            {/* ── Composer ── */}
                            {!expanded && (
                                <div className="border-t border-neutral-200 bg-white">
                                    {renderComposer(false)}
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>

            {/* Expanded composer (Gmail-style full window). A plain overlay — not a
                Headless Dialog — so opening the document picker on top of it doesn't
                register as an outside-click and close it. */}
            {expanded && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-500/75 px-4 py-6 sm:px-0">
                    <div className="flex h-[80vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:mx-auto sm:max-w-2xl">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                            <h2 className="truncate text-sm font-semibold text-neutral-900">{selected?.subject ?? 'Message'}</h2>
                            <button type="button" onClick={() => setExpanded(false)} className="text-neutral-400 hover:text-neutral-700" title="Shrink">🗗</button>
                        </div>
                        <div className="min-h-0 flex-1">
                            {renderComposer(true)}
                        </div>
                    </div>
                </div>
            )}

            <LinkDocumentModal show={linking} onClose={() => setLinking(false)} conversationId={selected?.id ?? null} onPick={linkDocument} />
            <PickContactModal show={composing} onClose={() => setComposing(false)} contacts={contacts} />
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

/**
 * "New message" just asks who to write to. Picking a client opens their thread
 * (existing history, or a fresh draft pane) via the with-contact route — no
 * subject/body popup.
 */
function PickContactModal({ show, onClose, contacts }: { show: boolean; onClose: () => void; contacts: ContactRef[] }) {
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const filtered = needle
        ? contacts.filter((c) => c.name.toLowerCase().includes(needle) || (c.email ?? '').toLowerCase().includes(needle))
        : contacts;

    // Reset the search each time the picker opens.
    useEffect(() => { if (show) setQ(''); }, [show]);

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">New message</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">Who would you like to message?</p>

                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="input mt-3" />

                <div className="mt-2 max-h-72 divide-y divide-neutral-50 overflow-y-auto">
                    {contacts.length === 0 ? (
                        <p className="py-6 text-center text-sm text-neutral-400">No contacts with an email address yet.</p>
                    ) : filtered.length === 0 ? (
                        <p className="py-6 text-center text-sm text-neutral-400">No clients match “{q}”.</p>
                    ) : (
                        filtered.map((c) => (
                            <Link
                                key={c.id}
                                href={route('messages.with-contact', c.id)}
                                onClick={onClose}
                                className="flex items-center justify-between gap-3 px-1 py-2.5 text-left transition hover:bg-neutral-50"
                            >
                                <span className="truncate text-sm font-medium text-neutral-800">{c.name}</span>
                                {c.email && <span className="shrink-0 truncate text-xs text-neutral-400">{c.email}</span>}
                            </Link>
                        ))
                    )}
                </div>
            </div>
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
