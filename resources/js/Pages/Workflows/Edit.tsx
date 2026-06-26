import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useRef } from 'react';

// Merge tokens supported by WorkflowEngine::merge(). Friendly label → token.
const MERGE_TOKENS: { label: string; token: string }[] = [
    { label: 'First name', token: '{{client_first_name}}' },
    { label: 'Full name', token: '{{client_name}}' },
    { label: 'Project', token: '{{project_name}}' },
    { label: 'Event date', token: '{{event_date}}' },
    { label: 'Studio name', token: '{{studio_name}}' },
];

/** A row of chips that insert a merge token into the active field at the cursor. */
function TokenBar({ onInsert }: { onInsert: (token: string) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-400">Insert:</span>
            {MERGE_TOKENS.map((t) => (
                <button
                    key={t.token}
                    type="button"
                    // Keep focus/selection in the target field when clicking the chip.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onInsert(t.token)}
                    title={t.token}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement | null, current: string, token: string): { next: string; caret: number } {
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    const caret = start + token.length;
    if (el) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
    return { next, caret };
}

/** Subject + body fields with a shared token bar that inserts into whichever is focused. */
function EmailFields({ subject, body, onChange }: { subject: string; body: string; onChange: (patch: Record<string, string>) => void }) {
    const subjectRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const active = useRef<'subject' | 'body'>('body');

    const insert = (token: string) => {
        const key = active.current;
        const el = key === 'subject' ? subjectRef.current : bodyRef.current;
        const { next } = insertAtCursor(el, key === 'subject' ? subject : body, token);
        onChange({ [key]: next });
    };

    return (
        <div className="space-y-2">
            <input ref={subjectRef} onFocus={() => (active.current = 'subject')} value={subject} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Subject" className="input" />
            <textarea ref={bodyRef} onFocus={() => (active.current = 'body')} value={body} onChange={(e) => onChange({ body: e.target.value })} placeholder="Email body" rows={5} className="input" />
            <TokenBar onInsert={insert} />
        </div>
    );
}

/** A single textarea with a token bar (used for the project note). */
function TokenTextarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const insert = (token: string) => onChange(insertAtCursor(ref.current, value, token).next);

    return (
        <div className="space-y-2">
            <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="input" />
            <TokenBar onInsert={insert} />
        </div>
    );
}

type Config = Record<string, string | number>;
interface Step {
    action: string;
    config: Config;
    schedule_mode: string;
    offset_value: number;
    offset_unit: string;
}
/** Relative date offset for date-field conditions, e.g. "2 weeks after today". */
interface RelativeDate {
    amount: number;
    unit: string;
    anchor: string; // 'after' (future) | 'before' (past), relative to today
}
type ConditionValue = string | RelativeDate;
interface Condition {
    field: string;
    operator: string;
    value: ConditionValue;
}
interface Workflow {
    id: number | null;
    name: string;
    description: string | null;
    trigger: string;
    trigger_status_id: number | null;
    conditions: Condition[];
    condition_match: string;
    is_active: boolean;
    steps: Step[];
}
interface Opt { id: number; name?: string; label?: string }
interface ConditionField { key: string; label: string; kind: string; options?: { label: string; color?: string }[] }

export default function Edit({
    workflow,
    triggers,
    actions,
    schedule_modes,
    offset_units,
    statuses,
    project_types,
    task_templates,
    questionnaire_templates,
    condition_operators,
    valueless_operators,
    condition_fields,
}: PageProps<{
    workflow: Workflow;
    triggers: Record<string, string>;
    actions: Record<string, string>;
    schedule_modes: Record<string, string>;
    offset_units: string[];
    statuses: { id: number; label: string; color: string }[];
    project_types: { id: number; label: string; color: string }[];
    task_templates: Opt[];
    questionnaire_templates: Opt[];
    condition_operators: Record<string, string>;
    valueless_operators: string[];
    condition_fields: ConditionField[];
}>) {
    const form = useForm<Workflow>({
        id: workflow.id,
        name: workflow.name ?? '',
        description: workflow.description ?? '',
        trigger: workflow.trigger ?? 'project_status_changed',
        trigger_status_id: workflow.trigger_status_id,
        conditions: workflow.conditions ?? [],
        condition_match: workflow.condition_match ?? 'all',
        is_active: workflow.is_active ?? true,
        steps: workflow.steps?.length ? workflow.steps : [],
    });

    const isNew = !workflow.id;

    const setStep = (i: number, patch: Partial<Step>) =>
        form.setData('steps', form.data.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    const setConfig = (i: number, patch: Config) =>
        setStep(i, { config: { ...form.data.steps[i].config, ...patch } });

    const addStep = () => form.setData('steps', [...form.data.steps, { action: 'send_email', config: {}, schedule_mode: 'after_trigger', offset_value: 0, offset_unit: 'day' }]);
    const removeStep = (i: number) => form.setData('steps', form.data.steps.filter((_, j) => j !== i));

    const setCondition = (i: number, patch: Partial<Condition>) =>
        form.setData('conditions', form.data.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    const addCondition = () => {
        const first = condition_fields[0];
        form.setData('conditions', [...form.data.conditions, { field: first?.key ?? '', operator: operatorsForKind(first?.kind)[0], value: defaultValueFor(first?.kind) }]);
    };
    const removeCondition = (i: number) =>
        form.setData('conditions', form.data.conditions.filter((_, j) => j !== i));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isNew) form.post(route('workflows.store'));
        else form.patch(route('workflows.update', workflow.id!));
    };

    const del = () => {
        if (workflow.id && confirm('Delete this workflow?')) router.delete(route('workflows.destroy', workflow.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">{isNew ? 'New workflow' : 'Edit workflow'}</h1>
                    {!isNew && <button onClick={del} className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>}
                </div>
            }
        >
            <Head title={isNew ? 'New workflow' : form.data.name} />
            <StudioManagerNav active="workflows" />

            <form onSubmit={submit} className="mx-auto max-w-2xl px-4 sm:px-8 py-8 space-y-6">
                {/* Basics */}
                <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
                    <div>
                        <label className="label mb-1.5">Workflow name</label>
                        <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className="input" placeholder="e.g. New booking welcome sequence" />
                        {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} className="rounded border-neutral-300" />
                        Active
                    </label>
                </div>

                {/* Trigger */}
                <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
                    <h2 className="text-sm font-semibold text-neutral-900">When this happens…</h2>
                    <select value={form.data.trigger} onChange={(e) => form.setData('trigger', e.target.value)} className="input">
                        {Object.entries(triggers).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {form.data.trigger === 'project_status_changed' && (
                        <div>
                            <label className="label mb-1.5">Which status? (leave blank for any)</label>
                            <select value={form.data.trigger_status_id ?? ''} onChange={(e) => form.setData('trigger_status_id', e.target.value ? Number(e.target.value) : null)} className="input">
                                <option value="">Any status</option>
                                {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Conditions */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-900">…only if</h2>
                        {form.data.conditions.length > 1 && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                                <span>Match</span>
                                <select
                                    value={form.data.condition_match}
                                    onChange={(e) => form.setData('condition_match', e.target.value)}
                                    className="input w-auto py-1 text-xs"
                                >
                                    <option value="all">all conditions</option>
                                    <option value="any">any condition</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {form.data.conditions.length === 0 && (
                        <p className="text-sm text-neutral-400">No conditions — runs every time the trigger fires.</p>
                    )}

                    {form.data.conditions.map((cond, i) => (
                        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
                            <ConditionRow
                                condition={cond}
                                fields={condition_fields}
                                operators={condition_operators}
                                valuelessOperators={valueless_operators}
                                offsetUnits={offset_units}
                                statuses={statuses}
                                projectTypes={project_types}
                                onChange={(patch) => setCondition(i, patch)}
                                onRemove={() => removeCondition(i)}
                            />
                        </div>
                    ))}

                    {condition_fields.length > 0 && (
                        <button type="button" onClick={addCondition} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Add condition</button>
                    )}
                </div>

                {/* Steps */}
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-neutral-900">…do these steps</h2>
                    {form.data.steps.map((step, i) => (
                        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">{i + 1}</span>
                                <select value={step.action} onChange={(e) => setStep(i, { action: e.target.value, config: {} })} className="input flex-1">
                                    {Object.entries(actions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                                <button type="button" onClick={() => removeStep(i)} className="text-neutral-300 hover:text-red-500">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <StepConfig step={step} onChange={(patch) => setConfig(i, patch)} statuses={statuses} taskTemplates={task_templates} questionnaireTemplates={questionnaire_templates} />

                            <StepTiming step={step} onChange={(patch) => setStep(i, patch)} scheduleModes={schedule_modes} offsetUnits={offset_units} />
                        </div>
                    ))}
                    <button type="button" onClick={addStep} className="text-sm font-medium text-blue-600 hover:text-blue-800">+ Add step</button>
                </div>

                <div className="flex justify-end gap-2">
                    <button type="submit" disabled={form.processing} className="btn-primary disabled:opacity-40">{isNew ? 'Create workflow' : 'Save changes'}</button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}

function StepTiming({
    step,
    onChange,
    scheduleModes,
    offsetUnits,
}: {
    step: Step;
    onChange: (patch: Partial<Step>) => void;
    scheduleModes: Record<string, string>;
    offsetUnits: string[];
}) {
    const immediate = step.schedule_mode === 'after_trigger' && step.offset_value === 0;
    const unitLabel = (u: string) => (step.offset_value === 1 ? u : `${u}s`);

    return (
        <div className="mt-3 border-t border-neutral-100 pt-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <span>Run</span>
                {!immediate && (
                    <>
                        <input
                            type="number"
                            min={0}
                            value={step.offset_value}
                            onChange={(e) => onChange({ offset_value: Math.max(0, Number(e.target.value)) })}
                            className="input w-20 py-1"
                        />
                        <select value={step.offset_unit} onChange={(e) => onChange({ offset_unit: e.target.value })} className="input w-28 py-1">
                            {offsetUnits.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                        </select>
                    </>
                )}
                <select value={step.schedule_mode} onChange={(e) => onChange({ schedule_mode: e.target.value })} className="input w-auto flex-1 py-1">
                    {Object.entries(scheduleModes).map(([k, v]) => (
                        <option key={k} value={k}>{k === 'after_trigger' ? (immediate ? 'immediately, after the trigger' : 'after the trigger') : v.toLowerCase()}</option>
                    ))}
                </select>
            </div>
            {step.schedule_mode !== 'after_trigger' && (
                <p className="mt-1 text-xs text-neutral-400">If the project has no event date, this step runs immediately.</p>
            )}
            {step.schedule_mode === 'after_trigger' && (
                <p className="mt-1 text-xs text-neutral-400">Set the amount to 0 to run as soon as the trigger fires.</p>
            )}
        </div>
    );
}

function StepConfig({
    step,
    onChange,
    statuses,
    taskTemplates,
    questionnaireTemplates,
}: {
    step: Step;
    onChange: (patch: Config) => void;
    statuses: { id: number; label: string }[];
    taskTemplates: Opt[];
    questionnaireTemplates: Opt[];
}) {
    const c = step.config;

    switch (step.action) {
        case 'send_email':
            return (
                <EmailFields
                    subject={String(c.subject ?? '')}
                    body={String(c.body ?? '')}
                    onChange={onChange}
                />
            );
        case 'create_task':
            return (
                <div className="flex items-center gap-2">
                    <input value={String(c.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} placeholder="Task title" className="input flex-1" />
                    <input type="number" value={Number(c.offset_days ?? 0)} onChange={(e) => onChange({ offset_days: Number(e.target.value) })} className="input w-28" title="Days from event date" />
                </div>
            );
        case 'apply_task_template':
            return (
                <select value={String(c.template_id ?? '')} onChange={(e) => onChange({ template_id: Number(e.target.value) })} className="input">
                    <option value="">Choose a checklist…</option>
                    {taskTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            );
        case 'send_questionnaire':
            return (
                <select value={String(c.template_id ?? '')} onChange={(e) => onChange({ template_id: Number(e.target.value) })} className="input">
                    <option value="">Choose a questionnaire…</option>
                    {questionnaireTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            );
        case 'change_status':
            return (
                <select value={String(c.status_id ?? '')} onChange={(e) => onChange({ status_id: Number(e.target.value) })} className="input">
                    <option value="">Choose a status…</option>
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            );
        case 'create_note':
            return <TokenTextarea value={String(c.body ?? '')} onChange={(v) => onChange({ body: v })} placeholder="Note text" />;
        default:
            return null;
    }
}

// Which operators make sense for each field kind (keys index into condition_operators).
const OPERATORS_BY_KIND: Record<string, string[]> = {
    status: ['equals', 'not_equals', 'is_set', 'is_not_set'],
    type: ['equals', 'not_equals', 'is_set', 'is_not_set'],
    select: ['equals', 'not_equals', 'is_set', 'is_not_set'],
    checkbox: ['equals'],
    date: ['greater_than', 'less_than', 'is_set', 'is_not_set'],
    number: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_set', 'is_not_set'],
};
const DEFAULT_OPERATORS = ['equals', 'not_equals', 'contains', 'is_set', 'is_not_set'];

// For date fields, "greater/less than" read more naturally as after/before.
const DATE_OPERATOR_LABELS: Record<string, string> = { greater_than: 'is after', less_than: 'is before' };

const operatorsForKind = (kind?: string): string[] => OPERATORS_BY_KIND[kind ?? ''] ?? DEFAULT_OPERATORS;

const isRelativeDate = (v: ConditionValue): v is RelativeDate => typeof v === 'object' && v !== null;
const asString = (v: ConditionValue): string => (typeof v === 'string' ? v : '');

/** Sensible starting value when a field (or its kind) changes. */
const defaultValueFor = (kind?: string): ConditionValue =>
    kind === 'date' ? { amount: 2, unit: 'week', anchor: 'future' } : '';

/** A single "field — operator — value" rule. The value picker adapts to the field. */
function ConditionRow({
    condition,
    fields,
    operators,
    valuelessOperators,
    offsetUnits,
    statuses,
    projectTypes,
    onChange,
    onRemove,
}: {
    condition: Condition;
    fields: ConditionField[];
    operators: Record<string, string>;
    valuelessOperators: string[];
    offsetUnits: string[];
    statuses: { id: number; label: string }[];
    projectTypes: { id: number; label: string }[];
    onChange: (patch: Partial<Condition>) => void;
    onRemove: () => void;
}) {
    const field = fields.find((f) => f.key === condition.field);
    const kind = field?.kind;
    const needsValue = !valuelessOperators.includes(condition.operator);
    const allowedOperators = operatorsForKind(kind);

    // When the chosen field changes, keep the operator/value valid for the new kind.
    const onFieldChange = (key: string) => {
        const nextKind = fields.find((f) => f.key === key)?.kind;
        const nextOps = operatorsForKind(nextKind);
        onChange({
            field: key,
            operator: nextOps.includes(condition.operator) ? condition.operator : nextOps[0],
            value: defaultValueFor(nextKind),
        });
    };

    const rel: RelativeDate = isRelativeDate(condition.value) ? condition.value : { amount: 2, unit: 'week', anchor: 'future' };
    const setRel = (patch: Partial<RelativeDate>) => onChange({ value: { ...rel, ...patch } });
    const unitLabel = (u: string) => (rel.amount === 1 ? u : `${u}s`);

    const valueInput = () => {
        switch (kind) {
            case 'status':
                return (
                    <select value={asString(condition.value)} onChange={(e) => onChange({ value: e.target.value })} className="input flex-1">
                        <option value="">Choose…</option>
                        {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                );
            case 'type':
                return (
                    <select value={asString(condition.value)} onChange={(e) => onChange({ value: e.target.value })} className="input flex-1">
                        <option value="">Choose…</option>
                        {projectTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                );
            case 'select':
                return (
                    <select value={asString(condition.value)} onChange={(e) => onChange({ value: e.target.value })} className="input flex-1">
                        <option value="">Choose…</option>
                        {(field?.options ?? []).map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                    </select>
                );
            case 'checkbox':
                return (
                    <select value={asString(condition.value)} onChange={(e) => onChange({ value: e.target.value })} className="input flex-1">
                        <option value="1">Ticked</option>
                        <option value="0">Not ticked</option>
                    </select>
                );
            case 'date':
                return (
                    <>
                        <input type="number" min={0} value={rel.amount} onChange={(e) => setRel({ amount: Math.max(0, Number(e.target.value)) })} className="input w-20" />
                        <select value={rel.unit} onChange={(e) => setRel({ unit: e.target.value })} className="input w-auto">
                            {offsetUnits.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                        </select>
                        <select value={rel.anchor} onChange={(e) => setRel({ anchor: e.target.value })} className="input w-auto">
                            <option value="future">from now</option>
                            <option value="past">ago</option>
                        </select>
                    </>
                );
            case 'number':
                return <input type="number" value={asString(condition.value)} onChange={(e) => onChange({ value: e.target.value })} className="input flex-1" />;
            default:
                return <input value={asString(condition.value)} onChange={(e) => onChange({ value: e.target.value })} placeholder="Value" className="input flex-1" />;
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <select
                value={condition.field}
                onChange={(e) => onFieldChange(e.target.value)}
                className="input w-auto min-w-40 flex-1"
            >
                {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select value={condition.operator} onChange={(e) => onChange({ operator: e.target.value })} className="input w-auto">
                {allowedOperators.map((k) => (
                    <option key={k} value={k}>{(kind === 'date' && DATE_OPERATOR_LABELS[k]) || operators[k]}</option>
                ))}
            </select>
            {needsValue && valueInput()}
            <button type="button" onClick={onRemove} className="ml-auto text-neutral-300 hover:text-red-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    );
}
