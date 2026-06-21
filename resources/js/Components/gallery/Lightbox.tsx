import { ChevronLeft, ChevronRight, Download, Heart, ShoppingBag, X } from 'lucide-react';
import { useCallback, useEffect } from 'react';

export interface LightboxPhoto {
    id: number;
    filename: string;
    web_url: string | null;
    thumb_url: string | null;
    width: number | null;
    height: number | null;
}

/**
 * Full-screen gallery viewer: keyboard + on-screen navigation, with optional
 * favourite / download / buy actions wired to the gallery's existing handlers.
 */
export default function Lightbox({
    photos,
    index,
    onClose,
    onIndex,
    canFavourite,
    isFavourited,
    onToggleFavourite,
    canDownload,
    onDownload,
    storeEnabled,
    onBuy,
}: {
    photos: LightboxPhoto[];
    index: number;
    onClose: () => void;
    onIndex: (i: number) => void;
    canFavourite: boolean;
    isFavourited: boolean;
    onToggleFavourite: (photoId: number) => void;
    canDownload: boolean;
    onDownload: (photoId: number) => void;
    storeEnabled: boolean;
    onBuy: (photoId: number) => void;
}) {
    const photo = photos[index];
    const prev = useCallback(() => onIndex((index - 1 + photos.length) % photos.length), [index, photos.length, onIndex]);
    const next = useCallback(() => onIndex((index + 1) % photos.length), [index, photos.length, onIndex]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose, prev, next]);

    if (!photo) return null;

    const iconBtn = 'rounded-full bg-white/10 p-2.5 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white';

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 text-white/70" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs tabular-nums">{index + 1} / {photos.length}</span>
                <button onClick={onClose} className={iconBtn} aria-label="Close">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Image + nav */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
                {photos.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); prev(); }} className={`absolute left-3 ${iconBtn}`} aria-label="Previous">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                )}

                <img
                    key={photo.id}
                    src={photo.web_url ?? photo.thumb_url ?? ''}
                    alt={photo.filename}
                    onClick={(e) => e.stopPropagation()}
                    className="max-h-full max-w-full select-none object-contain"
                    draggable={false}
                />

                {photos.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); next(); }} className={`absolute right-3 ${iconBtn}`} aria-label="Next">
                        <ChevronRight className="h-6 w-6" />
                    </button>
                )}
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-center gap-3 px-4 py-4" onClick={(e) => e.stopPropagation()}>
                {canFavourite && (
                    <button onClick={() => onToggleFavourite(photo.id)} className={iconBtn} title={isFavourited ? 'Remove favourite' : 'Add to favourites'}>
                        <Heart className="h-5 w-5" color={isFavourited ? '#fb7185' : 'currentColor'} fill={isFavourited ? '#fb7185' : 'none'} />
                    </button>
                )}
                {canDownload && (
                    <button onClick={() => onDownload(photo.id)} className={iconBtn} title="Download">
                        <Download className="h-5 w-5" />
                    </button>
                )}
                {storeEnabled && (
                    <button
                        onClick={() => onBuy(photo.id)}
                        className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        Buy prints
                    </button>
                )}
            </div>
        </div>
    );
}
