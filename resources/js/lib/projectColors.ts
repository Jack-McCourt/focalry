import type { CSSProperties } from 'react';

// Palette offered in colour pickers for statuses / types / select options.
export const COLOR_PALETTE = [
    '#ef4444', '#f43f5e', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1',
    '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16',
    '#eab308', '#f59e0b', '#f97316', '#64748b', '#6b7280', '#78716c',
];

const FALLBACK = '#6b7280';

/** Soft pill: coloured text on a tinted background (8-digit hex adds alpha). */
export function pillStyle(hex?: string | null): CSSProperties {
    const c = hex || FALLBACK;
    return { color: c, backgroundColor: `${c}1a`, borderColor: `${c}33` };
}

/** Solid colour dot / strip. */
export function dotStyle(hex?: string | null): CSSProperties {
    return { backgroundColor: hex || FALLBACK };
}
