// Cover styling — shared between the studio editor (live preview) and the
// public gallery hero. The shape is persisted as the collection's
// `cover_style` JSON column.

export type CoverFont =
    | 'sans'
    | 'serif'
    | 'helvetica'
    | 'georgia'
    | 'palatino'
    | 'garamond'
    | 'baskerville'
    | 'didot'
    | 'futura'
    | 'mono'
    | 'courier';

export interface CoverStyle {
    /** Where the title block sits over the cover image. `none` = no hero image, plain text header. */
    layout: 'none' | 'center' | 'bottom-left' | 'bottom-center';
    font: CoverFont;
    /** Text colour treatment over the image. */
    theme: 'light' | 'dark';
    height: 'short' | 'medium' | 'tall';
    /** Scrim opacity (0–80) for legibility over busy images. */
    overlay: number;
    /** Focal point as object-position percentages (0–100). */
    focal_x: number;
    focal_y: number;
}

export const DEFAULT_COVER_STYLE: CoverStyle = {
    layout: 'center',
    font: 'serif',
    theme: 'light',
    height: 'medium',
    overlay: 25,
    focal_x: 50,
    focal_y: 50,
};

export function normalizeCoverStyle(
    raw: Partial<CoverStyle> | Record<string, unknown> | null | undefined,
): CoverStyle {
    return { ...DEFAULT_COVER_STYLE, ...(raw ?? {}) } as CoverStyle;
}

// Web-safe font stacks so covers render consistently without loading web fonts.
export const FONT_STACK: Record<CoverFont, string> = {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", serif',
    helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    georgia: 'Georgia, serif',
    palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    garamond: 'Garamond, "Apple Garamond", "Times New Roman", serif',
    baskerville: 'Baskerville, "Baskerville Old Face", Georgia, serif',
    didot: 'Didot, "Bodoni MT", "Times New Roman", serif',
    futura: 'Futura, "Century Gothic", "Trebuchet MS", sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    courier: '"Courier New", Courier, monospace',
};

export const FONT_OPTIONS: { value: CoverFont; label: string }[] = [
    { value: 'sans', label: 'Sans-serif' },
    { value: 'helvetica', label: 'Helvetica' },
    { value: 'futura', label: 'Futura' },
    { value: 'serif', label: 'Serif' },
    { value: 'georgia', label: 'Georgia' },
    { value: 'palatino', label: 'Palatino' },
    { value: 'garamond', label: 'Garamond' },
    { value: 'baskerville', label: 'Baskerville' },
    { value: 'didot', label: 'Didot' },
    { value: 'mono', label: 'Monospace' },
    { value: 'courier', label: 'Courier' },
];

const HEIGHT_CLASS: Record<CoverStyle['height'], string> = {
    short: 'h-[45vh] min-h-[280px]',
    medium: 'h-[68vh] min-h-[360px]',
    tall: 'h-[90vh] min-h-[480px]',
};

const PREVIEW_HEIGHT_CLASS: Record<CoverStyle['height'], string> = {
    short: 'h-40',
    medium: 'h-56',
    tall: 'h-72',
};

// NB: the title block is a `flex flex-col` container, so `justify-*` is the
// vertical axis and `items-*` is the horizontal axis.
const POSITION_CLASS: Record<Exclude<CoverStyle['layout'], 'none'>, string> = {
    center: 'justify-center items-center text-center',
    'bottom-left': 'justify-end items-start text-left',
    'bottom-center': 'justify-end items-center text-center',
};

export function CoverHero({
    style,
    coverUrl,
    coverSrcset,
    title,
    date,
    preview = false,
}: {
    style: Partial<CoverStyle> | Record<string, unknown> | null | undefined;
    coverUrl: string | null;
    /** Responsive sources (e.g. "u 600w, u 1200w, u 1920w") for the banner. */
    coverSrcset?: string | null;
    title: string;
    /** Pre-formatted date string (or null). */
    date?: string | null;
    /** Constrained sizing for the editor preview. */
    preview?: boolean;
}) {
    const s = normalizeCoverStyle(style);
    const isLight = s.theme === 'light';

    // Plain text header — no hero image (either by choice or no cover set yet).
    if (s.layout === 'none' || !coverUrl) {
        return (
            <div className={`px-6 text-center ${preview ? 'py-10' : 'py-14'}`}>
                <h1
                    className={`font-light uppercase ${preview ? 'text-xl' : 'text-3xl'}`}
                    style={{ fontFamily: FONT_STACK[s.font], letterSpacing: '0.2em', color: '#fff' }}
                >
                    {title}
                </h1>
                {date && (
                    <p className="mt-2 text-xs uppercase tracking-widest" style={{ color: '#888' }}>
                        {date}
                    </p>
                )}
            </div>
        );
    }

    const textColor = isLight ? '#ffffff' : '#111111';
    const subColor = isLight ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.6)';
    const overlayColor = isLight
        ? `rgba(0,0,0,${s.overlay / 100})`
        : `rgba(255,255,255,${s.overlay / 100})`;

    return (
        <div
            className={`relative w-full overflow-hidden ${preview ? PREVIEW_HEIGHT_CLASS[s.height] : HEIGHT_CLASS[s.height]}`}
        >
            <img
                src={coverUrl}
                srcSet={coverSrcset || undefined}
                sizes="100vw"
                alt={title}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: `${s.focal_x}% ${s.focal_y}%` }}
            />
            <div className="absolute inset-0" style={{ background: overlayColor }} />
            <div
                className={`relative flex h-full w-full flex-col ${preview ? 'p-5' : 'p-10 sm:p-16'} ${POSITION_CLASS[s.layout]}`}
            >
                <h1
                    className={`font-light uppercase ${preview ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}
                    style={{ fontFamily: FONT_STACK[s.font], letterSpacing: '0.18em', color: textColor }}
                >
                    {title}
                </h1>
                {date && (
                    <p
                        className={`mt-3 uppercase ${preview ? 'text-[10px] tracking-[0.2em]' : 'text-xs tracking-[0.25em]'}`}
                        style={{ color: subColor }}
                    >
                        {date}
                    </p>
                )}
            </div>
        </div>
    );
}
