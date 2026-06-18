import SearchSelect from '@/Components/SearchSelect';
import CustomFieldEditor, { CustomValue } from '@/Components/CustomFieldEditor';
import FieldConfigModal from '@/Components/FieldConfigModal';
import Modal from '@/Components/Modal';
import PillSelect from '@/Components/PillSelect';
import ProjectCalendar from '@/Components/ProjectCalendar';
import ProjectDrawer from '@/Components/ProjectDrawer';
import ProjectKanban from '@/Components/ProjectKanban';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Project, ProjectFieldDefinition, ProjectStatus, ProjectType } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface Filters {
    search: string;
    status: number | null;
    type: number | null;
}
type View = 'grid' | 'kanban' | 'calendar';
type ContactOption = { id: number; name: string };

type ProjectsProps = {
    projects: Project[];
    statuses: ProjectStatus[];
    types: ProjectType[];
    fields: ProjectFieldDefinition[];
    contacts: ContactOption[];
    filters: Filters;
    view: View;
    preselect_contact_id: number | null;
};

function NewProjectModal({
    show,
    onClose,
    statuses,
    types,
    contacts,
    initialContactId,
}: {
    show: boolean;
    onClose: () => void;
    statuses: ProjectStatus[];
    types: ProjectType[];
    contacts: ContactOption[];
    initialContactId: number | null;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        type_id: (types[0]?.id ?? '') as number | '',
        status_id: (statuses[0]?.id ?? '') as number | '',
        event_date: '',
        contact_id: (initialContactId ?? '') as number | '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('projects.store'), {
            preserveScroll: true,
            onSuccess: () => { reset(); onClose(); },
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-5 text-base font-semibold text-neutral-900">New project</h2>
                <div className="space-y-4">
                    <div>
                        <label className="label mb-1.5">Project name</label>
                        <input type="text" value={data.name} onChange={(e) => setData('name', e.target.value)} className="input" autoFocus />
                        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="label mb-1.5">Client</label>
                        <SearchSelect
                            options={contacts}
                            value={data.contact_id === '' ? null : data.contact_id}
                            onChange={(id) => setData('contact_id', id ?? '')}
                            placeholder="Search clients…"
                            emptyText="No clients found"
                        />
                        {errors.contact_id && <p className="mt-1 text-xs text-red-600">{errors.contact_id}</p>}
                        {contacts.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">No clients yet — add a contact first.</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label mb-1.5">Type</label>
                            <select value={data.type_id} onChange={(e) => setData('type_id', e.target.value ? Number(e.target.value) : '')} className="input">
                                {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label mb-1.5">Status</label>
                            <select value={data.status_id} onChange={(e) => setData('status_id', e.target.value ? Number(e.target.value) : '')} className="input">
                                {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="label mb-1.5">Event date</label>
                            <input type="date" value={data.event_date} onChange={(e) => setData('event_date', e.target.value)} className="input" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Create project'}</button>
                </div>
            </form>
        </Modal>
    );
}

export default function Index({ projects, statuses, types, fields, contacts, filters, view, preselect_contact_id }: PageProps<ProjectsProps>) {
    const [rows, setRows] = useState<Project[]>(projects);
    const [showNew, setShowNew] = useState(!!preselect_contact_id);
    const [showAddField, setShowAddField] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    // Resync when the server sends a new list (after create/delete).
    useEffect(() => setRows(projects), [projects]);

    const go = (params: Partial<{ search: string; status: number | null; type: number | null; view: View }>) => {
        // Use `in` so an explicit null (e.g. "All types") clears the filter — `??` would
        // treat null as "not provided" and fall back to the current value.
        const search = 'search' in params ? params.search : filters.search;
        const status = 'status' in params ? params.status : filters.status;
        const type = 'type' in params ? params.type : filters.type;
        router.get(
            route('projects.index'),
            {
                search: search || undefined,
                status: status ?? undefined,
                type: type ?? undefined,
                view: params.view ?? view,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        const t = setTimeout(() => go({ search }), 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const patchField = (id: number, field: keyof Project, value: string | number | null) => {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
        router.patch(route('projects.update', id), { [field]: value }, { preserveScroll: true, preserveState: true });
    };

    const remove = (id: number) => {
        if (confirm('Delete this project?')) {
            router.delete(route('projects.destroy', id), { preserveScroll: true });
        }
    };

    const patchCustom = (id: number, key: string, value: CustomValue) => {
        let next: Record<string, CustomValue> = {};
        setRows((rs) =>
            rs.map((r) => {
                if (r.id !== id) return r;
                next = { ...(r.custom_fields as Record<string, CustomValue>), [key]: value };
                return { ...r, custom_fields: next };
            }),
        );
        router.patch(route('projects.update', id), { custom_fields: next }, { preserveScroll: true, preserveState: true });
    };

    const deleteField = (field: ProjectFieldDefinition) => {
        if (confirm(`Delete the "${field.label}" field? Existing values are hidden but not removed.`)) {
            router.delete(route('project-fields.destroy', field.id), { preserveScroll: true });
        }
    };

    const moveProject = (movedId: number, statusId: number, orderedIds: number[]) => {
        // Optimistic: re-slot the moved card + renumber the target column.
        setRows((rs) =>
            rs.map((r) => {
                const idx = orderedIds.indexOf(r.id);
                return idx === -1 ? r : { ...r, status_id: statusId, position: idx };
            }),
        );
        router.post(
            route('projects.move', movedId),
            { status_id: statusId, ordered_ids: orderedIds },
            { preserveScroll: true, preserveState: true },
        );
    };

    const cellSelect = 'w-full rounded border-0 bg-transparent px-1 py-1 text-sm focus:ring-1 focus:ring-neutral-300';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Studio Manager</h1>
                    <div className="flex items-center gap-2">
                        <Link href={route('projects.settings')} className="btn-secondary">Settings</Link>
                        <button onClick={() => setShowNew(true)} className="btn-primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            New project
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Projects" />
            <StudioManagerNav active="projects" />

            <div className="px-4 sm:px-8 py-6">
                {/* View switcher + filters */}
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
                        {(['grid', 'kanban', 'calendar'] as View[]).map((v) => (
                            <button
                                key={v}
                                onClick={() => go({ view: v })}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                                    view === v ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-800'
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search projects…"
                            className="input sm:w-56"
                        />
                        <select value={filters.type ?? ''} onChange={(e) => go({ type: e.target.value ? Number(e.target.value) : null })} className="input">
                            <option value="">All types</option>
                            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <select value={filters.status ?? ''} onChange={(e) => go({ status: e.target.value ? Number(e.target.value) : null })} className="input">
                            <option value="">All statuses</option>
                            {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        {view === 'grid' && (
                            <button onClick={() => setShowAddField(true)} className="btn-secondary whitespace-nowrap">+ Field</button>
                        )}
                    </div>
                </div>

                {view === 'grid' && (
                    rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24">
                            <p className="text-base font-medium text-neutral-900">No projects yet</p>
                            <p className="mt-1 text-sm text-neutral-500">Track shoots, leads and jobs here.</p>
                            <button onClick={() => setShowNew(true)} className="btn-primary mt-6">New project</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-400 [&>th]:whitespace-nowrap">
                                        <th className="sticky left-0 z-30 w-[7rem] min-w-[7rem] bg-white px-2 py-3"></th>
                                        <th className="sticky left-[7rem] z-30 min-w-[14rem] border-r border-neutral-200 bg-white px-4 py-3">Name</th>
                                        <th className="min-w-[9rem] px-4 py-3">Type</th>
                                        <th className="min-w-[9rem] px-4 py-3">Status</th>
                                        <th className="min-w-[9rem] px-4 py-3">Event date</th>
                                        <th className="min-w-[11rem] px-4 py-3">Client</th>
                                        {fields.map((f) => (
                                            <th key={f.id} className="group/h min-w-[10rem] px-4 py-3">
                                                <span className="inline-flex items-center gap-1">
                                                    {f.label}
                                                    <button onClick={() => deleteField(f)} className="text-neutral-300 opacity-0 transition hover:text-red-500 group-hover/h:opacity-100" title="Delete field">
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {rows.map((p) => (
                                        <tr key={p.id} className="group">
                                            <td className="sticky left-0 z-20 w-[7rem] min-w-[7rem] bg-white px-2 py-2 group-hover:bg-neutral-50">
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setOpenId(p.id)} className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">
                                                        Open
                                                    </button>
                                                    <button onClick={() => remove(p.id)} className="text-neutral-300 transition hover:text-red-500" title="Delete">
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="sticky left-[7rem] z-20 min-w-[14rem] border-r border-neutral-200 bg-white px-4 py-2 group-hover:bg-neutral-50">
                                                <input
                                                    type="text"
                                                    value={p.name}
                                                    onChange={(e) => setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, name: e.target.value } : r)))}
                                                    onBlur={(e) => patchField(p.id, 'name', e.target.value)}
                                                    className="w-full rounded border-0 bg-transparent px-1 py-1 font-medium text-neutral-900 focus:ring-1 focus:ring-neutral-300"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <PillSelect options={types} value={p.type_id} onChange={(id) => patchField(p.id, 'type_id', id)} placeholder="Set type" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <PillSelect options={statuses} value={p.status_id} onChange={(id) => patchField(p.id, 'status_id', id)} placeholder="Set status" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input type="date" value={p.event_date ?? ''} onChange={(e) => patchField(p.id, 'event_date', e.target.value || null)} className="rounded border-0 bg-transparent px-1 py-1 text-sm text-neutral-600 focus:ring-1 focus:ring-neutral-300" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <select value={p.contact_id ?? ''} onChange={(e) => e.target.value && patchField(p.id, 'contact_id', Number(e.target.value))} className={cellSelect}>
                                                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </td>
                                            {fields.map((f) => (
                                                <td key={f.id} className="px-4 py-2">
                                                    <CustomFieldEditor
                                                        field={f}
                                                        value={(p.custom_fields[f.key] ?? null) as CustomValue}
                                                        onChange={(v) => patchCustom(p.id, f.key, v)}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {view === 'kanban' && (
                    <ProjectKanban
                        projects={rows}
                        statuses={statuses}
                        types={types}
                        onMove={moveProject}
                        onOpen={(id) => setOpenId(id)}
                    />
                )}

                {view === 'calendar' && (
                    <ProjectCalendar
                        projects={rows}
                        statuses={statuses}
                        types={types}
                        onOpen={(id) => setOpenId(id)}
                    />
                )}
            </div>

            <NewProjectModal show={showNew} onClose={() => setShowNew(false)} statuses={statuses} types={types} contacts={contacts} initialContactId={preselect_contact_id} />

            <ProjectDrawer
                project={rows.find((r) => r.id === openId) ?? null}
                statuses={statuses}
                types={types}
                fields={fields}
                contacts={contacts}
                onClose={() => setOpenId(null)}
                onPatch={(field, value) => openId && patchField(openId, field, value)}
                onPatchCustom={(key, value) => openId && patchCustom(openId, key, value)}
            />

            <FieldConfigModal show={showAddField} onClose={() => setShowAddField(false)} />
        </AuthenticatedLayout>
    );
}
