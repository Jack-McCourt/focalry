import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface Proposal {
    id: number;
    title: string;
    status: 'draft' | 'sent' | 'accepted' | 'declined';
    intro: string | null;
    require_signature: boolean;
    require_deposit: boolean;
    project: { id: number; name: string } | null;
    contact: { name: string; email: string | null } | null;
    package: { name: string; price: string } | null;
    contract: { id: number; title: string; status: string } | null;
    invoice: { id: number; number: string; status: string; total: string; paid: string } | null;
    accepted_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-neutral-100 text-neutral-500',
    sent: 'bg-blue-50 text-blue-700',
    accepted: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-red-50 text-red-700',
};

export default function Show({ proposal, public_url }: PageProps<{ proposal: Proposal; public_url: string }>) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(public_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const send = () => router.post(route('proposals.send', proposal.id), {}, { preserveScroll: true });
    const del = () => {
        if (confirm('Delete this proposal?')) router.delete(route('proposals.destroy', proposal.id));
    };

    const canSend = proposal.status === 'draft' || proposal.status === 'sent';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="truncate text-sm font-semibold text-neutral-900">{proposal.title}</h1>
                    {canSend && <button onClick={send} className="btn-primary">{proposal.status === 'draft' ? 'Send proposal' : 'Re-send'}</button>}
                </div>
            }
        >
            <Head title={proposal.title} />
            <StudioManagerNav active="proposals" />

            <div className="mx-auto max-w-2xl px-4 sm:px-8 py-8">
                <div className="mb-4 flex items-center gap-3 text-sm text-neutral-500">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[proposal.status]}`}>{proposal.status}</span>
                    {proposal.project && <span>{proposal.project.name}</span>}
                    {proposal.contact && <span>· {proposal.contact.name}</span>}
                    {proposal.accepted_at && <span className="text-emerald-600">· accepted {proposal.accepted_at}</span>}
                </div>

                <div className="mb-6 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                    <input readOnly value={public_url} className="input flex-1 bg-neutral-50 text-neutral-500" />
                    <button onClick={copy} className="btn-secondary shrink-0">{copied ? 'Copied!' : 'Copy link'}</button>
                </div>

                {proposal.intro && (
                    <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm whitespace-pre-wrap text-neutral-700">{proposal.intro}</div>
                )}

                <div className="space-y-3">
                    <SummaryRow label="Package" value={proposal.package ? `${proposal.package.name} · ${proposal.package.price}` : 'None'} />
                    <SummaryRow
                        label="Contract"
                        value={proposal.contract ? proposal.contract.title : 'None'}
                        badge={proposal.contract?.status}
                        required={proposal.require_signature}
                        href={proposal.contract ? route('contracts.show', proposal.contract.id) : undefined}
                    />
                    <SummaryRow
                        label="Deposit"
                        value={proposal.invoice ? `${proposal.invoice.number} · ${proposal.invoice.paid} of ${proposal.invoice.total}` : 'None'}
                        badge={proposal.invoice?.status}
                        required={proposal.require_deposit}
                        href={proposal.invoice ? route('invoices.show', proposal.invoice.id) : undefined}
                    />
                </div>

                <div className="mt-8">
                    <button onClick={del} className="text-sm font-medium text-red-500 hover:text-red-700">Delete proposal</button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function SummaryRow({ label, value, badge, required, href }: { label: string; value: string; badge?: string; required?: boolean; href?: string }) {
    const inner = (
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}{required && <span className="ml-1 text-neutral-300">· required</span>}</p>
                <p className="mt-0.5 text-sm text-neutral-900">{value}</p>
            </div>
            {badge && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-600">{badge}</span>}
        </div>
    );
    return href ? <Link href={href} className="block transition hover:opacity-80">{inner}</Link> : inner;
}
