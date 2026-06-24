import { SiteTheme } from '@/types';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BlockView, GoogleBusiness, GoogleG, GoogleReview, Stars } from './blocks';

interface SearchResult {
    place_id: string;
    name: string;
    address: string;
}

/**
 * The Google Reviews configuration popup, opened from the block's "Connect"
 * call-to-action (or the sidebar). Gives more room than the sidebar to find the
 * business, pull reviews, and tune the display — then writes the result + a
 * cached snapshot of the reviews back into the block on Save.
 */
export default function GoogleReviewsModal({
    open,
    theme,
    data,
    onChange,
    onClose,
}: {
    open: boolean;
    theme: SiteTheme;
    data: Record<string, any>;
    onChange: (data: Record<string, unknown>) => void;
    onClose: () => void;
}) {
    const [cfg, setCfg] = useState<Record<string, any>>(data);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-seed the working copy each time the popup is opened.
    useEffect(() => {
        if (open) {
            setCfg(data);
            setQuery('');
            setResults([]);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const set = (key: string, val: unknown) => setCfg((c) => ({ ...c, [key]: val }));

    const business: GoogleBusiness | null = cfg.business ?? null;
    const reviews: GoogleReview[] = Array.isArray(cfg.reviews) ? cfg.reviews : [];

    const search = async () => {
        if (!query.trim()) return;
        setSearching(true);
        setError(null);
        try {
            const res = await (window as any).axios.post(route('website.google-reviews.search'), { query });
            setResults(res.data.results ?? []);
            if ((res.data.results ?? []).length === 0) setError('No businesses matched that search.');
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Search failed. Try again.');
        } finally {
            setSearching(false);
        }
    };

    const loadReviews = async (placeId?: string) => {
        const id = (placeId ?? cfg.place_id ?? '').trim();
        if (!id) {
            setError('Enter or pick a Place ID first.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await (window as any).axios.post(route('website.google-reviews'), { place_id: id });
            const d = res.data;
            setCfg((c) => ({
                ...c,
                place_id: d.place_id,
                business: { place_id: d.place_id, name: d.name, rating: d.rating, total: d.total, url: d.url },
                reviews: d.reviews ?? [],
                fetched_at: new Date().toISOString(),
            }));
            if ((d.reviews ?? []).length === 0) setError('Google returned no reviews for this place yet.');
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'Could not load reviews.');
        } finally {
            setLoading(false);
        }
    };

    const pick = (r: SearchResult) => {
        setCfg((c) => ({ ...c, place_id: r.place_id }));
        setResults([]);
        setQuery(r.name);
        loadReviews(r.place_id);
    };

    const save = () => {
        onChange(cfg);
        onClose();
    };

    const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500';

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <GoogleG className="h-6 w-6" />
                        <h2 className="text-base font-semibold text-neutral-900">Google Reviews</h2>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body: 2-column form on top, full-width preview below */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 md:grid-cols-2">
                        {/* Step 1 — connect */}
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-900">1. Find your business</h3>
                            <div className="mt-3 flex gap-2">
                                <input
                                    className="input flex-1"
                                    placeholder="Business name + town"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && search()}
                                />
                                <button onClick={search} disabled={searching} className="btn-secondary shrink-0">
                                    {searching ? 'Searching…' : 'Search'}
                                </button>
                            </div>

                            {results.length > 0 && (
                                <div className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
                                    {results.map((r) => (
                                        <button key={r.place_id} onClick={() => pick(r)} className="block w-full px-3 py-2 text-left hover:bg-neutral-50">
                                            <span className="block text-sm font-medium text-neutral-800">{r.name}</span>
                                            <span className="block truncate text-xs text-neutral-400">{r.address}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3">
                                <label className={labelCls}>…or paste a Google Place ID</label>
                                <div className="flex gap-2">
                                    <input className="input flex-1" placeholder="ChIJ…" value={cfg.place_id ?? ''} onChange={(e) => set('place_id', e.target.value)} />
                                    <button onClick={() => loadReviews()} disabled={loading} className="btn-secondary shrink-0">
                                        {loading ? 'Loading…' : 'Load reviews'}
                                    </button>
                                </div>
                                <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                                    Find your Place ID →
                                </a>
                            </div>

                            {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>}

                            {business && (
                                <div className="mt-3 flex items-center gap-3 rounded-lg bg-neutral-50 px-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-neutral-900">{business.name}</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-semibold text-neutral-900">{(business.rating ?? 0).toFixed(1)}</span>
                                            <Stars value={business.rating ?? 0} />
                                            <span className="text-xs text-neutral-400">({business.total.toLocaleString()})</span>
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-xs font-medium text-emerald-600">{reviews.length} loaded</span>
                                </div>
                            )}
                        </div>

                        {/* Step 2 — display */}
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-900">2. Display options</h3>
                            <div className="mt-3 space-y-3">
                                <div>
                                    <label className={labelCls}>Heading</label>
                                    <input className="input" value={cfg.heading ?? ''} onChange={(e) => set('heading', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls}>Subheading</label>
                                    <input className="input" value={cfg.subheading ?? ''} onChange={(e) => set('subheading', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Layout</label>
                                        <select className="input" value={cfg.layout ?? 'grid'} onChange={(e) => set('layout', e.target.value)}>
                                            <option value="grid">Grid</option>
                                            <option value="list">List</option>
                                            <option value="carousel">Carousel</option>
                                            <option value="badge">Rating badge</option>
                                        </select>
                                    </div>
                                    {cfg.layout === 'grid' && (
                                        <div>
                                            <label className={labelCls}>Columns</label>
                                            <select className="input" value={String(cfg.columns ?? 3)} onChange={(e) => set('columns', Number(e.target.value))}>
                                                <option value="2">2</option>
                                                <option value="3">3</option>
                                                <option value="4">4</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {cfg.layout === 'carousel' && (
                                    <div className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                                        <div>
                                            <label className={labelCls}>Reviews per slide</label>
                                            <select className="input" value={String(Number(cfg.per_view) || 3)} onChange={(e) => set('per_view', Number(e.target.value))}>
                                                <option value="1">1 at a time</option>
                                                <option value="2">2 at a time</option>
                                                <option value="3">3 at a time</option>
                                            </select>
                                            <p className="mt-1 text-xs text-neutral-400">Shows fewer on narrow screens automatically.</p>
                                        </div>
                                        <ToggleRow label="Autoplay" value={cfg.autoplay !== false} onChange={(v) => set('autoplay', v)} />
                                        {cfg.autoplay !== false && (
                                            <div>
                                                <label className={labelCls}>Autoplay speed (seconds)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={30}
                                                    className="input"
                                                    value={Number(cfg.speed) > 0 ? Number(cfg.speed) : 5}
                                                    onChange={(e) => set('speed', Number(e.target.value))}
                                                />
                                            </div>
                                        )}
                                        {cfg.show_summary !== false && (
                                            <ToggleRow
                                                label="Rating summary inline (beside carousel)"
                                                value={!!cfg.summary_inline}
                                                onChange={(v) => set('summary_inline', v)}
                                            />
                                        )}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Max reviews</label>
                                        <input type="number" min={1} max={5} className="input" value={Math.min(5, Number(cfg.max) || 5)} onChange={(e) => set('max', Math.min(5, Number(e.target.value)))} />
                                        <p className="mt-1 text-xs text-neutral-400">Google only provides up to 5 reviews.</p>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Minimum rating</label>
                                        <select className="input" value={String(cfg.min_rating ?? 0)} onChange={(e) => set('min_rating', Number(e.target.value))}>
                                            <option value="0">Any rating</option>
                                            <option value="3">3★ and up</option>
                                            <option value="4">4★ and up</option>
                                            <option value="5">5★ only</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <ToggleRow label="Overall rating summary" value={cfg.show_summary !== false} onChange={(v) => set('show_summary', v)} />
                                    <ToggleRow label="Reviewer photos" value={cfg.show_avatar !== false} onChange={(v) => set('show_avatar', v)} />
                                    <ToggleRow label="Review dates" value={cfg.show_date !== false} onChange={(v) => set('show_date', v)} />
                                    <ToggleRow label="Link to Google" value={cfg.link_to_google !== false} onChange={(v) => set('link_to_google', v)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live preview — full width, below the form */}
                    <div className="border-t border-neutral-100 bg-neutral-50 p-6">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Preview</p>
                        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-950/5">
                            {reviews.length > 0 || (cfg.layout === 'badge' && business) ? (
                                <BlockView block={{ id: 'rv-preview', type: 'reviews', data: cfg }} theme={theme} slug="" interactive={false} />
                            ) : (
                                <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-neutral-400">
                                    Load your reviews to see a preview.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={save} className="btn-primary">Save</button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-2">
            <span className="text-sm text-neutral-700">{label}</span>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={`relative h-5 w-9 rounded-full transition ${value ? 'bg-neutral-900' : 'bg-neutral-300'}`}
            >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
        </label>
    );
}
