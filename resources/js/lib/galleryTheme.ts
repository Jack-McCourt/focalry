import { CSSProperties } from 'react';

/**
 * Client-gallery appearance themes. Each maps to a set of CSS custom properties
 * applied on the gallery root; all gallery chrome reads them via var(--g-*), so
 * adding a theme is just another palette here.
 */
export type GalleryThemeKey = 'dark' | 'light' | 'cream' | 'stone';

type Palette = {
    '--g-bg': string;
    '--g-bg-2': string; // translucent bg for the sticky set-nav
    '--g-panel': string; // modals, dropdowns, bars
    '--g-text': string;
    '--g-muted': string;
    '--g-faint': string;
    '--g-border': string;
    '--g-accent': string; // favourite heart
};

export const GALLERY_THEMES: Record<GalleryThemeKey, Palette> = {
    dark: {
        '--g-bg': '#0e0e0e',
        '--g-bg-2': 'rgba(14,14,14,0.88)',
        '--g-panel': '#1a1a1a',
        '--g-text': '#ffffff',
        '--g-muted': '#8a8a8a',
        '--g-faint': '#666666',
        '--g-border': '#2a2a2a',
        '--g-accent': '#fb7185',
    },
    light: {
        '--g-bg': '#ffffff',
        '--g-bg-2': 'rgba(255,255,255,0.9)',
        '--g-panel': '#ffffff',
        '--g-text': '#18181b',
        '--g-muted': '#6b7280',
        '--g-faint': '#9ca3af',
        '--g-border': '#e5e7eb',
        '--g-accent': '#e11d48',
    },
    cream: {
        '--g-bg': '#f6f1ea',
        '--g-bg-2': 'rgba(246,241,234,0.9)',
        '--g-panel': '#fffdfa',
        '--g-text': '#3a322b',
        '--g-muted': '#8a7d6d',
        '--g-faint': '#b3a795',
        '--g-border': '#e6ddd0',
        '--g-accent': '#b0654f',
    },
    stone: {
        '--g-bg': '#f4f4f5',
        '--g-bg-2': 'rgba(244,244,245,0.9)',
        '--g-panel': '#ffffff',
        '--g-text': '#27272a',
        '--g-muted': '#71717a',
        '--g-faint': '#a1a1aa',
        '--g-border': '#e4e4e7',
        '--g-accent': '#0f766e',
    },
};

export const GALLERY_THEME_OPTIONS: { key: GalleryThemeKey; label: string }[] = [
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
    { key: 'cream', label: 'Cream' },
    { key: 'stone', label: 'Stone' },
];

/** CSS-variable style object for a theme (falls back to dark). */
export function galleryThemeVars(key?: string | null): CSSProperties {
    return (GALLERY_THEMES[(key as GalleryThemeKey)] ?? GALLERY_THEMES.dark) as unknown as CSSProperties;
}
