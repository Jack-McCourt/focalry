import { useState } from 'react';
import { GalleryImage, InlineText, Lightbox, MasonryGrid, RetryImg, containerW, galleryAlt, galleryCaption, galleryFull, galleryThumb, galleryTitle } from './ui';

export function GalleryBlock({ d, interactive, width, onEditHeading }: { d: Record<string, any>; interactive: boolean; width?: string; onEditHeading?: (v: string) => void }) {
    const images: GalleryImage[] = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
    const cols = Math.min(Math.max(Number(d.columns) || 3, 2), 4);
    const layout = ['square', 'landscape', 'portrait', 'masonry'].includes(d.layout) ? d.layout : 'square';
    const lightbox = d.lightbox !== false;
    const [active, setActive] = useState<number | null>(null);

    const gridCols = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
    const aspect = layout === 'landscape' ? 'aspect-[4/3]' : layout === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

    // Show placeholder tiles in the builder preview when there are no images yet.
    const tiles = images.length > 0 ? images : interactive ? [] : ['', '', '', '', '', ''];
    const canLightbox = interactive && lightbox && images.length > 0;
    const open = (i: number) => canLightbox && setActive(i);
    const zoom = canLightbox ? 'cursor-zoom-in' : '';

    // Full width breaks out of the usual centered container to span the viewport.
    const wrap = d.full_width ? 'w-full px-2 py-12 sm:px-3' : `mx-auto ${containerW(width, 'max-w-6xl')} px-6 py-20 sm:px-10`;

    return (
        <section className={wrap}>
            {onEditHeading
                ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Section heading (optional)" onChange={onEditHeading} className="mb-12 block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                : d.heading && <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}

            {tiles.length === 0 ? (
                <p className="text-center text-sm text-neutral-400">No images yet.</p>
            ) : layout === 'masonry' ? (
                <MasonryGrid key={tiles.map(galleryThumb).join('|')} cols={cols} gap={12}>
                    {tiles.map((img, i) => {
                        const t = galleryThumb(img);
                        return t ? (
                            <RetryImg key={i} src={t} alt={galleryAlt(img)} title={galleryTitle(img) || undefined} loading="lazy" onClick={() => open(i)} className={`block w-full rounded-lg ${zoom}`} />
                        ) : (
                            <div key={i} className="flex h-40 w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-300">Photo</div>
                        );
                    })}
                </MasonryGrid>
            ) : (
                <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
                    {tiles.map((img, i) => {
                        const t = galleryThumb(img);
                        return t ? (
                            <RetryImg key={i} src={t} alt={galleryAlt(img)} title={galleryTitle(img) || undefined} loading="lazy" onClick={() => open(i)} className={`${aspect} w-full rounded-lg object-cover ${zoom}`} />
                        ) : (
                            <div key={i} className={`${aspect} flex w-full items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-300`}>Photo</div>
                        );
                    })}
                </div>
            )}

            {active !== null && (
                <Lightbox
                    images={images.map((img) => ({ src: galleryFull(img), alt: galleryAlt(img), title: galleryTitle(img), caption: galleryCaption(img) }))}
                    index={active}
                    onClose={() => setActive(null)}
                    onIndex={setActive}
                />
            )}
        </section>
    );
}
