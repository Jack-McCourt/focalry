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
    // ── Sans-serif ──
    { key: 'sans', label: 'System Sans', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    { key: 'inter', label: 'Inter', stack: "'Inter', ui-sans-serif, sans-serif", google: 'Inter:wght@300;400;500;600;700' },
    { key: 'lato', label: 'Lato', stack: "'Lato', ui-sans-serif, sans-serif", google: 'Lato:wght@300;400;700' },
    { key: 'open_sans', label: 'Open Sans', stack: "'Open Sans', ui-sans-serif, sans-serif", google: 'Open+Sans:wght@300;400;600;700' },
    { key: 'raleway', label: 'Raleway', stack: "'Raleway', ui-sans-serif, sans-serif", google: 'Raleway:wght@200;300;400;500;600;700', weight: 300, headingWeight: 300 },
    { key: 'montserrat', label: 'Montserrat', stack: "'Montserrat', ui-sans-serif, sans-serif", google: 'Montserrat:wght@300;400;500;600;700' },
    { key: 'poppins', label: 'Poppins', stack: "'Poppins', ui-sans-serif, sans-serif", google: 'Poppins:wght@300;400;500;600;700' },
    { key: 'dm_sans', label: 'DM Sans', stack: "'DM Sans', ui-sans-serif, sans-serif", google: 'DM+Sans:wght@400;500;700' },
    { key: 'work_sans', label: 'Work Sans', stack: "'Work Sans', ui-sans-serif, sans-serif", google: 'Work+Sans:wght@300;400;500;600' },
    { key: 'josefin', label: 'Josefin Sans', stack: "'Josefin Sans', ui-sans-serif, sans-serif", google: 'Josefin+Sans:wght@300;400;600', weight: 300 },
    { key: 'quicksand', label: 'Quicksand', stack: "'Quicksand', ui-sans-serif, sans-serif", google: 'Quicksand:wght@300;400;500;600' },
    { key: 'oswald', label: 'Oswald', stack: "'Oswald', ui-sans-serif, sans-serif", google: 'Oswald:wght@300;400;500;600', note: 'Condensed — strong headings' },
    { key: 'bebas', label: 'Bebas Neue', stack: "'Bebas Neue', ui-sans-serif, sans-serif", google: 'Bebas+Neue', note: 'Display caps — headings & logos', weight: 400 },
    // ── Serif ──
    { key: 'serif', label: 'System Serif', stack: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
    { key: 'playfair', label: 'Playfair Display', stack: "'Playfair Display', ui-serif, Georgia, serif", google: 'Playfair+Display:wght@400;500;600;700' },
    { key: 'cormorant', label: 'Cormorant Garamond', stack: "'Cormorant Garamond', ui-serif, Georgia, serif", google: 'Cormorant+Garamond:wght@300;400;500;600' },
    { key: 'eb_garamond', label: 'EB Garamond', stack: "'EB Garamond', ui-serif, Georgia, serif", google: 'EB+Garamond:ital,wght@0,400;0,500;0,600;1,400' },
    { key: 'lora', label: 'Lora', stack: "'Lora', ui-serif, Georgia, serif", google: 'Lora:wght@400;500;600;700' },
    { key: 'merriweather', label: 'Merriweather', stack: "'Merriweather', ui-serif, Georgia, serif", google: 'Merriweather:wght@300;400;700', weight: 300 },
    { key: 'libre_baskerville', label: 'Libre Baskerville', stack: "'Libre Baskerville', ui-serif, Georgia, serif", google: 'Libre+Baskerville:wght@400;700' },
    { key: 'crimson', label: 'Crimson Text', stack: "'Crimson Text', ui-serif, Georgia, serif", google: 'Crimson+Text:wght@400;600;700' },
    { key: 'marcellus', label: 'Marcellus', stack: "'Marcellus', ui-serif, Georgia, serif", google: 'Marcellus', note: 'Roman caps — elegant headings', weight: 400 },
    { key: 'cinzel', label: 'Cinzel', stack: "'Cinzel', ui-serif, Georgia, serif", google: 'Cinzel:wght@400;500;600', note: 'Engraved caps — headings & logos' },
    { key: 'dm_serif', label: 'DM Serif Display', stack: "'DM Serif Display', ui-serif, Georgia, serif", google: 'DM+Serif+Display' },
    { key: 'abril', label: 'Abril Fatface', stack: "'Abril Fatface', ui-serif, Georgia, serif", google: 'Abril+Fatface', note: 'Bold display — headings & logos', weight: 400 },
    // ── Script & handwritten ──
    { key: 'great_vibes', label: 'Great Vibes', stack: "'Great Vibes', cursive", google: 'Great+Vibes', note: 'Script — good for logos', weight: 400 },
    { key: 'dancing_script', label: 'Dancing Script', stack: "'Dancing Script', cursive", google: 'Dancing+Script:wght@400;500;600;700', note: 'Script — good for logos' },
    { key: 'sacramento', label: 'Sacramento', stack: "'Sacramento', cursive", google: 'Sacramento', note: 'Script — good for logos', weight: 400 },
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
