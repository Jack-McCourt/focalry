// Responsive image helpers. Our site images are stored as a single (≤1920px)
// WebP; the /img endpoint generates width-capped derivatives on demand. These
// helpers build a `srcset` of those derivatives so the browser downloads only
// the size it needs.

// Must mirror ImageResizeController::WIDTHS.
const WIDTHS = [384, 640, 960, 1280, 1920];

/** CDN base (BunnyCDN pull zone), read once from the <meta> the layout injects. */
const CDN_BASE: string =
    (typeof document !== 'undefined' && document.querySelector('meta[name="asset-cdn"]')?.getAttribute('content')) || '';

/**
 * True when `url` points at one of our own public assets (CDN or the /assets/
 * stream route) — the only URLs the resize endpoint will serve.
 */
export function isOwnAsset(url: string | undefined): url is string {
    if (!url) return false;
    if (url.includes('/_rw/')) return false; // already a derivative
    return url.includes('/assets/') || (!!CDN_BASE && url.startsWith(CDN_BASE));
}

/**
 * Build a `srcset` of resized WebP derivatives for one of our assets, or null
 * when the URL isn't ours (callers then fall back to a plain `src`).
 */
export function buildSrcSet(url: string | undefined): string | null {
    if (!isOwnAsset(url)) return null;
    return WIDTHS.map((w) => `/img?src=${encodeURIComponent(url)}&w=${w} ${w}w`).join(', ');
}
