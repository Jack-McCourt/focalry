import { useState } from 'react';
import type { BlockEditorFieldsProps } from './fields';

/**
 * Reviews are a snapshot cached in the block's data (the public site never
 * calls Google), so they go stale as new reviews arrive. This panel shows the
 * connected business + when the snapshot was taken, and offers a one-click
 * "Refresh reviews" that re-fetches from Google using the saved Place ID.
 */
export function ReviewsFields({ d, onChange, onConfigure }: BlockEditorFieldsProps) {
    const [refreshing, setRefreshing] = useState(false);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const business = d.business;
    const count = Array.isArray(d.reviews) ? d.reviews.length : 0;
    const placeId: string = (d.place_id ?? business?.place_id ?? '').trim();
    const fetchedAt = d.fetched_at ? new Date(d.fetched_at) : null;

    const refresh = async () => {
        if (!placeId || refreshing) return;
        setRefreshing(true);
        setNotice(null);
        try {
            const res = await (window as any).axios.post(route('website.google-reviews'), { place_id: placeId });
            const g = res.data;
            onChange({
                ...d,
                place_id: g.place_id,
                business: { place_id: g.place_id, name: g.name, rating: g.rating, total: g.total, url: g.url },
                reviews: g.reviews ?? [],
                fetched_at: new Date().toISOString(),
            });
            setNotice({ kind: 'ok', text: `Updated — ${(g.reviews ?? []).length} reviews loaded. Publish to put them live.` });
        } catch (e: any) {
            setNotice({ kind: 'error', text: e?.response?.data?.message ?? 'Could not refresh reviews. Try again in a minute.' });
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="space-y-4">
            {business ? (
                <div className="rounded-lg border border-neutral-200 p-3">
                    <p className="text-sm font-medium text-neutral-900">{business.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                        {(business.rating ?? 0).toFixed(1)}★ · {business.total?.toLocaleString?.() ?? business.total} reviews · {count} loaded
                    </p>
                    {fetchedAt && (
                        <p className="mt-0.5 text-xs text-neutral-400">
                            Last updated {fetchedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    )}
                </div>
            ) : (
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                    Not connected yet. Open the configuration popup to find your business and load reviews.
                </p>
            )}

            {notice && (
                <p className={`rounded-lg px-3 py-2 text-xs ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {notice.text}
                </p>
            )}

            {business && placeId && (
                <button type="button" onClick={refresh} disabled={refreshing} className="btn-primary w-full justify-center">
                    <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    {refreshing ? 'Refreshing…' : 'Refresh reviews'}
                </button>
            )}

            <button type="button" onClick={onConfigure} className={`${business ? 'btn-secondary' : 'btn-primary'} w-full justify-center`}>
                {business ? 'Edit Google Reviews' : 'Connect Google Reviews'}
            </button>

            <p className="text-xs text-neutral-400">
                Reviews are a saved snapshot — the live site never calls Google. Refresh pulls the latest from your Google listing (up to 5).
            </p>
        </div>
    );
}
