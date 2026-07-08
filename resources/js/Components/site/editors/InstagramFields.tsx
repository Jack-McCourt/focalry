import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { BlockEditorFieldsProps, Field, Select, Text, Toggle } from './fields';

/**
 * Instagram feed editor. Connection lives on the site (OAuth, server-side);
 * "Load latest posts" snapshots media into the block (images mirrored to our
 * bucket) so the public site never calls Instagram.
 */
export function InstagramFields({ d, onChange }: BlockEditorFieldsProps) {
    const set = (key: string, val: unknown) => onChange({ ...d, [key]: val });
    const ig = (usePage().props as any).site?.instagram as { available: boolean; connected: boolean; username: string | null } | undefined;
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const count = Array.isArray(d.items) ? d.items.length : 0;
    const fetchedAt = d.fetched_at ? new Date(d.fetched_at) : null;

    const load = async () => {
        setBusy(true);
        setNotice(null);
        try {
            const res = await (window as any).axios.post(route('website.instagram.fetch'), { limit: Math.max(Number(d.limit) || 8, 12) });
            onChange({ ...d, items: res.data.items ?? [], username: res.data.username ?? null, fetched_at: new Date().toISOString() });
            setNotice({ kind: 'ok', text: `Loaded ${(res.data.items ?? []).length} posts. Publish to put them live.` });
        } catch (e: any) {
            setNotice({ kind: 'error', text: e?.response?.data?.message ?? 'Could not load posts — try reconnecting Instagram.' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            {!ig?.available ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Instagram isn't set up on this platform yet (missing INSTAGRAM_CLIENT_ID/SECRET).
                </p>
            ) : !ig.connected ? (
                <>
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                        Connect the studio's Instagram (business or creator account) to pull in your latest posts.
                    </p>
                    <a href={route('website.instagram.connect')} className="btn-primary w-full justify-center">Connect Instagram</a>
                </>
            ) : (
                <>
                    <div className="rounded-lg border border-neutral-200 p-3">
                        <p className="text-sm font-medium text-neutral-900">@{ig.username ?? 'connected'}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                            {count} posts loaded{fetchedAt ? ` · updated ${fetchedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                    </div>
                    {notice && (
                        <p className={`rounded-lg px-3 py-2 text-xs ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{notice.text}</p>
                    )}
                    <button type="button" onClick={load} disabled={busy} className="btn-primary w-full justify-center">
                        {busy ? 'Loading…' : count > 0 ? 'Refresh posts' : 'Load latest posts'}
                    </button>
                </>
            )}

            <Text label="Heading" value={d.heading} onChange={(v) => set('heading', v)} />
            <Select label="Columns" value={String(d.columns ?? 4)} onChange={(v) => set('columns', Number(v))} options={[{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '6', label: '6' }]} />
            <Field label="Number of posts">
                <input type="number" min={1} max={24} className="input" value={Number(d.limit) || 8} onChange={(e) => set('limit', Number(e.target.value))} />
            </Field>
            <Toggle label="Show captions on hover" value={!!d.show_captions} onChange={(v) => set('show_captions', v)} />
            <p className="text-xs text-neutral-400">Posts are a saved snapshot — refresh here any time; your live site never calls Instagram.</p>
        </div>
    );
}
