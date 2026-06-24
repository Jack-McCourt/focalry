import { galleryThemeVars } from '@/lib/galleryTheme';
import { PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { ChangeEvent, useMemo, useRef, useState } from 'react';

interface PublicCollection {
    title: string;
    slug: string;
    theme: string;
}

interface GuestPhoto {
    id: number;
    uploader_name: string | null;
    caption: string | null;
    thumb_url: string | null;
}

function getCsrfToken(): string {
    return (
        document.cookie
            .split('; ')
            .find((r) => r.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] ?? ''
    );
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

interface UploadItem {
    id: string;
    name: string;
    progress: number;
    status: 'uploading' | 'done' | 'error';
}

export default function GuestUpload({
    collection,
    title,
    message,
    pin_required,
    pin_verified,
    max_file_mb,
    photos,
}: PageProps<{
    collection: PublicCollection;
    title: string;
    message: string;
    pin_required: boolean;
    pin_verified: boolean;
    max_file_mb: number;
    photos: GuestPhoto[];
}>) {
    const themeVars = useMemo(() => galleryThemeVars(collection.theme), [collection.theme]);

    const [unlocked, setUnlocked] = useState(!pin_required || pin_verified);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    const [name, setName] = useState('');
    const [caption, setCaption] = useState('');
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const decodedToken = () => decodeURIComponent(getCsrfToken());

    const verifyPin = async () => {
        if (!pin.trim()) return;
        setChecking(true);
        setPinError(null);
        try {
            await axios.post(
                route('gallery.guest-upload.verify-pin', collection.slug),
                { pin: pin.trim() },
                { headers: { 'X-XSRF-TOKEN': decodedToken() } },
            );
            setUnlocked(true);
        } catch {
            setPinError('That PIN is incorrect.');
        } finally {
            setChecking(false);
        }
    };

    const uploadOne = async (file: File) => {
        const id = crypto.randomUUID();
        setUploads((prev) => [...prev, { id, name: file.name, progress: 0, status: 'uploading' }]);
        const patch = (p: Partial<UploadItem>) =>
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));

        try {
            const presign = await axios.post(
                route('gallery.guest-upload.presign', collection.slug),
                { filename: file.name, content_type: file.type, file_size: file.size },
                { headers: { 'X-XSRF-TOKEN': decodedToken() } },
            );

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', presign.data.url);
                xhr.setRequestHeader('Content-Type', file.type);
                Object.entries(presign.data.headers ?? {}).forEach(([k, v]) => {
                    if (k.toLowerCase() !== 'content-type' && k.toLowerCase() !== 'host') {
                        xhr.setRequestHeader(k, v as string);
                    }
                });
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) patch({ progress: Math.round((e.loaded / e.total) * 100) });
                };
                xhr.onload = () =>
                    xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('upload failed'));
                xhr.onerror = () => reject(new Error('network error'));
                xhr.send(file);
            });

            await axios.post(
                route('gallery.guest-upload.register', collection.slug),
                {
                    filename: file.name,
                    wasabi_key: presign.data.key,
                    file_size: file.size,
                    uploader_name: name.trim() || undefined,
                    caption: caption.trim() || undefined,
                },
                { headers: { 'X-XSRF-TOKEN': decodedToken() } },
            );

            patch({ status: 'done', progress: 100 });
        } catch {
            patch({ status: 'error' });
        }
    };

    const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files).filter((f) => ALLOWED.includes(f.type));
        e.target.value = '';
        // Upload sequentially — guests are usually on phones / weak connections.
        // Refresh the shared wall once everything finishes (newly-processed photos
        // appear; the guest's own may need a moment while derivatives generate).
        files
            .reduce((chain, f) => chain.then(() => uploadOne(f)), Promise.resolve())
            .then(() => router.reload({ only: ['photos'] }));
    };

    const doneCount = uploads.filter((u) => u.status === 'done').length;
    const activeCount = uploads.filter((u) => u.status === 'uploading').length;
    const errorCount = uploads.filter((u) => u.status === 'error').length;

    return (
        <>
            <Head title={`${title} — ${collection.title}`} />
            <div
                className="flex min-h-screen flex-col items-center px-6 py-12"
                style={{ ...themeVars, background: 'var(--g-bg)', color: 'var(--g-text)' }}
            >
                <div className="w-full max-w-sm text-center">
                    <p className="mb-2 text-xs uppercase tracking-widest" style={{ color: 'var(--g-muted)' }}>
                        {collection.title}
                    </p>
                    <h1 className="text-2xl font-light tracking-wide">{title}</h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--g-muted)' }}>
                        {message}
                    </p>

                    {!unlocked ? (
                        <div className="mt-8 space-y-3">
                            <input
                                inputMode="numeric"
                                autoFocus
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                                placeholder="Enter PIN"
                                className="w-full rounded-lg border bg-transparent py-3 text-center text-lg tracking-[0.3em] outline-none"
                                style={{ borderColor: 'var(--g-border)' }}
                            />
                            {pinError && <p className="text-sm text-red-400">{pinError}</p>}
                            <button
                                onClick={verifyPin}
                                disabled={checking}
                                className="w-full rounded-full bg-[var(--g-text)] py-3 text-sm font-medium uppercase tracking-widest text-[var(--g-bg)] transition hover:opacity-90 disabled:opacity-50"
                            >
                                {checking ? 'Checking…' : 'Continue'}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-8 space-y-4">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name (optional)"
                                className="w-full rounded-lg border bg-transparent py-3 px-4 text-center text-sm outline-none placeholder:text-neutral-500"
                                style={{ borderColor: 'var(--g-border)' }}
                            />
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                rows={2}
                                maxLength={500}
                                placeholder="Add a message (optional)"
                                className="w-full resize-none rounded-lg border bg-transparent py-3 px-4 text-center text-sm outline-none placeholder:text-neutral-500"
                                style={{ borderColor: 'var(--g-border)' }}
                            />

                            <button
                                onClick={() => inputRef.current?.click()}
                                className="w-full rounded-full bg-[var(--g-text)] py-4 text-sm font-medium uppercase tracking-widest text-[var(--g-bg)] transition hover:opacity-90"
                            >
                                Choose photos
                            </button>
                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="hidden"
                                onChange={onFiles}
                            />
                            <p className="text-xs" style={{ color: 'var(--g-muted)' }}>
                                JPEG, PNG or WebP · up to {max_file_mb} MB each
                            </p>

                            {uploads.length > 0 && (
                                <div className="space-y-2 pt-2 text-left">
                                    {(doneCount > 0 || activeCount > 0 || errorCount > 0) && (
                                        <p className="text-center text-sm" style={{ color: 'var(--g-muted)' }}>
                                            {doneCount > 0 && `${doneCount} added`}
                                            {activeCount > 0 && `${doneCount > 0 ? ' · ' : ''}${activeCount} uploading`}
                                            {errorCount > 0 && (
                                                <span className="text-red-400">
                                                    {(doneCount > 0 || activeCount > 0) ? ' · ' : ''}
                                                    {errorCount} failed
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    {uploads
                                        .filter((u) => u.status !== 'done')
                                        .map((u) => (
                                            <div key={u.id}>
                                                <div className="flex justify-between text-xs" style={{ color: 'var(--g-muted)' }}>
                                                    <span className="max-w-[200px] truncate">{u.name}</span>
                                                    <span>{u.status === 'error' ? 'Failed' : `${u.progress}%`}</span>
                                                </div>
                                                <div className="mt-1 h-0.5 w-full rounded-full" style={{ background: 'var(--g-border)' }}>
                                                    <div
                                                        className="h-0.5 rounded-full transition-all"
                                                        style={{ width: `${u.progress}%`, background: 'var(--g-text)' }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}

                            {doneCount > 0 && activeCount === 0 && (
                                <p className="pt-2 text-sm" style={{ color: 'var(--g-text)' }}>
                                    Thank you! Your photos have been shared.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Shared wall — everything guests have uploaded */}
                {photos.length > 0 && (
                    <div className="mt-14 w-full max-w-3xl">
                        <p className="mb-4 text-center text-xs uppercase tracking-widest" style={{ color: 'var(--g-muted)' }}>
                            Shared by guests
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                            {photos.map((p) => (
                                <div key={p.id} className="overflow-hidden rounded-lg" style={{ background: 'var(--g-panel)' }}>
                                    <div className="aspect-square" style={{ background: 'var(--g-border)' }}>
                                        {p.thumb_url && (
                                            <img
                                                src={p.thumb_url}
                                                alt={p.uploader_name ?? ''}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        )}
                                    </div>
                                    {(p.caption || p.uploader_name) && (
                                        <div className="px-2.5 py-2 text-left">
                                            {p.caption && (
                                                <p className="text-xs leading-snug" style={{ color: 'var(--g-text)' }}>{p.caption}</p>
                                            )}
                                            {p.uploader_name && (
                                                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--g-muted)' }}>— {p.uploader_name}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
