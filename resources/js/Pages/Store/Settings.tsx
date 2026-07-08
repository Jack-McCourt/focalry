import StoreNav from '@/Components/StoreNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface TaxRate { id: number; name: string; rate_bps: number; region: string | null; is_default: boolean; active: boolean }
interface ShippingMethod { id: number; name: string; price_cents: number; is_pickup: boolean; active: boolean; description: string | null }

const bpsToPct = (bps: number) => (bps / 100).toString();
const pctToBps = (pct: string) => Math.round(parseFloat(pct || '0') * 100);

export default function Settings({
    settings,
    tax_rates,
    shipping_methods,
    default_currency,
    stripe_ready,
}: PageProps<{
    settings: { hold_for_review: boolean; review_window_hours: number };
    tax_rates: TaxRate[];
    shipping_methods: ShippingMethod[];
    default_currency: string;
    stripe_ready: boolean;
}>) {
    const [hold, setHold] = useState(settings.hold_for_review);
    const [hours, setHours] = useState(settings.review_window_hours);
    const [saving, setSaving] = useState(false);

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';

    const saveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        router.patch(
            route('store.settings.update'),
            { hold_for_review: hold ? 1 : 0, review_window_hours: hours },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Store</h1>}>
            <Head title="Store · Settings" />
            <StoreNav active="settings" />

            <div className="max-w-3xl space-y-8 px-4 py-6 sm:px-8">
                {!stripe_ready && (
                    <div className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                        Connect Stripe (Settings → payments) to accept store payments online.
                    </div>
                )}

                {/* Review window */}
                <section className="rounded-xl border border-neutral-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-neutral-900">Order review window</h2>
                    <p className="mt-0.5 text-xs text-neutral-400">Hold paid orders before sending them to the lab so you can review them first. Digital downloads are always delivered immediately.</p>
                    <form onSubmit={saveSettings} className="mt-4 space-y-3">
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} className="rounded border-neutral-300" />
                            Hold physical orders for review
                        </label>
                        {hold && (
                            <div className="max-w-[180px]">
                                <span className="label">Hold for (hours)</span>
                                <input type="number" min={0} max={336} className={field} value={hours} onChange={(e) => setHours(parseInt(e.target.value || '0', 10))} />
                            </div>
                        )}
                        <button type="submit" disabled={saving} className="btn-primary">Save</button>
                    </form>
                </section>

                {/* Tax rates */}
                <CrudSection<TaxRate>
                    title="Tax rates"
                    subtitle="Applied automatically at checkout (default rate)."
                    items={tax_rates}
                    columns={(t) => `${t.name} · ${bpsToPct(t.rate_bps)}%${t.region ? ` · ${t.region}` : ''}${t.is_default ? ' · default' : ''}${t.active ? '' : ' · inactive'}`}
                    storeRoute={route('store.tax-rates.store')}
                    updateRoute={(id) => route('store.tax-rates.update', id)}
                    destroyRoute={(id) => route('store.tax-rates.destroy', id)}
                    emptyText="No tax rates. Add one to charge sales tax."
                    addLabel="Add tax rate"
                    renderForm={(form, set) => (
                        <>
                            <Input label="Name" value={form.name ?? ''} onChange={(v) => set('name', v)} placeholder="e.g. Sales tax" />
                            <Input label="Rate (%)" value={form.rate_pct ?? ''} onChange={(v) => set('rate_pct', v)} placeholder="8.75" />
                            <Input label="Region (optional)" value={form.region ?? ''} onChange={(v) => set('region', v)} />
                            <Toggle label="Default rate" checked={!!form.is_default} onChange={(v) => set('is_default', v)} />
                            <Toggle label="Active" checked={form.active ?? true} onChange={(v) => set('active', v)} />
                        </>
                    )}
                    initialForm={(t) => ({
                        name: t?.name ?? '',
                        rate_pct: t ? bpsToPct(t.rate_bps) : '',
                        region: t?.region ?? '',
                        is_default: t?.is_default ?? false,
                        active: t?.active ?? true,
                    })}
                    toPayload={(f) => ({
                        name: f.name,
                        rate_bps: pctToBps(f.rate_pct),
                        region: f.region || null,
                        is_default: f.is_default ? 1 : 0,
                        active: f.active ? 1 : 0,
                    })}
                />

                {/* Shipping methods */}
                <CrudSection<ShippingMethod>
                    title="Shipping methods"
                    subtitle="Offered to clients at checkout for physical items."
                    items={shipping_methods}
                    columns={(m) => `${m.name} · ${m.is_pickup ? 'Pickup' : formatMoney(m.price_cents, default_currency)}${m.active ? '' : ' · inactive'}`}
                    storeRoute={route('store.shipping-methods.store')}
                    updateRoute={(id) => route('store.shipping-methods.update', id)}
                    destroyRoute={(id) => route('store.shipping-methods.destroy', id)}
                    emptyText="No shipping methods. Add one (or a free pickup option)."
                    addLabel="Add shipping method"
                    renderForm={(form, set) => (
                        <>
                            <Input label="Name" value={form.name ?? ''} onChange={(v) => set('name', v)} placeholder="e.g. Standard shipping" />
                            {!form.is_pickup && <Input label="Price" value={form.price ?? ''} onChange={(v) => set('price', v)} placeholder="0.00" />}
                            <Input label="Description (optional)" value={form.description ?? ''} onChange={(v) => set('description', v)} />
                            <Toggle label="Pickup (free, no address)" checked={!!form.is_pickup} onChange={(v) => set('is_pickup', v)} />
                            <Toggle label="Active" checked={form.active ?? true} onChange={(v) => set('active', v)} />
                        </>
                    )}
                    initialForm={(m) => ({
                        name: m?.name ?? '',
                        price: m ? centsToInput(m.price_cents) : '0.00',
                        description: m?.description ?? '',
                        is_pickup: m?.is_pickup ?? false,
                        active: m?.active ?? true,
                    })}
                    toPayload={(f) => ({
                        name: f.name,
                        price_cents: f.is_pickup ? 0 : toCents(f.price),
                        description: f.description || null,
                        is_pickup: f.is_pickup ? 1 : 0,
                        active: f.active ? 1 : 0,
                    })}
                />
            </div>
        </AuthenticatedLayout>
    );
}

