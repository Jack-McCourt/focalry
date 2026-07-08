import Modal from '@/Components/Modal';
import StoreNav from '@/Components/StoreNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { CURRENCIES } from '@/lib/currencies';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface Coupon {
    id: number;
    code: string;
    type: string;
    value: number;
    currency: string;
    min_subtotal_cents: number | null;
    max_redemptions: number | null;
    redeemed_count: number;
    active: boolean;
    show_banner: boolean;
    banner_text: string | null;
    starts_at: string | null;
    expires_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
    percent: '% off',
    fixed: 'Amount off',
    free_shipping: 'Free shipping',
    free_giveaway: 'Free item',
};

function describe(c: Coupon) {
    if (c.type === 'percent') return `${c.value}% off`;
    if (c.type === 'fixed') return `${formatMoney(c.value, c.currency)} off`;
    return TYPE_LABELS[c.type];
}

export default function Coupons({
    coupons,
    default_currency,
}: PageProps<{ coupons: Coupon[]; default_currency: string }>) {
    const [editing, setEditing] = useState<Coupon | null>(null);
    const [creating, setCreating] = useState(false);

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Store</h1>}>
            <Head title="Store · Coupons" />
            <StoreNav active="coupons" />

            <div className="px-4 py-8 sm:px-8">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Coupons</h2>
                    <button onClick={() => setCreating(true)} className="btn-primary">New coupon</button>
                </div>

                {coupons.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No coupons yet</p>
                        <p className="mt-1 text-sm text-neutral-400">Offer clients a discount or free shipping in their gallery.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {coupons.map((c) => (
                            <button key={c.id} onClick={() => setEditing(c)} className="flex w-full items-center justify-between gap-3 border-b border-neutral-50 px-4 py-3 text-left hover:bg-neutral-50 last:border-0">
                                <div>
                                    <span className="font-mono text-sm font-semibold text-neutral-900">{c.code}</span>
                                    {!c.active && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Inactive</span>}
                                    {c.show_banner && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand">Banner</span>}
                                    <p className="text-[11px] text-neutral-400">{describe(c)} · {c.redeemed_count}{c.max_redemptions ? `/${c.max_redemptions}` : ''} used</p>
                                </div>
                                <span className="text-xs text-neutral-400">{c.expires_at ? `Expires ${c.expires_at}` : 'No expiry'}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {creating && <CouponModal onClose={() => setCreating(false)} defaultCurrency={default_currency} />}
            {editing && <CouponModal onClose={() => setEditing(null)} coupon={editing} defaultCurrency={default_currency} />}
        </AuthenticatedLayout>
    );
}

function CouponModal({ onClose, coupon, defaultCurrency }: { onClose: () => void; coupon?: Coupon; defaultCurrency: string }) {
    const isEdit = !!coupon;
    const { data, setData, processing, errors } = useForm({
        code: coupon?.code ?? '',
        type: coupon?.type ?? 'percent',
        value: coupon ? (coupon.type === 'fixed' ? centsToInput(coupon.value) : String(coupon.value)) : '10',
        currency: coupon?.currency ?? defaultCurrency,
        min_subtotal: coupon?.min_subtotal_cents != null ? centsToInput(coupon.min_subtotal_cents) : '',
        max_redemptions: coupon?.max_redemptions != null ? String(coupon.max_redemptions) : '',
        active: coupon?.active ?? true,
        show_banner: coupon?.show_banner ?? false,
        banner_text: coupon?.banner_text ?? '',
        starts_at: coupon?.starts_at ?? '',
        expires_at: coupon?.expires_at ?? '',
    });
    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';
    const needsValue = data.type === 'percent' || data.type === 'fixed';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            code: data.code,
            type: data.type,
            value: data.type === 'fixed' ? toCents(data.value) : (data.type === 'percent' ? parseInt(data.value || '0', 10) : 0),
            currency: data.currency,
            min_subtotal_cents: data.min_subtotal.trim() === '' ? null : toCents(data.min_subtotal),
            max_redemptions: data.max_redemptions.trim() === '' ? null : parseInt(data.max_redemptions, 10),
            active: data.active ? 1 : 0,
            show_banner: data.show_banner ? 1 : 0,
            banner_text: data.banner_text,
            starts_at: data.starts_at || null,
            expires_at: data.expires_at || null,
        };
        if (isEdit) router.patch(route('store.coupons.update', coupon!.id), payload, { onSuccess: onClose });
        else router.post(route('store.coupons.store'), payload, { onSuccess: onClose });
    };
    const del = async () => {
        if (await confirmDialog('Delete this coupon?')) router.delete(route('store.coupons.destroy', coupon!.id), { onSuccess: onClose });
    };

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="space-y-4 p-6">
                <h2 className="text-sm font-semibold text-neutral-900">{isEdit ? 'Edit coupon' : 'New coupon'}</h2>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Code</span>
                        <input className={`${field} font-mono uppercase`} value={data.code} onChange={(e) => setData('code', e.target.value.toUpperCase())} placeholder="SAVE10" />
                        {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
                    </div>
                    <div>
                        <span className="label">Type</span>
                        <select className={field} value={data.type} onChange={(e) => setData('type', e.target.value)}>
                            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                </div>

                {needsValue && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="label">{data.type === 'percent' ? 'Percent off' : 'Amount off'}</span>
                            <input className={field} value={data.value} onChange={(e) => setData('value', e.target.value)} placeholder={data.type === 'percent' ? '10' : '0.00'} />
                        </div>
                        {data.type === 'fixed' && (
                            <div>
                                <span className="label">Currency</span>
                                <select className={field} value={data.currency} onChange={(e) => setData('currency', e.target.value)}>
                                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Min. order (optional)</span>
                        <input className={field} value={data.min_subtotal} onChange={(e) => setData('min_subtotal', e.target.value)} placeholder="—" />
                    </div>
                    <div>
                        <span className="label">Max redemptions (optional)</span>
                        <input className={field} value={data.max_redemptions} onChange={(e) => setData('max_redemptions', e.target.value)} placeholder="—" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Starts (optional)</span>
                        <input type="date" className={field} value={data.starts_at ?? ''} onChange={(e) => setData('starts_at', e.target.value)} />
                    </div>
                    <div>
                        <span className="label">Expires (optional)</span>
                        <input type="date" className={field} value={data.expires_at ?? ''} onChange={(e) => setData('expires_at', e.target.value)} />
                    </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={data.show_banner} onChange={(e) => setData('show_banner', e.target.checked)} className="rounded border-neutral-300" />
                    Show a banner in the gallery
                </label>
                {data.show_banner && (
                    <input className={field} value={data.banner_text} onChange={(e) => setData('banner_text', e.target.value)} placeholder="e.g. Save 10% with code SAVE10" />
                )}

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={data.active} onChange={(e) => setData('active', e.target.checked)} className="rounded border-neutral-300" />
                    Active
                </label>

                <div className="flex items-center justify-between pt-2">
                    {isEdit ? <button type="button" onClick={del} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button> : <span />}
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={processing} className="btn-primary">Save</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
