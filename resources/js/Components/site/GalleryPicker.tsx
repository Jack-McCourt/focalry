import Modal from '@/Components/Modal';
import { useEffect, useState } from 'react';

interface PickerPhoto {
    id: number;
    thumb: string;
}
interface PickerCollection {
    id: number;
    title: string;
    photos: PickerPhoto[];
}

/** Modal to pick image(s) from the studio's galleries. Selected photos are
 *  imported (copied to permanent storage) and their URLs returned via onSelect. */
export default function GalleryPicker({
    open,
    multiple = false,
    onClose,
    onSelect,
}: {
    open: boolean;
    multiple?: boolean;
    onClose: () => void;
    onSelect: (urls: string[]) => void;
}) {
    const [collections, setCollections] = useState<PickerCollection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [selected, setSelected] = useState<number[]>([]);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSelected([]);
        setError(null);
        setLoading(true);
        (window as any).axios
            .get(route('website.gallery.images'))
            .then((res: any) => {
                const cols: PickerCollection[] = res.data.collections ?? [];
                setCollections(cols);
                setActiveId(cols[0]?.id ?? null);
            })
            .catch(() => setError('Could not load your galleries.'))
            .finally(() => setLoading(false));
    }, [open]);

    const active = collections.find((c) => c.id === activeId) ?? null;

    const toggle = (id: number) => {
        setSelected((prev) => {
            if (multiple) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            return prev.includes(id) ? [] : [id];
        });
    };

    const confirm = () => {
        if (selected.length === 0) return;
        setImporting(true);
        setError(null);
        (window as any).axios
            .post(route('website.gallery.import'), { photo_ids: selected })
            .then((res: any) => {
                onSelect(res.data.urls ?? []);
                onClose();
            })
            .catch(() => setError('Could not import the selected images.'))
            .finally(() => setImporting(false));
    };

    return (
        <Modal show={open} onClose={onClose} maxWidth="2xl">
            <div className="flex max-h-[80vh] flex-col">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                    <h2 className="text-sm font-semibold text-neutral-900">Choose from galleries</h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {collections.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto border-b border-neutral-100 px-3 py-2">
                        {collections.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setActiveId(c.id)}
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${c.id === activeId ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                            >
                                {c.title} <span className="opacity-60">{c.photos.length}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <p className="py-16 text-center text-sm text-neutral-400">Loading galleries…</p>
                    ) : error ? (
                        <p className="py-16 text-center text-sm text-red-600">{error}</p>
                    ) : collections.length === 0 ? (
                        <p className="py-16 text-center text-sm text-neutral-400">No gallery photos found. Upload photos to a collection first.</p>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                            {active?.photos.map((p) => {
                                const sel = selected.includes(p.id);
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => toggle(p.id)}
                                        className={`relative aspect-square overflow-hidden rounded-lg ring-2 transition ${sel ? 'ring-blue-600' : 'ring-transparent hover:ring-neutral-300'}`}
                                    >
                                        <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                                        {sel && (
                                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3">
                    <span className="text-xs text-neutral-500">
                        {selected.length > 0 ? `${selected.length} selected` : multiple ? 'Select one or more images' : 'Select an image'}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                        <button onClick={confirm} disabled={selected.length === 0 || importing} className="btn-primary px-3 py-1.5 text-xs">
                            {importing ? 'Adding…' : multiple ? `Add ${selected.length || ''} image${selected.length === 1 ? '' : 's'}`.replace('  ', ' ').trim() : 'Use image'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
