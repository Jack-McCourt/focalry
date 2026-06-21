// All money is stored as integer minor units (cents). These helpers convert
// to/from the major-unit values shown in the UI.

export function formatMoney(cents: number, currency = 'gbp'): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
    }).format((cents ?? 0) / 100);
}

/** Parse a user-entered major-unit string (e.g. "1,250.50") into integer cents. */
export function toCents(value: string | number): number {
    const n = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Cents → plain major-unit string for editable inputs (e.g. 125050 → "1250.50"). */
export function centsToInput(cents: number): string {
    return ((cents ?? 0) / 100).toFixed(2);
}

/** The currency symbol for a code, e.g. "gbp" → "£", "usd" → "$", "eur" → "€". */
export function currencySymbol(currency = 'gbp'): string {
    try {
        const parts = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).formatToParts(0);
        return parts.find((p) => p.type === 'currency')?.value ?? '£';
    } catch {
        return '£';
    }
}
