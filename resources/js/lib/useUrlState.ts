import { usePage } from '@inertiajs/react';
import { useCallback, useState } from 'react';

/**
 * A piece of UI state (e.g. the active tab) mirrored to a URL query param, so a
 * refresh or shared link restores it instead of snapping back to the default.
 *
 * The initial value is read from Inertia's current URL (`usePage().url`), which
 * is identical on the server and the client — so there's no hydration mismatch
 * and no flash of the default tab. Updates are written straight to the address
 * bar with `history.replaceState` (preserving Inertia's history state), so
 * switching tabs stays instant with no server round-trip.
 *
 *   const [tab, setTab] = useUrlState('tab', 'general');
 */
export function useUrlState<T extends string>(key: string, defaultValue: T, allowed?: readonly T[]): [T, (value: T) => void] {
    const { url } = usePage();

    const [value, setValue] = useState<T>(() => {
        const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
        const raw = new URLSearchParams(q).get(key) as T | null;
        // Ignore unknown values (e.g. a hand-edited URL) so we never land on a
        // tab that doesn't exist.
        return raw && (!allowed || allowed.includes(raw)) ? raw : defaultValue;
    });

    const set = useCallback(
        (next: T) => {
            setValue(next);
            if (typeof window === 'undefined') {
                return;
            }
            const u = new URL(window.location.href);
            // Keep the default state out of the URL so the base link stays clean.
            if (next === defaultValue) {
                u.searchParams.delete(key);
            } else {
                u.searchParams.set(key, next);
            }
            window.history.replaceState(window.history.state, '', u);
        },
        [key, defaultValue],
    );

    return [value, set];
}
