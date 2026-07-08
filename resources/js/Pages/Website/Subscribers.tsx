import Paginator from '@/Components/Paginator';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Paginated } from '@/types';
import { Head } from '@inertiajs/react';

interface SubscriberRow {
    id: number;
    email: string;
    name: string | null;
    source: string | null;
    created_at: string;
}

export default function Subscribers({ subscribers, total }: PageProps<{ subscribers: Paginated<SubscriberRow>; total: number }>) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between gap-3">
                    <h1 className="text-sm font-semibold text-neutral-900">Subscribers</h1>
                    {total > 0 && (
                        <a href={route('website.subscribers.export')} className="btn-secondary">
                            Export CSV
                        </a>
                    )}
                </div>
            }
        >
            <Head title="Subscribers" />

            <div className="px-4 py-8 sm:px-8">
                {subscribers.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <p className="text-base font-medium text-neutral-900">No subscribers yet</p>
                        <p className="mt-1 max-w-sm text-center text-sm text-neutral-500">
                            Add a <strong>Newsletter</strong> block to your website to start collecting email signups. Export them any time as a CSV for Mailchimp, Flodesk or any email tool.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="mb-3 text-sm text-neutral-500">{total.toLocaleString()} subscriber{total === 1 ? '' : 's'}</p>
                        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                        <th className="px-4 py-3">Email</th>
                                        <th className="hidden px-4 py-3 sm:table-cell">Name</th>
                                        <th className="hidden px-4 py-3 md:table-cell">Signed up on</th>
                                        <th className="px-4 py-3 text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {subscribers.data.map((s) => (
                                        <tr key={s.id}>
                                            <td className="px-4 py-3 font-medium text-neutral-900">{s.email}</td>
                                            <td className="hidden px-4 py-3 text-neutral-600 sm:table-cell">{s.name ?? '—'}</td>
                                            <td className="hidden px-4 py-3 text-neutral-500 md:table-cell">{s.source ? `/${s.source}` : '—'}</td>
                                            <td className="px-4 py-3 text-right text-neutral-500">
                                                {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4">
                            <Paginator paginator={subscribers} />
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
