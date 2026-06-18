import BookingsSubNav from '@/Components/BookingsSubNav';
import Modal from '@/Components/Modal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { CURRENCIES } from '@/lib/currencies';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface SessionType {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
    currency: string;
    location_type: 'in_person' | 'phone' | 'video';
    location: string | null;
    color: string | null;
    buffer_minutes: number;
    min_lead_hours: number;
    max_per_day: number | null;
    manual_approve: boolean;
    active: boolean;
    bookings_count: number;
}

const LOCATION_LABELS: Record<string, string> = {
    in_person: 'In person',
    phone: 'Phone call',
    video: 'Video call',
};

export default function SessionTypes({
    sessionTypes,
    default_currency,
    booking_base_url,
}: PageProps<{ sessionTypes: SessionType[]; default_currency: string; booking_base_url: string }>) {
    const [editing, setEditing] = useState<SessionType | null>(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyUrl = () => {
        navigator.clipboard.writeText(booking_base_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Bookings</h1>}>
            <Head title="Session types" />
            <StudioManagerNav active="bookings" />
            <BookingsSubNav active="session-types" />

            <div className="px-4 py-6 sm:px-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-500">Your public booking page</p>
                        <p className="truncate text-sm text-neutral-800">{booking_base_url}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={copyUrl} className="btn-secondary px-3 py-1.5 text-xs">{copied ? 'Copied!' : 'Copy link'}</button>
                        <a href={booking_base_url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">Preview</a>
                    </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Session types</h2>
                    <button onClick={() => setCreating(true)} className="btn-primary">New session type</button>
                </div>

                {sessionTypes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No session types yet</p>
                        <p className="mt-1 text-sm text-neutral-400">Create one so clients can book it on your page.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sessionTypes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setEditing(t)}
                                className="rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:shadow-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color ?? '#a3a3a3' }} />
                                    <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                                    {!t.active && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Hidden</span>}
                                </div>
                                <p className="mt-1 text-xs text-neutral-500">
                                    {t.duration_minutes} min · {LOCATION_LABELS[t.location_type]}
                                    {t.price_cents > 0 ? ` · ${formatMoney(t.price_cents, t.currency)}` : ' · Free'}
                                </p>
                                <p className="mt-2 text-[11px] text-neutral-400">
                                    {t.bookings_count} booking{t.bookings_count === 1 ? '' : 's'}
                                    {t.manual_approve ? ' · Manual approval' : ''}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {creating && <SessionTypeModal onClose={() => setCreating(false)} defaultCurrency={default_currency} />}
            {editing && <SessionTypeModal onClose={() => setEditing(null)} sessionType={editing} defaultCurrency={default_currency} />}
        </AuthenticatedLayout>
    );
}

function SessionTypeModal({
    onClose,
    sessionType,
    defaultCurrency,
}: {
    onClose: () => void;
    sessionType?: SessionType;
    defaultCurrency: string;
}) {
    const isEdit = !!sessionType;
    const { data, setData, post, patch, processing, errors, transform } = useForm({
        name: sessionType?.name ?? '',
        description: sessionType?.description ?? '',
        duration_minutes: sessionType?.duration_minutes ?? 60,
        price: sessionType ? centsToInput(sessionType.price_cents) : '0.00',
        currency: sessionType?.currency ?? defaultCurrency,
        location_type: sessionType?.location_type ?? 'in_person',
        location: sessionType?.location ?? '',
        color: sessionType?.color ?? '#6366f1',
        buffer_minutes: sessionType?.buffer_minutes ?? 0,
        min_lead_hours: sessionType?.min_lead_hours ?? 24,
        max_per_day: sessionType?.max_per_day ?? ('' as number | ''),
        manual_approve: sessionType?.manual_approve ?? false,
        active: sessionType?.active ?? true,
    });

    transform((d) => ({
        ...d,
        price_cents: toCents(d.price),
        max_per_day: d.max_per_day === '' ? null : Number(d.max_per_day),
    }));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) patch(route('session-types.update', sessionType!.id), { onSuccess: onClose });
        else post(route('session-types.store'), { onSuccess: onClose });
    };

    const del = () => {
        if (confirm('Delete this session type? Existing bookings are kept.')) {
            router.delete(route('session-types.destroy', sessionType!.id), { onSuccess: onClose });
        }
    };

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">{isEdit ? 'Edit session type' : 'New session type'}</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>

                <div>
                    <span className="label">Name</span>
                    <input className={field} value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Engagement session" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

                <div>
                    <span className="label">Description</span>
                    <textarea className={field} rows={2} value={data.description} onChange={(e) => setData('description', e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Duration (minutes)</span>
                        <input type="number" min={5} className={field} value={data.duration_minutes} onChange={(e) => setData('duration_minutes', Number(e.target.value))} />
                        {errors.duration_minutes && <p className="mt-1 text-xs text-red-600">{errors.duration_minutes}</p>}
                    </div>
                    <div>
                        <span className="label">Buffer after (minutes)</span>
                        <input type="number" min={0} className={field} value={data.buffer_minutes} onChange={(e) => setData('buffer_minutes', Number(e.target.value))} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Price</span>
                        <input className={field} value={data.price} onChange={(e) => setData('price', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <span className="label">Currency</span>
                        <select className={field} value={data.currency} onChange={(e) => setData('currency', e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Location type</span>
                        <select className={field} value={data.location_type} onChange={(e) => setData('location_type', e.target.value as SessionType['location_type'])}>
                            <option value="in_person">In person</option>
                            <option value="phone">Phone call</option>
                            <option value="video">Video call</option>
                        </select>
                    </div>
                    <div>
                        <span className="label">Location / details</span>
                        <input className={field} value={data.location} onChange={(e) => setData('location', e.target.value)} placeholder="Studio address, etc." />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <span className="label">Min lead (hours)</span>
                        <input type="number" min={0} className={field} value={data.min_lead_hours} onChange={(e) => setData('min_lead_hours', Number(e.target.value))} />
                    </div>
                    <div>
                        <span className="label">Max / day</span>
                        <input type="number" min={1} className={field} value={data.max_per_day} onChange={(e) => setData('max_per_day', e.target.value === '' ? '' : Number(e.target.value))} placeholder="∞" />
                    </div>
                    <div>
                        <span className="label">Colour</span>
                        <input type="color" className="mt-1 h-9 w-full rounded-md border border-neutral-300" value={data.color} onChange={(e) => setData('color', e.target.value)} />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={data.manual_approve} onChange={(e) => setData('manual_approve', e.target.checked)} className="rounded border-neutral-300" />
                        Manually approve requests (otherwise auto-confirmed)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={data.active} onChange={(e) => setData('active', e.target.checked)} className="rounded border-neutral-300" />
                        Active (shown on the booking page)
                    </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                    {isEdit ? (
                        <button type="button" onClick={del} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                    ) : <span />}
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save'}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
