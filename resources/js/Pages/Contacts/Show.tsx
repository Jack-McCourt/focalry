import ContactFormFields, { ContactFormData } from '@/Components/ContactFormFields';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { pillStyle } from '@/lib/projectColors';
import { Contact, PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';

interface LinkedCollection {
    id: number;
    title: string;
    slug: string;
    status: 'draft' | 'published';
    event_date: string | null;
}

interface LinkedProject {
    id: number;
    name: string;
    event_date: string | null;
    status: { label: string; color: string } | null;
    type: { label: string; color: string } | null;
}

export default function Show({
    contact,
    collections,
    projects,
}: PageProps<{ contact: Contact; collections: LinkedCollection[]; projects: LinkedProject[] }>) {
    const { data, setData, patch, processing, isDirty, errors } = useForm<ContactFormData>({
        first_name: contact.first_name,
        last_name: contact.last_name ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        company: contact.company ?? '',
        status: contact.status,
        notes: contact.notes ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('contacts.update', contact.id), { preserveScroll: true });
    };

    const destroy = () => {
        if (confirm('Delete this contact? This cannot be undone.')) {
            router.delete(route('contacts.destroy', contact.id));
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Link href={route('contacts.index')} className="text-neutral-400 hover:text-neutral-700">
                            Contacts
                        </Link>
                        <span className="text-neutral-300">/</span>
                        <span className="font-semibold text-neutral-900">{contact.name}</span>
                    </div>
                    {contact.email && (
                        <Link href={route('messages.index', { compose: contact.id })} className="btn-secondary px-3 py-1.5 text-xs">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                            Message
                        </Link>
                    )}
                </div>
            }
        >
            <Head title={contact.name} />
            <StudioManagerNav active="contacts" />

            <div className="grid gap-8 px-4 sm:px-8 py-8 lg:grid-cols-3">
                {/* Edit form */}
                <div className="lg:col-span-2">
                    <form onSubmit={submit} className="max-w-lg rounded-xl border border-neutral-200 bg-white p-6">
                        <h2 className="mb-5 text-sm font-semibold text-neutral-900">Contact details</h2>
                        <ContactFormFields data={data} setData={setData} errors={errors} />
                        {isDirty && (
                            <button type="submit" disabled={processing} className="btn-primary mt-6 w-full justify-center">
                                {processing ? 'Saving…' : 'Save changes'}
                            </button>
                        )}
                    </form>

                    <div className="mt-6 max-w-lg">
                        <button
                            type="button"
                            onClick={destroy}
                            className="btn-secondary border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
                        >
                            Delete contact
                        </button>
                    </div>
                </div>

                {/* Linked galleries */}
                <div className="space-y-8">
                    {/* Projects */}
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-neutral-900">Projects</h2>
                            <Link href={`/projects?client=${contact.id}`} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
                                + New
                            </Link>
                        </div>
                        {projects.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
                                No projects yet.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {projects.map((p) => (
                                    <Link
                                        key={p.id}
                                        href={`/projects?open=${p.id}`}
                                        className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-300"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-medium text-neutral-900">{p.name}</span>
                                            {p.status && (
                                                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={pillStyle(p.status.color)}>
                                                    {p.status.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                                            {p.type && <span style={{ color: p.type.color }}>{p.type.label}</span>}
                                            {p.event_date && (
                                                <span>
                                                    · {new Date(p.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Galleries */}
                    <div>
                        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Galleries</h2>
                    {collections.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
                            No galleries linked to this contact yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {collections.map((c) => (
                                <Link
                                    key={c.id}
                                    href={route('collections.show', c.id)}
                                    className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-300"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-medium text-neutral-900">{c.title}</span>
                                        {c.status === 'published' ? (
                                            <span className="shrink-0 text-xs font-medium text-emerald-600">Published</span>
                                        ) : (
                                            <span className="shrink-0 text-xs text-neutral-400">Draft</span>
                                        )}
                                    </div>
                                    {c.event_date && (
                                        <p className="mt-0.5 text-xs text-neutral-400">
                                            {new Date(c.event_date).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
