import ColorListEditor from '@/Components/ColorListEditor';
import FieldConfigModal from '@/Components/FieldConfigModal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, ProjectFieldDefinition, ProjectStatus, ProjectType } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

const opts = { preserveScroll: true };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <section className="max-w-xl">
            <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
            <div className="mt-4">{children}</div>
        </section>
    );
}

type LeadSettings = { enabled: boolean; value: number; unit: 'days' | 'weeks' | 'months' };

export default function Settings({
    statuses,
    types,
    fields,
    calendar,
    leadSettings,
}: PageProps<{
    statuses: ProjectStatus[];
    types: ProjectType[];
    fields: ProjectFieldDefinition[];
    calendar: { connected: boolean; email: string | null };
    leadSettings: LeadSettings;
}>) {
    const [showAddField, setShowAddField] = useState(false);
    const [leadEnabled, setLeadEnabled] = useState(leadSettings.enabled);
    const [leadValue, setLeadValue] = useState(leadSettings.value);
    const [leadUnit, setLeadUnit] = useState<LeadSettings['unit']>(leadSettings.unit);

    const saveLeadSettings = (next: Partial<LeadSettings>) => {
        const payload = { enabled: leadEnabled, value: leadValue, unit: leadUnit, ...next };
        router.patch(route('projects.lead-settings'), {
            enabled: payload.enabled ? 1 : 0,
            value: payload.value,
            unit: payload.unit,
        }, opts);
    };

    const fieldMove = (i: number, dir: -1 | 1) => {
        const next = [...fields];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        router.post(route('project-fields.reorder'), { ordered_ids: next.map((f) => f.id) }, opts);
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('projects.index')} className="text-neutral-400 hover:text-neutral-700">Projects</Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-semibold text-neutral-900">Settings</span>
                </div>
            }
        >
            <Head title="Project settings" />
            <StudioManagerNav active="projects" />

            <div className="space-y-10 px-4 sm:px-8 py-8">
                <Section title="Google Calendar" description="Sync your studio calendar. Connecting here also connects it for Meetings — it's one shared calendar.">
                    <div className="flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                            <svg className="h-6 w-6 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                            <div>
                                <p className="text-sm font-medium text-neutral-900">Google Calendar</p>
                                {calendar.connected ? (
                                    <p className="text-xs text-emerald-600">Connected{calendar.email ? ` · ${calendar.email}` : ''}</p>
                                ) : (
                                    <p className="text-xs text-neutral-500">Connect to sync your studio calendar across the platform.</p>
                                )}
                            </div>
                        </div>
                        {calendar.connected ? (
                            <button
                                type="button"
                                onClick={async () => (await confirmDialog('Disconnect Google Calendar? It will disconnect everywhere.')) && router.delete(route('google-calendar.disconnect'))}
                                className="btn-secondary px-3 py-1.5 text-xs"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <a href={route('google-calendar.connect', { from: 'projects' })} className="btn-primary px-3 py-1.5 text-xs">Connect</a>
                        )}
                    </div>
                </Section>

                <Section title="Statuses" description="The Kanban columns. Drag order with the arrows; click a swatch to recolour.">
                    <ColorListEditor
                        items={statuses}
                        addLabel="New status"
                        onAdd={(label, color) => router.post(route('project-statuses.store'), { label, color }, opts)}
                        onUpdate={(id, label, color) => router.patch(route('project-statuses.update', id), { label, color }, opts)}
                        onDelete={async (id) => { if (await confirmDialog('Delete this status? Projects in it will become unassigned.')) router.delete(route('project-statuses.destroy', id), opts); }}
                        onReorder={(ordered_ids) => router.post(route('project-statuses.reorder'), { ordered_ids }, opts)}
                    />
                </Section>

                <Section title="Types" description="Colour-coded categories shown across the grid, kanban and calendar.">
                    <ColorListEditor
                        items={types}
                        addLabel="New type"
                        onAdd={(label, color) => router.post(route('project-types.store'), { label, color }, opts)}
                        onUpdate={(id, label, color) => router.patch(route('project-types.update', id), { label, color }, opts)}
                        onDelete={async (id) => { if (await confirmDialog('Delete this type? Projects using it will lose their type.')) router.delete(route('project-types.destroy', id), opts); }}
                        onReorder={(ordered_ids) => router.post(route('project-types.reorder'), { ordered_ids }, opts)}
                    />
                </Section>

                <Section title="Custom fields" description="Extra fields shown in the grid and project details.">
                    <div className="space-y-2">
                        {fields.length === 0 && <p className="text-sm text-neutral-400">No custom fields yet.</p>}
                        {fields.map((f, i) => (
                            <div key={f.id} className="flex items-center gap-2">
                                <div className="flex flex-col">
                                    <button type="button" onClick={() => fieldMove(i, -1)} disabled={i === 0} className="text-neutral-300 hover:text-neutral-600 disabled:opacity-30">
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                                    </button>
                                    <button type="button" onClick={() => fieldMove(i, 1)} disabled={i === fields.length - 1} className="text-neutral-300 hover:text-neutral-600 disabled:opacity-30">
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    defaultValue={f.label}
                                    onBlur={(e) => e.target.value.trim() && e.target.value !== f.label && router.patch(route('project-fields.update', f.id), { label: e.target.value.trim() }, opts)}
                                    className="input flex-1"
                                />
                                <span className="w-24 shrink-0 text-xs capitalize text-neutral-400">{f.type.replace('_', ' ')}</span>
                                <button type="button" onClick={async () => { if (await confirmDialog(`Delete the "${f.label}" field? Existing values are hidden but not removed.`)) router.delete(route('project-fields.destroy', f.id), opts); }} className="text-neutral-300 transition hover:text-red-500" title="Delete">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setShowAddField(true)} className="btn-secondary mt-1">+ Add field</button>
                    </div>
                </Section>

                <Section title="Auto-delete stale leads" description="Automatically move leads to the trash once they've sat in the “Lead” status for too long. Moving a project out of “Lead” resets the clock, so only untouched enquiries are removed.">
                    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
                        <label className="flex items-center gap-3 text-sm text-neutral-700">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={leadEnabled}
                                onClick={() => { const v = !leadEnabled; setLeadEnabled(v); saveLeadSettings({ enabled: v }); }}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${leadEnabled ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${leadEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                            <span className="font-medium">Automatically delete old leads</span>
                        </label>

                        {leadEnabled && (
                            <div className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
                                <div>
                                    <span className="label">Delete after</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        value={leadValue}
                                        onChange={(e) => setLeadValue(Math.max(1, parseInt(e.target.value || '1', 10)))}
                                        onBlur={() => saveLeadSettings({})}
                                        className="input w-24"
                                    />
                                </div>
                                <select
                                    value={leadUnit}
                                    onChange={(e) => { const u = e.target.value as LeadSettings['unit']; setLeadUnit(u); saveLeadSettings({ unit: u }); }}
                                    className="input w-32"
                                >
                                    <option value="days">days</option>
                                    <option value="weeks">weeks</option>
                                    <option value="months">months</option>
                                </select>
                                <span className="pb-2 text-xs text-neutral-400">in the “Lead” status</span>
                            </div>
                        )}

                        <p className="border-t border-neutral-100 pt-3 text-xs text-neutral-400">
                            Deleted projects go to the <Link href={route('projects.trash')} className="font-medium text-neutral-600 underline hover:text-neutral-900">trash</Link> and are kept for 30 days before being permanently removed.
                        </p>
                    </div>
                </Section>
            </div>

            <FieldConfigModal show={showAddField} onClose={() => setShowAddField(false)} />
        </AuthenticatedLayout>
    );
}
