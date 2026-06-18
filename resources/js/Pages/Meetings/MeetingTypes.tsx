import MeetingsSubNav from '@/Components/MeetingsSubNav';
import Modal from '@/Components/Modal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface MeetingType {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    duration_minutes: number;
    location_type: 'video' | 'phone' | 'in_person';
    location: string | null;
    video_provider: 'google_meet' | 'zoom';
    color: string | null;
    buffer_minutes: number;
    min_lead_hours: number;
    max_per_day: number | null;
    manual_approve: boolean;
    active: boolean;
    meetings_count: number;
}

const LOCATION_LABELS: Record<string, string> = {
    video: 'Video call',
    phone: 'Phone call',
    in_person: 'In person',
};

export default function MeetingTypes({
    meetingTypes,
    booking_base_url,
    calendar_connected,
    zoom_connected,
}: PageProps<{ meetingTypes: MeetingType[]; booking_base_url: string; calendar_connected: boolean; zoom_connected: boolean }>) {
    const [editing, setEditing] = useState<MeetingType | null>(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyUrl = () => {
        navigator.clipboard.writeText(booking_base_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Meetings</h1>}>
            <Head title="Meeting types" />
            <StudioManagerNav active="meetings" />
            <MeetingsSubNav active="meeting-types" />

            <div className="px-4 py-6 sm:px-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-500">Your public booking link</p>
                        <p className="truncate text-sm text-neutral-800">{booking_base_url}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={copyUrl} className="btn-secondary px-3 py-1.5 text-xs">{copied ? 'Copied!' : 'Copy link'}</button>
                        <a href={booking_base_url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs">Preview</a>
                    </div>
                </div>

                {!calendar_connected && (
                    <div className="mb-5 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                        Google Calendar isn't connected — video links and calendar invites won't be sent automatically.
                        Connect it on the <a href={route('availability.edit')} className="font-medium underline">Availability</a> tab.
                    </div>
                )}

                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Meeting types</h2>
                    <button onClick={() => setCreating(true)} className="btn-primary">New meeting type</button>
                </div>

                {meetingTypes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                        <p className="text-sm font-medium text-neutral-700">No meeting types yet</p>
                        <p className="mt-1 text-sm text-neutral-400">Create one (e.g. “Discovery call”) so clients can book a time with you.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {meetingTypes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setEditing(t)}
                                className="rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:shadow-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color ?? '#6366f1' }} />
                                    <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                                    {!t.active && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">Hidden</span>}
                                </div>
                                <p className="mt-1 text-xs text-neutral-500">
                                    {t.duration_minutes} min · {LOCATION_LABELS[t.location_type]}
                                    {t.location_type === 'video' ? ` (${t.video_provider === 'zoom' ? 'Zoom' : 'Google Meet'})` : ''}
                                </p>
                                <p className="mt-2 text-[11px] text-neutral-400">
                                    {t.meetings_count} meeting{t.meetings_count === 1 ? '' : 's'}
                                    {t.manual_approve ? ' · Manual approval' : ''}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {creating && <MeetingTypeModal onClose={() => setCreating(false)} zoomConnected={zoom_connected} />}
            {editing && <MeetingTypeModal onClose={() => setEditing(null)} meetingType={editing} zoomConnected={zoom_connected} />}
        </AuthenticatedLayout>
    );
}

function MeetingTypeModal({
    onClose,
    meetingType,
    zoomConnected,
}: {
    onClose: () => void;
    meetingType?: MeetingType;
    zoomConnected: boolean;
}) {
    const isEdit = !!meetingType;
    const { data, setData, post, patch, processing, errors, transform } = useForm({
        name: meetingType?.name ?? '',
        description: meetingType?.description ?? '',
        duration_minutes: meetingType?.duration_minutes ?? 30,
        location_type: meetingType?.location_type ?? 'video',
        location: meetingType?.location ?? '',
        video_provider: meetingType?.video_provider ?? 'google_meet',
        color: meetingType?.color ?? '#6366f1',
        buffer_minutes: meetingType?.buffer_minutes ?? 0,
        min_lead_hours: meetingType?.min_lead_hours ?? 24,
        max_per_day: meetingType?.max_per_day ?? ('' as number | ''),
        manual_approve: meetingType?.manual_approve ?? false,
        active: meetingType?.active ?? true,
    });

    transform((d) => ({
        ...d,
        max_per_day: d.max_per_day === '' ? null : Number(d.max_per_day),
    }));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) patch(route('meeting-types.update', meetingType!.id), { onSuccess: onClose });
        else post(route('meeting-types.store'), { onSuccess: onClose });
    };

    const del = () => {
        if (confirm('Delete this meeting type? Existing meetings are kept.')) {
            router.delete(route('meeting-types.destroy', meetingType!.id), { onSuccess: onClose });
        }
    };

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">{isEdit ? 'Edit meeting type' : 'New meeting type'}</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>

                <div>
                    <span className="label">Name</span>
                    <input className={field} value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Discovery call" />
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
                        <span className="label">Meeting format</span>
                        <select className={field} value={data.location_type} onChange={(e) => setData('location_type', e.target.value as MeetingType['location_type'])}>
                            <option value="video">Video call</option>
                            <option value="phone">Phone call</option>
                            <option value="in_person">In person</option>
                        </select>
                    </div>
                    {data.location_type === 'video' ? (
                        <div>
                            <span className="label">Video provider</span>
                            <select className={field} value={data.video_provider} onChange={(e) => setData('video_provider', e.target.value as MeetingType['video_provider'])}>
                                <option value="google_meet">Google Meet (auto link)</option>
                                <option value="zoom">Zoom (add link manually)</option>
                            </select>
                        </div>
                    ) : (
                        <div>
                            <span className="label">{data.location_type === 'phone' ? 'Phone details' : 'Location'}</span>
                            <input className={field} value={data.location} onChange={(e) => setData('location', e.target.value)} placeholder={data.location_type === 'phone' ? 'We’ll call you' : 'Studio address'} />
                        </div>
                    )}
                </div>

                {data.location_type === 'video' && data.video_provider === 'zoom' && (
                    <p className="-mt-2 text-xs text-neutral-400">
                        {zoomConnected
                            ? 'A Zoom link is created automatically when a meeting is confirmed.'
                            : 'Connect Zoom on the Availability tab to auto-create links. Until then the meeting is scheduled without a Zoom link.'}
                    </p>
                )}

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
