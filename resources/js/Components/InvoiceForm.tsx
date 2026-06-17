import SearchSelect from '@/Components/SearchSelect';
import { formatMoney, centsToInput, currencySymbol, toCents } from '@/lib/money';
import { useEffect, useRef, useState } from 'react';

export interface InvoiceItemInput {
    description: string;
    quantity: number | string;
    unit_amount_cents: number;
}

export interface ScheduleInput {
    amount_cents: number;
    due_date: string;
}

export type PaymentMethod = 'card' | 'bank_transfer';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
    { value: 'card', label: 'Card (online)', hint: 'Client pays by card via Stripe' },
    { value: 'bank_transfer', label: 'Bank transfer', hint: 'Show your bank details on the invoice' },
];

export interface InvoiceFormData {
    project_id: number | null;
    number: string;
    currency: string;
    issue_date: string;
    due_date: string;
    discount_cents: number;
    tax_rate: number | string;
    notes: string;
    payment_methods: PaymentMethod[];
    items: InvoiceItemInput[];
    schedules: ScheduleInput[];
    reminder_offsets: number[];
}

export function blankItem(): InvoiceItemInput {
    return { description: '', quantity: 1, unit_amount_cents: 0 };
}

export const REMINDER_OPTIONS: { offset: number; label: string }[] = [
    { offset: -7, label: '7 days before' },
    { offset: -3, label: '3 days before' },
    { offset: 0, label: 'On the due date' },
    { offset: 3, label: '3 days after' },
    { offset: 7, label: '7 days after' },
];

function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Dates spaced evenly from today to the due date (final one lands on the due date). */
export function spacedDates(count: number, dueDate: string): string[] {
    const n = Math.max(1, Math.min(24, Math.floor(count) || 1));
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    let end: Date;
    if (dueDate) {
        end = new Date(`${dueDate}T00:00:00`);
    } else {
        end = new Date(start);
        end.setDate(end.getDate() + 30 * Math.max(1, n - 1));
    }
    if (end.getTime() < start.getTime()) end = start;

    return Array.from({ length: n }, (_, i) => {
        const d = n === 1 ? end : new Date(start.getTime() + (end.getTime() - start.getTime()) * (i / (n - 1)));
        return toISODate(d);
    });
}

/** Equal-amount instalments (rounding remainder on the first) with spaced dates. */
export function generateSchedule(totalCents: number, count: number, dueDate: string): ScheduleInput[] {
    const n = Math.max(1, Math.min(24, Math.floor(count) || 1));
    const base = Math.floor(totalCents / n);
    const remainder = totalCents - base * n;
    const dates = spacedDates(n, dueDate);

    return Array.from({ length: n }, (_, i) => ({
        amount_cents: base + (i === 0 ? remainder : 0),
        due_date: dates[i],
    }));
}

