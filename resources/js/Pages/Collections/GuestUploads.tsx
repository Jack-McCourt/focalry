import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

interface GuestSettings {
    enabled: boolean;
    pin: string | null;
    require_approval: boolean;
    show_as_tab: boolean;
    set_id: number | null;
    title: string | null;
    message: string | null;
}

interface GuestPhoto {
    id: number;
    filename: string;
    status: string;
    approved: boolean;
    uploader_name: string | null;
    caption: string | null;
    thumb_url: string | null;
    created_at: string | null;
}

function getCsrfToken(): string {
    return (
        document.cookie
            .split('; ')
            .find((r) => r.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] ?? ''
    );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${on ? 'bg-neutral-900' : 'bg-neutral-200'}`}
        >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );
}

export default function GuestUploads({
    collection,
    settings,
    upload_url,
    qr_data_uri,
    photos,
}: PageProps<{
    collection: { id: number; title: string; slug: string };
    settings: GuestSettings;
    upload_url: string;
    qr_data_uri: string;
    photos: GuestPhoto[];
}>) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm({
        enabled: settings.enabled,
        pin: settings.pin ?? '',
        require_approval: settings.require_approval,
        show_as_tab: settings.show_as_tab,
        title: settings.title ?? '',
        message: settings.message ?? '',
    });

    const [copied, setCopied] = useState(false);
    const [list, setList] = useState<GuestPhoto[]>(photos);

    const save = () => patch(route('collections.guest-uploads.update', collection.id), { preserveScroll: true });

    const copyLink = () => {
        navigator.clipboard.writeText(upload_url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    const approve = (id: number) => {
        router.post(
            route('collections.guest-uploads.approve', [collection.id, id]),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setList((prev) => prev.map((p) => (p.id === id ? { ...p, approved: true } : p))),
            },
        );
    };

    const remove = (id: number) => {
        if (!confirm('Delete this guest photo?')) return;
        axios
            .delete(`/api/photos/${id}`, { headers: { 'X-XSRF-TOKEN': decodeURIComponent(getCsrfToken()) } })
            .then(() => setList((prev) => prev.filter((p) => p.id !== id)));
    };

    const pending = list.filter((p) => !p.approved).length;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link href={route('collections.index')} className="text-neutral-500 hover:text-neutral-900">
                        Galleries
                    </Link>
                    <span className="text-neutral-300">/</span>
                    <Link href={route('collections.show', collection.id)} className="text-neutral-500 hover:text-neutral-900">
                        {collection.title}
                    </Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-medium text-neutral-900">QR Uploads</span>
                </div>
            }
        >
            <Head title={`QR Uploads — ${collection.title}`} />

            {/* Tab bar mirroring the gallery editor, with QR Uploads active. */}
            <div className="flex shrink-0 items-center gap-1 border-b border-neutral-100 bg-white px-6">
                {([
                    { label: 'Photos', tab: 'photos' },
                    { label: 'Settings', tab: 'settings' },
                    { label: 'Activity', tab: 'activity' },
                ] as const).map((t) => (
                    <Link
                        key={t.tab}
                        href={`${route('collections.show', collection.id)}?tab=${t.tab}`}
                        className="px-3 py-3.5 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-700"
                    >
                        {t.label}
                    </Link>
                ))}
                <span className="relative px-3 py-3.5 text-sm font-medium text-neutral-900">
                    QR Uploads
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-neutral-900" />
                </span>
            </div>

            <div className="mx-auto max-w-5xl p-6 lg:p-8">
                <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                    {/* Settings */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900">Guest photo uploads</h2>
                            <p className="mt-1 text-sm text-neutral-500">
                                Print the QR card and place it on tables. Guests scan it to upload photos straight into this gallery.
                            </p>
                        </div>

                        <div className="space-y-5 rounded-xl border border-neutral-100 bg-white p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-neutral-800">Enable guest uploads</p>
                                    <p className="mt-0.5 text-xs text-neutral-500">Turn the public upload page on for this gallery</p>
                                </div>
                                <Toggle on={data.enabled} onClick={() => setData('enabled', !data.enabled)} />
                            </div>

                            <div>
                                <label className="label mb-1.5">Upload PIN</label>
                                <input
                                    type="text"
                                    value={data.pin}
                                    onChange={(e) => setData('pin', e.target.value)}
                                    placeholder="e.g. 1234 (leave blank for no PIN)"
                                    className="input font-mono"
                                />
                                <p className="mt-1 text-xs text-neutral-500">Guests must enter this PIN before uploading. It's printed on the card.</p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-neutral-800">Review before publishing</p>
                                    <p className="mt-0.5 text-xs text-neutral-500">Hold guest photos for your approval instead of showing them right away</p>
                                </div>
                                <Toggle on={data.require_approval} onClick={() => setData('require_approval', !data.require_approval)} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-neutral-800">Show guest uploads in the main gallery</p>
                                    <p className="mt-0.5 text-xs text-neutral-500">Approved guest photos appear in their own “Guest Photos” tab in the client gallery</p>
                                </div>
                                <Toggle on={data.show_as_tab} onClick={() => setData('show_as_tab', !data.show_as_tab)} />
                            </div>

                            <div>
                                <label className="label mb-1.5">Heading</label>
                                <input
                                    type="text"
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    placeholder="Share your photos"
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="label mb-1.5">Message</label>
                                <textarea
                                    value={data.message}
                                    onChange={(e) => setData('message', e.target.value)}
                                    placeholder="Add the photos you took today to the gallery."
                                    rows={2}
                                    className="input"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={save} disabled={processing} className="btn-primary justify-center">
                                    {processing ? 'Saving…' : 'Save settings'}
                                </button>
                                {recentlySuccessful && <span className="text-xs text-emerald-600">Saved</span>}
                            </div>
                        </div>

                        {/* Guest uploads list */}
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-neutral-900">
                                    Guest photos
                                    <span className="ml-1.5 text-neutral-400">{list.length}</span>
                                </h3>
                                {pending > 0 && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        {pending} awaiting approval
                                    </span>
                                )}
                            </div>

                            {list.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
                                    No guest photos yet.
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                                    {list.map((p) => (
                                        <div key={p.id} className="group relative overflow-hidden rounded-lg bg-neutral-100">
                                            <div className="aspect-square">
                                                {p.thumb_url ? (
                                                    <img src={p.thumb_url} alt={p.filename} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                                                        {p.status === 'processing' ? 'Processing…' : '—'}
                                                    </div>
                                                )}
                                            </div>
                                            {!p.approved && (
                                                <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                                    Pending
                                                </span>
                                            )}
                                            {(p.caption || p.uploader_name) && (
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1 text-white">
                                                    {p.caption && <p className="line-clamp-2 text-[10px] leading-snug">{p.caption}</p>}
                                                    {p.uploader_name && <p className="truncate text-[10px] opacity-75">— {p.uploader_name}</p>}
                                                </div>
                                            )}
                                            <div className="absolute inset-x-1.5 top-1.5 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                                                {!p.approved && (
                                                    <button
                                                        onClick={() => approve(p.id)}
                                                        className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-600"
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => remove(p.id)}
                                                    className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* QR card */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-neutral-100 bg-white p-6 text-center">
                            <img src={qr_data_uri} alt="QR code" className="mx-auto h-44 w-44" />
                            {data.pin && (
                                <p className="mt-3 text-sm text-neutral-500">
                                    PIN <span className="font-mono font-semibold text-neutral-900">{data.pin}</span>
                                </p>
                            )}
                            <a
                                href={route('collections.guest-uploads.card', collection.id)}
                                className="btn-primary mt-4 w-full justify-center"
                            >
                                Download printable card (A6)
                            </a>
                            <a
                                href={qr_data_uri}
                                download={`qr-code-${collection.slug}.png`}
                                className="btn-secondary mt-2 w-full justify-center"
                            >
                                Download QR code (PNG)
                            </a>
                            <button onClick={copyLink} className="btn-secondary mt-2 w-full justify-center">
                                {copied ? 'Link copied!' : 'Copy upload link'}
                            </button>
                            <a
                                href={upload_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 block break-all text-xs text-neutral-400 hover:text-neutral-600"
                            >
                                {upload_url}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
