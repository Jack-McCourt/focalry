import Modal from '@/Components/Modal';
import StoreNav from '@/Components/StoreNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { CURRENCIES } from '@/lib/currencies';
import { formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface GiftCard {
    id: number;
    code: string;
    initial_cents: number;
    balance_cents: number;
    currency: string;
    recipient_email: string | null;
    note: string | null;
    active: boolean;
    expires_at: string | null;
}

export default function GiftCards({
    gift_cards,
    default_currency,
}: PageProps<{ gift_cards: GiftCard[]; default_currency: string }>) {
    const [creating, setCreating] = useState(false);

    const toggle = (g: GiftCard) =>
        router.patch(route('store.gift-cards.update', g.id), { active: g.active ? 0 : 1 }, { preserveScroll: true });

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Store</h1>}>
            <Head title="Store · Gift cards" />
            <StoreNav active="gift-cards" />

            <div className="px-4 py-8 sm:px-8">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Gift cards &amp; print credits</h2>
                    <button onClick={() => setCreating(true)} className="btn-primary">Issue gift card</button>
                </div>

                {gift_cards.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No gift cards yet</p>
                        <p className="mt-1 text-sm text-neutral-400">Issue store credit clients can redeem at checkout.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {gift_cards.map((g) => (
                            <div key={g.id} className="flex items-center justify-between gap-3 border-b border-neutral-50 px-4 py-3 last:border-0">
                                <div>
                                    <span className="font-mono text-sm font-semibold text-neutral-900">{g.code}</span>
                                    {!g.active && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Disabled</span>}
                                    <p className="text-[11px] text-neutral-400">
                                        {g.recipient_email ?? 'No recipient'}{g.expires_at ? ` · expires ${g.expires_at}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="text-right">
                                        <p className="font-medium text-neutral-900">{formatMoney(g.balance_cents, g.currency)}</p>
                                        <p className="text-[11px] text-neutral-400">of {formatMoney(g.initial_cents, g.currency)}</p>
                                    </div>
                                    <button onClick={() => toggle(g)} className="text-xs text-neutral-400 hover:text-neutral-700">
                                        {g.active ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {creating && <GiftCardModal onClose={() => setCreating(false)} defaultCurrency={default_currency} />}
        </AuthenticatedLayout>
    );
}

function GiftCardModal({ onClose, defaultCurrency }: { onClose: () => void; defaultCurrency: string }) {
    const { data, setData, processing, errors, transform, post } = useForm({
        amount: '50.00',
        currency: defaultCurrency,
        recipient_email: '',
        note: '',
        expires_at: '',
    });
    transform((d) => ({
        initial_cents: toCents(d.amount),
        currency: d.currency,
        recipient_email: d.recipient_email || null,
        note: d.note || null,
        expires_at: d.expires_at || null,
    }));
    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('store.gift-cards.store'), { onSuccess: onClose });
    };

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="space-y-4 p-6">
                <h2 className="text-sm font-semibold text-neutral-900">Issue gift card</h2>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Amount</span>
                        <input className={field} value={data.amount} onChange={(e) => setData('amount', e.target.value)} placeholder="50.00" />
                        {(errors as Record<string, string>).initial_cents && <p className="mt-1 text-xs text-red-600">{(errors as Record<string, string>).initial_cents}</p>}
                    </div>
                    <div>
                        <span className="label">Currency</span>
                        <select className={field} value={data.currency} onChange={(e) => setData('currency', e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <span className="label">Recipient email (optional)</span>
                    <input className={field} value={data.recipient_email} onChange={(e) => setData('recipient_email', e.target.value)} />
                </div>
                <div>
                    <span className="label">Note (optional)</span>
                    <input className={field} value={data.note} onChange={(e) => setData('note', e.target.value)} />
                </div>
                <div>
                    <span className="label">Expires (optional)</span>
                    <input type="date" className={field} value={data.expires_at} onChange={(e) => setData('expires_at', e.target.value)} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={processing} className="btn-primary">Issue</button>
                </div>
            </form>
        </Modal>
    );
}
