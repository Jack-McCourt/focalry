import ContactFormFields, { ContactFormData } from '@/Components/ContactFormFields';
import Modal from '@/Components/Modal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Contact, PageProps, Paginated } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface Filters {
    search: string;
    status: string | null;
}

interface Counts {
    all: number;
    lead: number;
    client: number;
    archived: number;
}

const STATUS_STYLES: Record<Contact['status'], string> = {
    lead: 'bg-amber-50 text-amber-700',
    client: 'bg-emerald-50 text-emerald-700',
    archived: 'bg-neutral-100 text-neutral-500',
};

function StatusBadge({ status }: { status: Contact['status'] }) {
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status]}`}>
            {status}
        </span>
    );
}

function AddContactModal({ show, onClose }: { show: boolean; onClose: () => void }) {
    const { data, setData, post, processing, errors, reset } = useForm<ContactFormData>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        status: 'lead',
        notes: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('contacts.store'), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-5 text-base font-semibold text-neutral-900">New contact</h2>
                <ContactFormFields data={data} setData={setData} errors={errors} />
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button type="submit" disabled={processing} className="btn-primary">
                        {processing ? 'Saving…' : 'Add contact'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function Index({
    contacts,
    filters,
    counts,
}: PageProps<{ contacts: Paginated<Contact>; filters: Filters; counts: Counts }>) {
    const [search, setSearch] = useState(filters.search);
    const [showAdd, setShowAdd] = useState(false);
    const firstRender = useRef(true);

    // Debounced search — push to the server, preserving scroll/state.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('contacts.index'),
                { search, status: filters.status ?? undefined },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const setStatus = (status: string | null) => {
        router.get(
            route('contacts.index'),
            { search: search || undefined, status: status ?? undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const statusTabs: { key: string | null; label: string; count: number }[] = [
        { key: null, label: 'All', count: counts.all },
        { key: 'lead', label: 'Leads', count: counts.lead },
        { key: 'client', label: 'Clients', count: counts.client },
        { key: 'archived', label: 'Archived', count: counts.archived },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>
                    <button onClick={() => setShowAdd(true)} className="btn-primary">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add contact
                    </button>
                </div>
            }
        >
            <Head title="Contacts" />
            <StudioManagerNav active="contacts" />

            <div className="px-8 py-8">
                {/* Filters */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {statusTabs.map((t) => {
                            const active = (filters.status ?? null) === t.key;
                            return (
                                <button
                                    key={t.label}
                                    onClick={() => setStatus(t.key)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                        active
                                            ? 'bg-neutral-900 text-white'
                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                                >
                                    {t.label}
                                    <span className={`ml-1.5 ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>{t.count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative sm:w-64">
                        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search contacts…"
                            className="input pl-9"
                        />
                    </div>
                </div>

                {contacts.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100">
                            <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                        </div>
                        <p className="mt-4 text-base font-medium text-neutral-900">
                            {filters.search || filters.status ? 'No matching contacts' : 'No contacts yet'}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                            {filters.search || filters.status
                                ? 'Try a different search or filter.'
                                : 'Add your first lead or client to get started.'}
                        </p>
                        {!filters.search && !filters.status && (
                            <button onClick={() => setShowAdd(true)} className="btn-primary mt-6">
                                Add contact
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400">
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="hidden px-4 py-3 sm:table-cell">Phone</th>
                                    <th className="hidden px-4 py-3 md:table-cell">Company</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Galleries</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {contacts.data.map((c) => (
                                    <tr
                                        key={c.id}
                                        onClick={() => router.visit(route('contacts.show', c.id))}
                                        className="cursor-pointer transition hover:bg-neutral-50"
                                    >
                                        <td className="px-4 py-3 font-medium text-neutral-900">{c.name}</td>
                                        <td className="px-4 py-3 text-neutral-500">{c.email ?? '—'}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">{c.phone ?? '—'}</td>
                                        <td className="hidden px-4 py-3 text-neutral-500 md:table-cell">{c.company ?? '—'}</td>
                                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                        <td className="px-4 py-3 text-right text-neutral-500">{c.collections_count ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {contacts.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                        {contacts.prev_page_url && (
                            <button onClick={() => router.get(contacts.prev_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">
                                Previous
                            </button>
                        )}
                        <span className="text-xs text-neutral-500">
                            Page {contacts.current_page} of {contacts.last_page}
                        </span>
                        {contacts.next_page_url && (
                            <button onClick={() => router.get(contacts.next_page_url!)} className="btn-secondary px-3 py-1.5 text-xs">
                                Next
                            </button>
                        )}
                    </div>
                )}
            </div>

            <AddContactModal show={showAdd} onClose={() => setShowAdd(false)} />
        </AuthenticatedLayout>
    );
}
