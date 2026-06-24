// Font registry for the website builder. Each font has a CSS stack and, for
// non-system fonts, the Google Fonts `family=` query used to import it. Fonts
// are only ever imported when actually selected (heading / body / logo), so a
// registered-but-unused font costs nothing.

export type SiteFontDef = {
    key: string;
    label: string;
    /** Value applied to `font-family`. */
    stack: string;
    /** Google Fonts css2 `family=` segment. Omit for system fonts. */
    google?: string;
    /** Optional hint shown in the picker. */
    note?: string;
    /** Default body weight when this font is selected (omit = browser default). */
    weight?: number;
    /** Default heading weight when this font is selected (omit = keep block default). */
    headingWeight?: number;
};

export const SITE_FONTS: SiteFontDef[] = [
    { key: 'sans', label: 'System Sans', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    { key: 'serif', label: 'System Serif', stack: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
    { key: 'raleway', label: 'Raleway', stack: "'Raleway', ui-sans-serif, sans-serif", google: 'Raleway:wght@200;300;400;500;600;700', weight: 300, headingWeight: 300 },
    { key: 'montserrat', label: 'Montserrat', stack: "'Montserrat', ui-sans-serif, sans-serif", google: 'Montserrat:wght@300;400;500;600;700' },
    { key: 'poppins', label: 'Poppins', stack: "'Poppins', ui-sans-serif, sans-serif", google: 'Poppins:wght@300;400;500;600;700' },
    { key: 'playfair', label: 'Playfair Display', stack: "'Playfair Display', ui-serif, Georgia, serif", google: 'Playfair+Display:wght@400;500;600;700' },
    { key: 'cormorant', label: 'Cormorant Garamond', stack: "'Cormorant Garamond', ui-serif, Georgia, serif", google: 'Cormorant+Garamond:wght@300;400;500;600' },
    { key: 'lora', label: 'Lora', stack: "'Lora', ui-serif, Georgia, serif", google: 'Lora:wght@400;500;600;700' },
    { key: 'dm_serif', label: 'DM Serif Display', stack: "'DM Serif Display', ui-serif, Georgia, serif", google: 'DM+Serif+Display' },
    { key: 'permanent_marker', label: 'Permanent Marker', stack: "'Permanent Marker', ui-sans-serif, cursive", google: 'Permanent+Marker', note: 'Handwritten — good for logos', weight: 400 },
];

const BY_KEY: Record<string, SiteFontDef> = Object.fromEntries(SITE_FONTS.map((f) => [f.key, f]));

/** Resolve a font key to its definition, falling back to System Sans. */
export function siteFont(key?: string | null): SiteFontDef {
    return (key && BY_KEY[key]) || BY_KEY.sans;
}

/** Build a single Google Fonts stylesheet href for the given font keys (deduped). */
export function googleFontsHref(keys: (string | null | undefined)[]): string | null {
    const families = Array.from(
        new Set(keys.map((k) => siteFont(k).google).filter((g): g is string => !!g)),
    );
    if (families.length === 0) return null;
    return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
}
