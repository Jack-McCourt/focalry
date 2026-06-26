import PublicShell from '@/Components/PublicShell';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

interface FieldDef {
    key: string;
    label: string;
    type: string;
    options: { label: string; color: string }[] | null;
}
interface Asset {
    url: string;
    name?: string;
}
interface ShareProject {
    name: string;
    event_date: string | null;
    status: string | null;
    type: string | null;
    notes: string | null;
    custom_fields: Record<string, unknown>;
    client: { name: string; email: string | null; phone: string | null } | null;
}

function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isEmpty(v: unknown): boolean {
    return v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

function FieldValue({ field, value }: { field: FieldDef; value: unknown }) {
    if (field.type === 'checkbox') {
        return <span className="text-neutral-800">{value ? 'Yes' : 'No'}</span>;
    }
    if (field.type === 'image' && Array.isArray(value)) {
        return (
            <div className="columns-2 gap-2 sm:columns-3 [&>*]:mb-2">
                {(value as Asset[]).map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block break-inside-avoid">
                        <img src={a.url} alt={a.name ?? ''} loading="lazy" className="w-full rounded-md border border-neutral-200" />
                    </a>
                ))}
            </div>
        );
    }
    if (field.type === 'file' && Array.isArray(value)) {
        return (
            <ul className="space-y-1">
                {(value as Asset[]).map((a, i) => (
                    <li key={i}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-neutral-800 underline print:no-underline">
                            {a.name ?? 'File'}
                        </a>
                    </li>
                ))}
            </ul>
        );
    }
    if (field.type === 'url') {
        return (
            <a href={String(value)} target="_blank" rel="noreferrer" className="text-neutral-800 underline print:no-underline">
                {String(value)}
            </a>
        );
    }
    return <span className="whitespace-pre-line text-neutral-800">{String(value)}</span>;
}

export default function ProjectShare({
    project,
    fields,
    studio_name,
    studio_logo,
}: PageProps<{
    project: ShareProject;
    fields: FieldDef[];
    studio_name: string | null;
    studio_logo: string | null;
}>) {
    const eventDate = fmtDate(project.event_date);
    const visibleFields = fields.filter((f) => !isEmpty(project.custom_fields[f.key]));

    return (
        <PublicShell brand={{ name: studio_name, logo: studio_logo }} maxWidth="lg">
            <Head title={project.name} />

            <div className="mb-4 flex items-center justify-end print:hidden">
                <button
                    onClick={() => window.print()}
                    className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                    Print
                </button>
            </div>

            <article className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm sm:p-12 print:rounded-none print:border-0 print:p-0 print:shadow-none">
                <header className="border-b border-neutral-100 pb-6">
                    <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{project.name}</h1>
                    {eventDate && <p className="mt-2 text-lg text-neutral-600">{eventDate}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {project.type && (
                            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{project.type}</span>
                        )}
                        {project.status && (
                            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{project.status}</span>
                        )}
                    </div>
                </header>

                {project.client && (
                    <section className="border-b border-neutral-100 py-6">
                        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Client</h2>
                        <p className="text-neutral-900">{project.client.name}</p>
                        {project.client.email && <p className="text-sm text-neutral-600">{project.client.email}</p>}
                        {project.client.phone && <p className="text-sm text-neutral-600">{project.client.phone}</p>}
                    </section>
                )}

                {visibleFields.length > 0 && (
                    <section className="py-6">
                        <dl className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
                            {visibleFields.map((f) => {
                                const wide = f.type === 'long_text' || f.type === 'image' || f.type === 'file';
                                return (
                                    <div key={f.key} className={wide ? 'sm:col-span-2' : ''}>
                                        <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">{f.label}</dt>
                                        <dd className="text-sm leading-relaxed">
                                            <FieldValue field={f} value={project.custom_fields[f.key]} />
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                    </section>
                )}

                {project.notes && (
                    <section className="border-t border-neutral-100 pt-6">
                        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Notes</h2>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">{project.notes}</p>
                    </section>
                )}
            </article>
        </PublicShell>
    );
}
