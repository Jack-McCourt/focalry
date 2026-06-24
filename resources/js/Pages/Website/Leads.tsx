import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Paginated, SiteLeadRow } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function Leads({ leads }: PageProps<{ leads: Paginated<SiteLeadRow>; public_url: string }>) {
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
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
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
                                            <div className="font-medium text-neutral-900">{l.name ?? '—'}</div>
                                            {l.event_type && <div className="text-xs text-neutral-400">{l.event_type}{l.event_date ? ` · ${fmtDate(l.event_date)}` : ''}</div>}
                                        </td>
                                        <td className="hidden px-4 py-3 text-neutral-600 sm:table-cell">
                                            {l.email && <div>{l.email}</div>}
                                            {l.phone && <div className="text-xs text-neutral-400">{l.phone}</div>}
                                        </td>
                                        <td className="hidden max-w-xs px-4 py-3 text-neutral-500 md:table-cell">
                                            <span className="line-clamp-2">{l.message ?? '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {l.contact ? (
                                                <Link href={route('contacts.show', l.contact.id)} className="text-blue-700 hover:underline">{l.contact.name}</Link>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-neutral-500">{fmtDate(l.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {leads.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                        {leads.prev_page_url && <button onClick={() => router.get(leads.prev_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">Previous</button>}
                        <span className="text-xs text-neutral-500">Page {leads.current_page} of {leads.last_page}</span>
                        {leads.next_page_url && <button onClick={() => router.get(leads.next_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">Next</button>}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