// A small reusable add/edit/delete list section for tax rates & shipping methods.
function CrudSection<T extends { id: number }>({
    title, subtitle, items, columns, storeRoute, updateRoute, destroyRoute, emptyText, addLabel,
    renderForm, initialForm, toPayload,
}: {
    title: string;
    subtitle: string;
    items: T[];
    columns: (item: T) => string;
    storeRoute: string;
    updateRoute: (id: number) => string;
    destroyRoute: (id: number) => string;
    emptyText: string;
    addLabel: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderForm: (form: any, set: (k: string, v: any) => void) => React.ReactNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialForm: (item?: T) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toPayload: (form: any) => Record<string, any>;
}) {
    const [editing, setEditing] = useState<T | 'new' | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [form, setForm] = useState<any>({});

    const open = (item?: T) => { setForm(initialForm(item)); setEditing(item ?? 'new'); };
    const set = (k: string, v: unknown) => setForm((f: Record<string, unknown>) => ({ ...f, [k]: v }));

    const save = () => {
        const payload = toPayload(form);
        if (editing === 'new') router.post(storeRoute, payload, { preserveScroll: true, onSuccess: () => setEditing(null) });
        else if (editing) router.patch(updateRoute((editing as T).id), payload, { preserveScroll: true, onSuccess: () => setEditing(null) });
    };
    const del = async (id: number) => {
        if (await confirmDialog('Delete this?')) router.delete(destroyRoute(id), { preserveScroll: true, onSuccess: () => setEditing(null) });
    };

    return (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
                    <p className="mt-0.5 text-xs text-neutral-400">{subtitle}</p>
                </div>
                <button onClick={() => open()} className="btn-secondary text-xs">{addLabel}</button>
            </div>

            <div className="mt-3 divide-y divide-neutral-50">
                {items.length === 0 && <p className="py-4 text-sm text-neutral-400">{emptyText}</p>}
                {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-neutral-700">{columns(item)}</span>
                        <button onClick={() => open(item)} className="text-xs text-neutral-400 hover:text-neutral-700">Edit</button>
                    </div>
                ))}
            </div>

            {editing && (
                <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    {renderForm(form, set)}
                    <div className="flex items-center justify-between pt-1">
                        {editing !== 'new' ? (
                            <button onClick={() => del((editing as T).id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                        ) : <span />}
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancel</button>
                            <button onClick={save} className="btn-primary text-xs">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div>
            <span className="label">{label}</span>
            <input
                className="mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-neutral-300" />
            {label}
        </label>
    );
}
