import { ImgHTMLAttributes, useCallback, useState } from 'react';

/**
 * <img> that fades in once loaded, showing an animated pulse placeholder
 * until then. The parent element must be `relative` — the placeholder is
 * absolutely positioned to fill it.
 */
export default function SkeletonImage({
    className = '',
    placeholderClassName = 'bg-neutral-100',
    ...props
}: ImgHTMLAttributes<HTMLImageElement> & { placeholderClassName?: string }) {
    const [loaded, setLoaded] = useState(false);

    // Cached images can be complete before onLoad is attached.
    const ref = useCallback((img: HTMLImageElement | null) => {
        if (img?.complete) setLoaded(true);
    }, []);

    return (
        <>
            {!loaded && <span aria-hidden className={`absolute inset-0 animate-pulse ${placeholderClassName}`} />}
            <img
                {...props}
                ref={ref}
                onLoad={(e) => {
                    setLoaded(true);
                    props.onLoad?.(e);
                }}
                className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </>
    );
}
