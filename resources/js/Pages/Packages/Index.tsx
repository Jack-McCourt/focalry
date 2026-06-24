import Modal from '@/Components/Modal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { CURRENCIES } from '@/lib/currencies';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface Package {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    details: string | null;
    image_url: string | null;
    pricing_type: 'fixed' | 'flexible';
    price_cents: number;
    deposit_cents: number | null;
    min_amount_cents: number | null;
    suggested_amount_cents: number | null;
    currency: string;
    active: boolean;
    sort_order: number;
    bookings_count: number;
    url?: string;
}

interface Booking {
    id: number;
    client_name: string;
    client_email: string;
    package: string | null;
    amount_cents: number;
    currency: string;
    payment_type: string;
    project_id: number | null;
    created_at: string;
}

export default function Index({
    packages,
    bookings,
    default_currency,
    public_url,
    embed_code,
    stripe_ready,
}: PageProps<{
    packages: Package[];
    bookings: Booking[];
    default_currency: string;
    public_url: string;
    embed_code: string;
    stripe_ready: boolean;
}>) {
    const [editing, setEditing] = useState<Package | null>(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const copy = (text: string, which: 'link' | 'embed') => {
        navigator.clipboard.writeText(text);
        setCopied(which);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Payment links</h1>}>
            <Head title="Payment links" />
            <StudioManagerNav active="bookings" />

            <div className="px-4 py-6 sm:px-8">
                {!stripe_ready && (
                    <div className="mb-5 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                        Connect Stripe (Settings → payments) to take payment through your payment links. You can still create them now.
                    </div>
                )}

                {/* Share / embed */}
                <div className="mb-6 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs font-medium text-neutral-500">Your payments page</p>
                        <p className="mt-1 truncate text-sm text-neutral-800">{public_url}</p>
                        <div className="mt-2 flex gap-2">
                            <button onClick={() => copy(public_url, 'link')} className="btn-secondary px-3 py-1.5 text-xs">{copied === 'link' ? 'Copied!' : 'Copy link'}</button>
                            <a href={public_url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">Preview</a>
                        </div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <p className="text-xs font-medium text-neutral-500">Embed on any website</p>
                        <textarea readOnly value={embed_code} rows={2} className="mt-1 block w-full resize-none rounded-md border-neutral-200 bg-neutral-50 font-mono text-[11px] text-neutral-600" />
                        <button onClick={() => copy(embed_code, 'embed')} className="btn-secondary mt-2 px-3 py-1.5 text-xs">{copied === 'embed' ? 'Copied!' : 'Copy embed code'}</button>
                    </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Payment links</h2>
                    <button onClick={() => setCreating(true)} className="btn-primary">New payment link</button>
                </div>

                {packages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No payment links yet</p>
                        <p className="mt-1 text-sm text-neutral-400">Create a payment link clients can pay through.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {packages.map((p) => (
                            <button key={p.id} onClick={() => setEditing(p)} className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-neutral-300 hover:shadow-sm">
                                {p.image_url && <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover" />}
                                <div className="p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-neutral-900">{p.name}</span>
                                        {!p.active && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Hidden</span>}
                                    </div>
                                    <p className="mt-1 text-sm text-neutral-700">{p.pricing_type === 'flexible' ? 'Flexible amount' : `${formatMoney(p.price_cents, p.currency)}${p.deposit_cents ? ` · ${formatMoney(p.deposit_cents, p.currency)} deposit` : ''}`}</p>
                                    <p className="mt-1 text-[11px] text-neutral-400">{p.bookings_count} booking{p.bookings_count === 1 ? '' : 's'}</p>
                                    {p.url && (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(p.url!); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 1500); }}
                                            className="mt-2 inline-block text-[11px] font-medium text-blue-600 hover:underline"
                                        >
                                            {copiedId === p.id ? 'Copied!' : 'Copy link'}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Sales */}
                {bookings.length > 0 && (
                    <div className="mt-8">
                        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Recent payments</h2>
                        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                            {bookings.map((b) => (
                                <div key={b.id} className="flex items-center justify-between gap-3 border-b border-neutral-50 px-4 py-2.5 text-sm last:border-0">
                                    <div className="min-w-0">
                                        <span className="font-medium text-neutral-900">{b.client_name}</span>
                                        <span className="text-neutral-400"> · {b.package ?? 'Payment link'}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <span className="text-neutral-700">{formatMoney(b.amount_cents, b.currency)}{b.payment_type === 'deposit' ? ' deposit' : ''}</span>
                                        {b.project_id && <a href={`/projects?open=${b.project_id}`} className="text-xs text-blue-600 hover:underline">Project</a>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {creating && <PackageModal onClose={() => setCreating(false)} defaultCurrency={default_currency} />}
            {editing && <PackageModal onClose={() => setEditing(null)} pkg={editing} defaultCurrency={default_currency} />}
        </AuthenticatedLayout>
    );
}

function PackageModal({ onClose, pkg, defaultCurrency }: { onClose: () => void; pkg?: Package; defaultCurrency: string }) {
    const isEdit = !!pkg;
    const { data, setData, post, processing, errors, transform } = useForm<{
        _method?: string;
        name: string;
        description: string;
        details: string;
        pricing_type: 'fixed' | 'flexible';
        price: string;
        deposit: string;
        min: string;
        suggested: string;
        currency: string;
        active: boolean;
        image: File | null;
    }>({
        _method: isEdit ? 'patch' : undefined,
        name: pkg?.name ?? '',
        description: pkg?.description ?? '',
        details: pkg?.details ?? '',
        pricing_type: pkg?.pricing_type ?? 'fixed',
        price: pkg ? centsToInput(pkg.price_cents) : '0.00',
        deposit: pkg?.deposit_cents ? centsToInput(pkg.deposit_cents) : '',
        min: pkg?.min_amount_cents ? centsToInput(pkg.min_amount_cents) : '',
        suggested: pkg?.suggested_amount_cents ? centsToInput(pkg.suggested_amount_cents) : '',
        currency: pkg?.currency ?? defaultCurrency,
        active: pkg?.active ?? true,
        image: null,
    });

    const flexible = data.pricing_type === 'flexible';

    transform((d) => ({
        ...d,
        active: d.active ? 1 : 0,
        price_cents: d.pricing_type === 'flexible' ? null : toCents(d.price),
        deposit_cents: d.pricing_type === 'flexible' || d.deposit.trim() === '' ? null : toCents(d.deposit),
        min_amount_cents: d.pricing_type === 'flexible' && d.min.trim() !== '' ? toCents(d.min) : null,
        suggested_amount_cents: d.pricing_type === 'flexible' && d.suggested.trim() !== '' ? toCents(d.suggested) : null,
    }));

    // Server-side errors are keyed by the transformed names (price_cents, etc.).
    const fieldErrors = errors as Record<string, string>;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        // Use POST + _method for multipart on both create and edit.
        post(isEdit ? route('packages.update', pkg!.id) : route('packages.store'), {
            forceFormData: true,
            onSuccess: onClose,
        });
    };

    const del = () => {
        if (confirm('Delete this payment link? Existing payments are kept.')) {
            router.delete(route('packages.destroy', pkg!.id), { onSuccess: onClose });
        }
    };

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">{isEdit ? 'Edit payment link' : 'New payment link'}</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>

                <div>
                    <span className="label">Name</span>
                    <input className={field} value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Half-day wedding" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

                <div>
                    <span className="label">Short description</span>
                    <textarea className={field} rows={2} value={data.description} onChange={(e) => setData('description', e.target.value)} />
                </div>

                <div>
                    <span className="label">What's included</span>
                    <textarea className={field} rows={3} value={data.details} onChange={(e) => setData('details', e.target.value)} placeholder="One line per item" />
                </div>

                <div>
                    <span className="label">Payment type</span>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                        {([['fixed', 'Fixed price', 'A set amount (with optional deposit)'], ['flexible', 'Flexible', 'Customer chooses the amount — a tip jar']] as const).map(([key, title, sub]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setData('pricing_type', key)}
                                className={`rounded-lg border p-3 text-left transition ${data.pricing_type === key ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-400'}`}
                            >
                                <span className="block text-sm font-medium text-neutral-900">{title}</span>
                                <span className="mt-0.5 block text-xs text-neutral-500">{sub}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {flexible ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="label">Minimum (optional)</span>
                            <input className={field} value={data.min} onChange={(e) => setData('min', e.target.value)} placeholder="—" />
                            {fieldErrors.min_amount_cents && <p className="mt-1 text-xs text-red-600">{fieldErrors.min_amount_cents}</p>}
                        </div>
                        <div>
                            <span className="label">Currency</span>
                            <select className={field} value={data.currency} onChange={(e) => setData('currency', e.target.value)}>
                                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <span className="label">Price</span>
                            <input className={field} value={data.price} onChange={(e) => setData('price', e.target.value)} placeholder="0.00" />
                            {fieldErrors.price_cents && <p className="mt-1 text-xs text-red-600">{fieldErrors.price_cents}</p>}
                        </div>
                        <div>
                            <span className="label">Deposit (optional)</span>
                            <input className={field} value={data.deposit} onChange={(e) => setData('deposit', e.target.value)} placeholder="—" />
                            {fieldErrors.deposit_cents && <p className="mt-1 text-xs text-red-600">{fieldErrors.deposit_cents}</p>}
                        </div>
                        <div>
                            <span className="label">Currency</span>
                            <select className={field} value={data.currency} onChange={(e) => setData('currency', e.target.value)}>
                                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div>
                    <span className="label">Image</span>
                    {pkg?.image_url && !data.image && <img src={pkg.image_url} alt="" className="mt-1 h-24 rounded-md object-cover" />}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setData('image', e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm" />
                    {errors.image && <p className="mt-1 text-xs text-red-600">{errors.image}</p>}
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={data.active} onChange={(e) => setData('active', e.target.checked)} className="rounded border-neutral-300" />
                    Active (shown on your payments page)
                </label>

                <div className="flex items-center justify-between pt-2">
                    {isEdit ? <button type="button" onClick={del} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button> : <span />}
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save'}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