export function computeTotals(data: InvoiceFormData) {
    const subtotal = data.items.reduce(
        (sum, it) => sum + Math.round((parseFloat(String(it.quantity)) || 0) * (it.unit_amount_cents || 0)),
        0,
    );
    const discount = Math.min(data.discount_cents || 0, subtotal);
    const taxable = subtotal - discount;
    const tax = Math.round((taxable * (parseFloat(String(data.tax_rate)) || 0)) / 100);
    return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export default function InvoiceForm({
    data,
    setData,
    errors,
    projects,
}: {
    data: InvoiceFormData;
    setData: <K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) => void;
    errors: Partial<Record<string, string>>;
    projects: { id: number; name: string }[];
}) {
    const totals = computeTotals(data);
    const symbol = currencySymbol(data.currency);
    const [splitCount, setSplitCount] = useState(data.schedules.length || 3);

    const scheduleEnabled = data.schedules.length > 0;
    const scheduledTotal = data.schedules.reduce((sum, r) => sum + (r.amount_cents || 0), 0);
    const scheduleDiff = scheduledTotal - totals.total;

    const updateSchedule = (i: number, patch: Partial<ScheduleInput>) =>
        setData('schedules', data.schedules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    const addSchedule = () => setData('schedules', [...data.schedules, { amount_cents: 0, due_date: '' }]);
    const removeSchedule = (i: number) => setData('schedules', data.schedules.filter((_, idx) => idx !== i));

    // Changing the number of payments re-splits equally and re-spaces dates.
    const setPaymentCount = (n: number) => {
        const count = Math.max(1, Math.min(24, n || 1));
        setSplitCount(count);
        setData('schedules', generateSchedule(totals.total, count, data.due_date));
    };

    // Edit a row's percentage → set its amount, then redistribute the remainder
    // across the other instalments (keeping their proportions) so the split sums to 100%.
    const setSchedulePercent = (i: number, pct: number) => {
        const total = totals.total;
        const rows = data.schedules;
        if (rows.length === 1) {
            updateSchedule(0, { amount_cents: total });
            return;
        }
        const rowAmt = Math.max(0, Math.min(total, Math.round((Math.max(0, Math.min(100, pct)) / 100) * total)));
        const remainder = total - rowAmt;
        const others = rows.map((_, idx) => idx).filter((idx) => idx !== i);
        const othersSum = others.reduce((s, idx) => s + rows[idx].amount_cents, 0);

        const next = rows.map((r) => ({ ...r }));
        next[i].amount_cents = rowAmt;
        let allocated = 0;
        others.forEach((idx, k) => {
            const amt = k === others.length - 1
                ? remainder - allocated
                : othersSum > 0
                    ? Math.round((rows[idx].amount_cents / othersSum) * remainder)
                    : Math.round(remainder / others.length);
            allocated += amt;
            next[idx].amount_cents = Math.max(0, amt);
        });
        setData('schedules', next);
    };

    // Auto: when the invoice total changes, rescale instalments proportionally
    // (preserves overrides as percentages) so they always sum to the new total.
    const prevTotal = useRef(totals.total);
    useEffect(() => {
        const old = prevTotal.current;
        prevTotal.current = totals.total;
        if (!scheduleEnabled || old === totals.total) return;
        const sum = data.schedules.reduce((s, r) => s + r.amount_cents, 0) || old || 1;
        let allocated = 0;
        const next = data.schedules.map((r, i) => {
            const amt = i === data.schedules.length - 1
                ? totals.total - allocated
                : Math.round((r.amount_cents / sum) * totals.total);
            allocated += amt;
            return { ...r, amount_cents: Math.max(0, amt) };
        });
        setData('schedules', next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totals.total]);

    // Auto: when the due date changes, re-space the instalment dates.
    const prevDue = useRef(data.due_date);
    useEffect(() => {
        const old = prevDue.current;
        prevDue.current = data.due_date;
        if (!scheduleEnabled || old === data.due_date) return;
        const dates = spacedDates(data.schedules.length, data.due_date);
        setData('schedules', data.schedules.map((r, i) => ({ ...r, due_date: dates[i] })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.due_date]);

    const toggleMethod = (m: PaymentMethod) =>
        setData(
            'payment_methods',
            data.payment_methods.includes(m)
                ? data.payment_methods.filter((x) => x !== m)
                : [...data.payment_methods, m],
        );

    const toggleReminder = (offset: number) =>
        setData(
            'reminder_offsets',
            data.reminder_offsets.includes(offset)
                ? data.reminder_offsets.filter((o) => o !== offset)
                : [...data.reminder_offsets, offset],
        );

    const updateItem = (index: number, patch: Partial<InvoiceItemInput>) => {
        setData(
            'items',
            data.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
        );
    };

    const removeItem = (index: number) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-8">
            {/* Header fields */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label mb-1.5">Invoice number</label>
                    <input
                        type="text"
                        value={data.number}
                        onChange={(e) => setData('number', e.target.value)}
                        className="input font-mono"
                    />
                    {errors.number && <p className="mt-1 text-xs text-red-600">{errors.number}</p>}
                </div>
                <div>
                    <label className="label mb-1.5">Project</label>
                    <SearchSelect
                        options={projects}
                        value={data.project_id}
                        onChange={(id) => setData('project_id', id)}
                        placeholder="Search projects…"
                        emptyText="No projects found"
                    />
                    {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
                    <p className="mt-1 text-xs text-neutral-400">The client is taken from the project.</p>
                </div>
                <div>
                    <label className="label mb-1.5">Issue date</label>
                    <input type="date" value={data.issue_date} onChange={(e) => setData('issue_date', e.target.value)} className="input" />
                </div>
                <div>
                    <label className="label mb-1.5">Due date</label>
                    <input type="date" value={data.due_date} onChange={(e) => setData('due_date', e.target.value)} className="input" />
                    <p className="mt-1 text-xs text-neutral-400">Split payments are spaced up to this date.</p>
                </div>
            </div>

            {/* Line items */}
            <div>
                <label className="label mb-2">Line items</label>
                <div className="space-y-2">
                    {data.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateItem(i, { description: e.target.value })}
                                    placeholder="Description"
                                    className="input w-full"
                                />
                                {errors[`items.${i}.description`] && (
                                    <p className="mt-1 text-xs text-red-600">{errors[`items.${i}.description`]}</p>
                                )}
                            </div>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                                placeholder="Qty"
                                className="input w-20 text-right"
                            />
                            <div className="relative w-32">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{symbol}</span>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    defaultValue={centsToInput(item.unit_amount_cents)}
                                    onChange={(e) => updateItem(i, { unit_amount_cents: toCents(e.target.value) })}
                                    placeholder="0.00"
                                    className="input pl-6 text-right"
                                />
                            </div>
                            <div className="w-24 py-2 text-right text-sm text-neutral-600">
                                {formatMoney(Math.round((parseFloat(String(item.quantity)) || 0) * item.unit_amount_cents), data.currency)}
                            </div>
                            <button
                                type="button"
                                onClick={() => removeItem(i)}
                                className="mt-2 text-neutral-300 transition hover:text-red-500"
                                title="Remove line"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setData('items', [...data.items, blankItem()])}
                    className="mt-3 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                    + Add line item
                </button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between text-neutral-500">
                        <span>Subtotal</span>
                        <span>{formatMoney(totals.subtotal, data.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Discount</span>
                        <div className="relative w-28">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{symbol}</span>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                defaultValue={centsToInput(data.discount_cents)}
                                onChange={(e) => setData('discount_cents', toCents(e.target.value))}
                                className="input pl-6 py-1 text-right"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Tax rate</span>
                        <div className="relative w-28">
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={data.tax_rate}
                                onChange={(e) => setData('tax_rate', e.target.value)}
                                className="input pr-6 py-1 text-right"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                        <span>Tax</span>
                        <span>{formatMoney(totals.tax, data.currency)}</span>
                    </div>
                    <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-neutral-900">
                        <span>Total</span>
                        <span>{formatMoney(totals.total, data.currency)}</span>
                    </div>
                </div>
            </div>

            {/* Payment methods */}
            <div className="border-t border-neutral-100 pt-6">
                <p className="text-sm font-medium text-neutral-800">Payment methods</p>
                <p className="text-xs text-neutral-500">How the client can pay this invoice. Defaults come from your invoice settings.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {PAYMENT_METHOD_OPTIONS.map((opt) => {
                        const on = data.payment_methods.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleMethod(opt.value)}
                                title={opt.hint}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Payment schedule (split payments) */}
            <div className="border-t border-neutral-100 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-neutral-800">Split into multiple payments</p>
                        <p className="text-xs text-neutral-500">Spread the total over scheduled instalments.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => (scheduleEnabled ? setData('schedules', []) : setData('schedules', generateSchedule(totals.total, splitCount, data.due_date)))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${scheduleEnabled ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${scheduleEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>

                {scheduleEnabled && (
                    <div className="mt-4 space-y-3">
                        <div>
                            <label className="label mb-1.5">Number of payments</label>
                            <input
                                type="number"
                                min={1}
                                max={24}
                                value={splitCount}
                                onChange={(e) => setPaymentCount(Number(e.target.value))}
                                className="input w-28"
                            />
                            <p className="mt-1 text-xs text-neutral-400">Amounts &amp; dates update automatically with the total and due date.</p>
                        </div>

                        <div className="space-y-2">
                            {data.schedules.map((row, i) => {
                                const pct = totals.total > 0 ? (row.amount_cents / totals.total) * 100 : 0;
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="w-20 text-xs text-neutral-400">Payment {i + 1}</span>
                                        <div className="relative w-24">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.1"
                                                value={Number(pct.toFixed(1))}
                                                onChange={(e) => setSchedulePercent(i, Number(e.target.value))}
                                                className="input pr-6 text-right"
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
                                        </div>
                                        <div className="relative w-32">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">{symbol}</span>
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={centsToInput(row.amount_cents)}
                                                onChange={(e) => updateSchedule(i, { amount_cents: toCents(e.target.value) })}
                                                className="input pl-6 text-right"
                                            />
                                        </div>
                                        <input
                                            type="date"
                                            value={row.due_date}
                                            onChange={(e) => updateSchedule(i, { due_date: e.target.value })}
                                            className="input flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeSchedule(i)}
                                            className="text-neutral-300 transition hover:text-red-500"
                                            title="Remove payment"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between">
                            <button type="button" onClick={addSchedule} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
                                + Add payment
                            </button>
                            {scheduleDiff !== 0 && (
                                <p className="text-xs text-amber-600">
                                    Scheduled {formatMoney(scheduledTotal, data.currency)} — {scheduleDiff > 0 ? 'over' : 'under'} invoice total by {formatMoney(Math.abs(scheduleDiff), data.currency)}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Payment reminders */}
            <div className="border-t border-neutral-100 pt-6">
                <p className="text-sm font-medium text-neutral-800">Automatic payment reminders</p>
                <p className="text-xs text-neutral-500">Emailed to the client relative to each payment's due date.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {REMINDER_OPTIONS.map((opt) => {
                        const on = data.reminder_offsets.includes(opt.offset);
                        return (
                            <button
                                key={opt.offset}
                                type="button"
                                onClick={() => toggleReminder(opt.offset)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Notes */}
            <div>
                <label className="label mb-1.5">Notes</label>
                <textarea
                    value={data.notes}
                    onChange={(e) => setData('notes', e.target.value)}
                    rows={3}
                    placeholder="Payment terms, thank-you note, etc."
                    className="input"
                />
            </div>
        </div>
    );
}
