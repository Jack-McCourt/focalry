import Modal from '@/Components/Modal';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Paginated, SiteLeadRow } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Paginator from '@/Components/Paginator';

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function Leads({ leads }: PageProps<{ leads: Paginated<SiteLeadRow>; public_url: string }>) {
    const [active, setActive] = useState<SiteLeadRow | null>(null);

    return (
        <AuthenticatedLayout
            header={<h1 className="text-sm font-semibold text-neutral-900">Website leads</h1>}
        >
            <Head title="Website leads" />

            <div className="px-4 py-8 sm:px-8">
                {leads.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">No leads yet</p>
                        <p className="mt-1 text-sm text-neutral-500">Enquiries from your website's contact form will appear here and in your CRM.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <th className="px-4 py-3">Name</th>
                                    <th className="hidden px-4 py-3 sm:table-cell">Contact</th>
                                    <th className="hidden px-4 py-3 md:table-cell">Enquiry</th>
                                    <th className="px-4 py-3">Project</th>
                                    <th className="px-4 py-3 text-right">Received</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {leads.data.map((l) => (
                                    <tr key={l.id} className="align-top">
                                        <td className="px-4 py-3">
                                            <button onClick={() => setActive(l)} className="text-left font-medium text-neutral-900 hover:text-brand-700 hover:underline">
                                                {l.name ?? '—'}
                                            </button>
                                            {l.event_type && <div className="text-xs text-neutral-400">{l.event_type}{l.event_date ? ` · ${fmtDate(l.event_date)}` : ''}</div>}
                                        </td>
                                        <td className="hidden px-4 py-3 text-neutral-600 sm:table-cell">
                                            {l.email && <div>{l.email}</div>}
                                            {l.phone && <div className="text-xs text-neutral-400">{l.phone}</div>}
                                        </td>
                                        <td className="hidden max-w-xs px-4 py-3 text-neutral-500 md:table-cell">
                                            <span className="line-clamp-1">{l.message ?? '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {l.contact ? (
                                                <Link href={route('contacts.show', l.contact.id)} className="text-brand-700 hover:underline">{l.contact.name}</Link>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-neutral-500">{fmtDate(l.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Paginator paginator={leads} />
            </div>

            <LeadDetailsModal lead={active} onClose={() => setActive(null)} />
        </AuthenticatedLayout>
    );
}

function LeadDetailsModal({ lead, onClose }: { lead: SiteLeadRow | null; onClose: () => void }) {
    const customValues = (lead?.payload?.custom_values ?? []).filter((c) => (c?.label ?? '') !== '' && (c?.value ?? '') !== '');
    const attachment = lead?.payload?.attachment_url ?? null;

    return (
        <Modal show={!!lead} onClose={onClose} maxWidth="lg">
            {lead && (
                <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-neutral-900">{lead.name ?? 'Enquiry'}</h2>
                            {lead.event_type && (
                                <p className="mt-0.5 text-sm text-neutral-500">{lead.event_type}{lead.event_date ? ` · ${fmtDate(lead.event_date)}` : ''}</p>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="shrink-0 text-neutral-400 hover:text-neutral-700">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="grid grid-cols-[6rem,1fr] gap-2">
                            <dt className="text-neutral-400">Email</dt>
                            <dd className="text-neutral-700">{lead.email ? <a href={`mailto:${lead.email}`} className="text-brand-700 hover:underline">{lead.email}</a> : '—'}</dd>
                        </div>
                        <div className="grid grid-cols-[6rem,1fr] gap-2">
                            <dt className="text-neutral-400">Phone</dt>
                            <dd className="text-neutral-700">{lead.phone ?? '—'}</dd>
                        </div>
                        <div className="grid grid-cols-[6rem,1fr] gap-2">
                            <dt className="text-neutral-400">Received</dt>
                            <dd className="text-neutral-700">{fmtDate(lead.created_at)}</dd>
                        </div>
                        <div className="grid grid-cols-[6rem,1fr] gap-2">
                            <dt className="text-neutral-400">Message</dt>
                            <dd className="whitespace-pre-line leading-relaxed text-neutral-700">{lead.message ?? '—'}</dd>
                        </div>
                        {customValues.map((c, i) => (
                            <div key={i} className="grid grid-cols-[6rem,1fr] gap-2">
                                <dt className="truncate text-neutral-400">{c.label}</dt>
                                <dd className="whitespace-pre-line text-neutral-700">{c.value}</dd>
                            </div>
                        ))}
                        {attachment && (
                            <div className="grid grid-cols-[6rem,1fr] gap-2">
                                <dt className="text-neutral-400">Attachment</dt>
                                <dd><a href={attachment} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">View attachment</a></dd>
                            </div>
                        )}
                    </dl>

                    <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
                        {lead.contact ? (
                            <>
                                <Link href={route('contacts.show', lead.contact.id)} className="btn-secondary px-3 py-1.5 text-xs">View contact</Link>
                                <Link href={route('messages.with-contact', lead.contact.id)} className="btn-primary px-3 py-1.5 text-xs">Message {lead.name?.split(' ')[0] ?? 'client'}</Link>
                            </>
                        ) : (
                            <span className="text-xs text-neutral-400">No linked contact.</span>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
}
