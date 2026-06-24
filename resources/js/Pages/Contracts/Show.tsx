import Modal from '@/Components/Modal';
import SendEmailModal from '@/Components/SendEmailModal';
import SignaturePad, { SignatureValue } from '@/Components/SignaturePad';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Contract, EmailDefaults, PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

const STATUS_STYLES: Record<Contract['status'], string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-blue-50 text-blue-700',
    signed: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-red-50 text-red-700',
    void: 'bg-neutral-100 text-neutral-400 line-through',
};

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function Show({ contract, sign_url, invoice_html, email_defaults, auth }: PageProps<{ contract: Contract; sign_url: string; invoice_html: Record<string, string>; email_defaults: EmailDefaults }>) {
    const studioName = auth.studio?.name ?? '';
    const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    const [signOpen, setSignOpen] = useState(false);
    const [emailOpen, setEmailOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const studioSig = contract.signatures?.find((s) => s.role === 'studio') ?? null;
    const clientSig = contract.signatures?.find((s) => s.role === 'client') ?? null;

    const fieldByKey = new Map((contract.fields ?? []).map((f) => [f.key, f]));

    const resolveToken = (key: string): { text: string; filled: boolean } => {
        switch (key) {
            case 'client_name':
                return { text: contract.contact?.name ?? '', filled: !!contract.contact?.name };
            case 'project_name':
                return { text: contract.project?.name ?? '', filled: !!contract.project?.name };
            case 'studio_name':
                return { text: studioName, filled: !!studioName };
            case 'today':
                return { text: today, filled: true };
        }
        const f = fieldByKey.get(key);
        if (f) {
            const v = f.value;
            const filled = v !== null && v !== undefined && v !== '' && v !== false;
            const text = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v ?? '');
            return { text: String(text), filled };
        }
        return { text: '', filled: false };
    };

    const renderedBody = (contract.body ?? '').replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key: string) => {
        const field = fieldByKey.get(key);
        if (field?.type === 'invoice') {
            return invoice_html[key] ?? '<p><em style="color:#9ca3af">Payment schedule to be confirmed.</em></p>';
        }
        const { text, filled } = resolveToken(key);
        const label = field?.label ?? key.replace(/_/g, ' ');
        if (filled) return `<span class="rounded bg-emerald-50 px-1 text-emerald-800">${text}</span>`;
        return `<span class="rounded bg-amber-50 px-1 text-amber-700">[${label}]</span>`;
    });

    const destroy = () => {
        if (confirm('Delete this contract? This cannot be undone.')) {
            router.delete(route('contracts.destroy', contract.id));
        }
    };

    const send = () => router.post(route('contracts.send', contract.id), {}, { preserveScroll: true });
    const voidContract = () => {
        if (confirm('Void this contract? It can no longer be signed.')) {
            router.post(route('contracts.void', contract.id), {}, { preserveScroll: true });
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(sign_url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const signForm = useForm<SignatureValue>({
        signer_name: studioSig?.signer_name ?? studioName,
        signature_type: (studioSig?.signature_type as 'typed' | 'drawn') ?? 'typed',
        signature_data: studioSig?.signature_data ?? studioSig?.signer_name ?? studioName,
    });

    const submitSign = (e: React.FormEvent) => {
        e.preventDefault();
        signForm.post(route('contracts.sign', contract.id), {
            preserveScroll: true,
            onSuccess: () => setSignOpen(false),
        });
    };

    const clientFields = (contract.fields ?? []).filter((f) => f.fill_by === 'client');
    const studioFields = (contract.fields ?? []).filter((f) => f.fill_by === 'studio' && f.type !== 'invoice');
    const isOpen = contract.status === 'draft' || contract.status === 'sent';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Link href={route('contracts.index')} className="text-neutral-400 hover:text-neutral-700">Contracts</Link>
                        <span className="text-neutral-300">/</span>
                        <span className="truncate font-semibold text-neutral-900">{contract.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => setEmailOpen(true)} className="btn-secondary">Email client</button>
                        <a href={route('contracts.pdf', contract.id)} className="btn-secondary">PDF</a>
                        {isOpen && <Link href={route('contracts.edit', contract.id)} className="btn-secondary">Edit</Link>}
                        {contract.status === 'draft' && (
                            <button onClick={destroy} className="btn-secondary text-red-600 hover:bg-red-50">Delete</button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title={contract.title} />
            <StudioManagerNav active="contracts" />

            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
                {/* Meta */}
                <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[contract.status]}`}>{contract.status}</span>
                    {contract.project && (
                        <span className="text-neutral-500">Project: <Link href={route('projects.index')} className="font-medium text-neutral-800 hover:underline">{contract.project.name}</Link></span>
                    )}
                    {contract.contact && <span className="text-neutral-500">Client: <span className="font-medium text-neutral-800">{contract.contact.name}</span></span>}
                </div>

                {/* Action bar */}
                <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
                    <div className="flex flex-wrap items-center gap-3">
                        {contract.status === 'draft' && (
                            <button onClick={send} className="btn-primary">Mark as sent</button>
                        )}
                        <button onClick={() => setSignOpen(true)} className="btn-secondary" disabled={!isOpen && contract.status !== 'signed'}>
                            {studioSig ? 'Update your signature' : 'Sign as photographer'}
                        </button>
                        {isOpen && (
                            <button onClick={voidContract} className="btn-secondary text-red-600 hover:bg-red-50">Void</button>
                        )}
                        <span className="text-xs">
                            {studioSig ? <span className="text-emerald-600">✓ You signed</span> : <span className="text-neutral-400">Not signed by you</span>}
                            <span className="mx-2 text-neutral-300">·</span>
                            {clientSig ? <span className="text-emerald-600">✓ Client signed</span> : <span className="text-neutral-400">Awaiting client</span>}
                        </span>
                    </div>

                    {(contract.status === 'sent' || contract.status === 'signed') && (
                        <div className="mt-4 border-t border-neutral-100 pt-4">
                            <p className="mb-1.5 text-xs font-medium text-neutral-400">Client signing link</p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input readOnly value={sign_url} className="input flex-1 text-xs text-neutral-500" onFocus={(e) => e.target.select()} />
                                <button onClick={copyLink} className="btn-secondary shrink-0">{copied ? 'Copied!' : 'Copy link'}</button>
                                <a href={sign_url} target="_blank" rel="noreferrer" className="btn-secondary shrink-0">Open</a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Contract body */}
                <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
                    <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{contract.title}</h1>
                    <div
                        className="text-sm leading-relaxed text-neutral-700 [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: renderedBody || '<p class="text-neutral-400">No contract body yet.</p>' }}
                    />
                </div>

                {/* Fields summary */}
                {(studioFields.length > 0 || clientFields.length > 0) && (
                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                        {studioFields.length > 0 && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-5">
                                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Studio fields</h2>
                                <dl className="space-y-2 text-sm">
                                    {studioFields.map((f) => (
                                        <div key={f.key} className="flex justify-between gap-4">
                                            <dt className="text-neutral-500">{f.label}</dt>
                                            <dd className="text-right font-medium text-neutral-800">{resolveToken(f.key).text || <span className="text-neutral-300">—</span>}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}
                        {clientFields.length > 0 && (
                            <div className="rounded-xl border border-neutral-200 bg-white p-5">
                                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Client completes at signing</h2>
                                <ul className="space-y-2 text-sm">
                                    {clientFields.map((f) => {
                                        const { text, filled } = resolveToken(f.key);
                                        return (
                                            <li key={f.key} className="flex items-center justify-between gap-2 text-neutral-600">
                                                <span className="flex items-center gap-2">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${filled ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                                    {f.label}
                                                </span>
                                                <span className="font-medium text-neutral-800">{filled ? text : <span className="text-xs font-normal text-neutral-400">({f.type})</span>}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Signatures */}
                {(studioSig || clientSig) && (
                    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5">
                        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Signatures</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {[{ role: 'Photographer', sig: studioSig }, { role: 'Client', sig: clientSig }].map(({ role, sig }) => (
                                <div key={role} className="rounded-lg border border-neutral-100 p-3">
                                    <p className="text-xs text-neutral-400">{role}</p>
                                    {sig ? (
                                        <>
                                            {sig.signature_type === 'drawn' && sig.signature_data ? (
                                                <img src={sig.signature_data} alt="Signature" className="my-1 h-14" />
                                            ) : (
                                                <p className="my-1 font-[cursive] text-2xl text-neutral-800">{sig.signer_name}</p>
                                            )}
                                            <p className="text-xs text-neutral-500">{sig.signer_name} · {fmtDate(sig.signed_at)}</p>
                                        </>
                                    ) : (
                                        <p className="my-3 text-sm text-neutral-300">Not yet signed</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <SendEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} defaults={email_defaults} />

            {/* Studio signature modal */}
            <Modal show={signOpen} onClose={() => setSignOpen(false)} maxWidth="lg">
                <form onSubmit={submitSign} className="p-6">
                    <h2 className="mb-1 text-lg font-semibold text-neutral-900">Sign as photographer</h2>
                    <p className="mb-4 text-sm text-neutral-500">Type or draw your signature. This is recorded with the date and your IP address.</p>
                    <SignaturePad value={signForm.data} onChange={(v) => signForm.setData(v)} />
                    {signForm.errors.signature_data && <p className="mt-2 text-xs text-red-600">A signature is required.</p>}
                    {signForm.errors.signer_name && <p className="mt-2 text-xs text-red-600">{signForm.errors.signer_name}</p>}
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" onClick={() => setSignOpen(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={signForm.processing || !signForm.data.signer_name || !signForm.data.signature_data} className="btn-primary disabled:opacity-40">
                            {signForm.processing ? 'Saving…' : 'Save signature'}
                        </button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
