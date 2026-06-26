import Modal from '@/Components/Modal';
import axios from 'axios';
import { useRef, useState } from 'react';

export interface FileRef {
    url: string;
    name?: string;
    size?: number;
}

function fmtSize(bytes?: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Value editor/viewer for a "file" custom field: an Open button that pops a list
 * of uploaded documents, each with a Download button. Files can be added/removed.
 */
export default function FileField({
    files,
    onChange,
    label,
    uploadUrl,
}: {
    files: FileRef[];
    onChange: (files: FileRef[]) => void;
    label?: string;
    /** Override the upload endpoint (defaults to the project field route). */
    uploadUrl?: string;
}) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const upload = async (picked: File[]) => {
        if (!picked.length) return;
        setUploading(true);
        try {
            const added: FileRef[] = [];
            for (const file of picked) {
                const fd = new FormData();
                fd.append('file', file);
                const { data } = await axios.post(uploadUrl ?? route('projects.field-file'), fd);
                added.push({ url: data.url, name: data.name, size: data.size });
            }
            onChange([...files, ...added]);
        } catch {
            alert('Could not upload file(s).');
        } finally {
            setUploading(false);
        }
    };

    const remove = (i: number) => onChange(files.filter((_, idx) => idx !== i));

    return (
        <div className="flex items-center gap-1.5">
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 rounded border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Open{files.length ? ` (${files.length})` : ''}
            </button>

            <Modal show={open} onClose={() => setOpen(false)} maxWidth="lg">
                <div className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-900">{label ?? 'Files'}</h2>
                        <button type="button" onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                            ✕
                        </button>
                    </div>

                    {files.length === 0 ? (
                        <p className="py-8 text-center text-sm text-neutral-400">No files yet.</p>
                    ) : (
                        <ul className="max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto">
                            {files.map((f, i) => (
                                <li key={i} className="flex items-center gap-3 py-2.5">
                                    <svg className="h-5 w-5 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-neutral-800">{f.name ?? 'File'}</span>
                                        {f.size ? <span className="text-xs text-neutral-400">{fmtSize(f.size)}</span> : null}
                                    </span>
                                    <a
                                        href={f.url}
                                        download={f.name}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                    >
                                        Download
                                    </a>
                                    <button type="button" onClick={() => remove(i)} className="shrink-0 text-neutral-300 hover:text-red-500" title="Remove">
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-4 flex items-center gap-3 border-t border-neutral-100 pt-4">
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm">
                            {uploading ? 'Uploading…' : '+ Add files'}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
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
