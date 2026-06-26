import Modal from '@/Components/Modal';
import axios from 'axios';
import { useRef, useState } from 'react';

export interface ImageRef {
    url: string;
    name?: string;
}

/**
 * Value editor/viewer for an "image" custom field: an "Open" button that pops a
 * masonry gallery where images can be viewed, added, or removed. Thumbnails are
 * shown next to the button only in the project popup (`showThumbs`), not the grid.
 */
export default function ImageField({
    images,
    onChange,
    label,
    showThumbs = true,
    uploadUrl,
}: {
    images: ImageRef[];
    onChange: (images: ImageRef[]) => void;
    label?: string;
    showThumbs?: boolean;
    /** Override the upload endpoint (defaults to the project field route). */
    uploadUrl?: string;
}) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const upload = async (files: File[]) => {
        if (!files.length) return;
        setUploading(true);
        try {
            const added: ImageRef[] = [];
            for (const file of files) {
                const fd = new FormData();
                fd.append('image', file);
                const { data } = await axios.post(uploadUrl ?? route('projects.field-image'), fd);
                added.push({ url: data.url, name: data.name });
            }
            onChange([...images, ...added]);
        } catch {
            alert('Could not upload image(s).');
        } finally {
            setUploading(false);
        }
    };

    const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

    return (
        <div className="flex items-center gap-1.5">
            {showThumbs && images.length > 0 && (
                <div className="flex -space-x-1">
                    {images.slice(0, 3).map((img, i) => (
                        <img
                            key={i}
                            src={img.url}
                            alt={img.name ?? ''}
                            className="h-6 w-6 rounded border border-white object-cover shadow-sm"
                        />
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.125-11.25a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Open{images.length ? ` (${images.length})` : ''}
            </button>

            <Modal show={open} onClose={() => setOpen(false)} maxWidth="2xl">
                <div className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-900">{label ?? 'Images'}</h2>
                        <button type="button" onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                            ✕
                        </button>
                    </div>

                    {images.length === 0 ? (
                        <p className="py-8 text-center text-sm text-neutral-400">No images yet.</p>
                    ) : (
                        // Masonry gallery — natural aspect ratios.
                        <div className="columns-2 gap-3 [&>*]:mb-3 max-h-[60vh] overflow-y-auto sm:columns-3">
                            {images.map((img, i) => (
                                <div key={i} className="group relative break-inside-avoid">
                                    <a href={img.url} target="_blank" rel="noreferrer">
                                        <img
                                            src={img.url}
                                            alt={img.name ?? label ?? ''}
                                            loading="lazy"
                                            className="w-full rounded-md border border-neutral-200"
                                        />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => remove(i)}
                                        className="absolute right-1.5 top-1.5 hidden rounded-full bg-black/60 px-1.5 text-xs text-white group-hover:block"
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                    {img.name && <p className="mt-1 truncate text-xs text-neutral-500">{img.name}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-3 border-t border-neutral-100 pt-4">
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm">
                            {uploading ? 'Uploading…' : '+ Add images'}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const f = Array.from(e.target.files ?? []);
                                upload(f);
                                e.target.value = '';
                            }}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
