import { SiteBlock } from '@/types';
import { BlockEditing } from './registry';
import { RetryImg } from './ui';

/**
 * Instagram feed: renders the snapshot cached in the block's data (loaded via
 * the editor's "Load posts", images mirrored to our bucket). Unconfigured, the
 * builder shows a connect CTA; the live site renders nothing.
 */
export function InstagramBlock({ block, d, primary, editing }: { block: SiteBlock; d: Record<string, any>; primary: string; editing?: BlockEditing }) {
    const items: { id: string; image: string; permalink: string; caption: string }[] = Array.isArray(d.items) ? d.items : [];
    const limit = Number(d.limit) > 0 ? Number(d.limit) : 8;
    const shown = items.slice(0, limit);
    const cols = Number(d.columns) === 3 ? 'grid-cols-2 sm:grid-cols-3' : Number(d.columns) === 6 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4';

    if (shown.length === 0) {
        if (editing?.onConfigure ?? editing?.onSelect) {
            return (
                <section className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
                    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
                        <svg className="h-9 w-9 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" /></svg>
                        <h3 className="mt-4 text-lg font-semibold text-neutral-900">Instagram feed</h3>
                        <p className="mt-1 max-w-sm text-sm text-neutral-500">Connect your Instagram and load your latest posts from this block's settings.</p>
                    </div>
                </section>
            );
        }
        return null;
    }

    return (
        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
            <div className="mb-8 text-center">
                {d.heading && <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                {d.username && (
                    <a href={`https://www.instagram.com/${d.username}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium hover:underline" style={{ color: primary }}>
                        @{d.username}
                    </a>
                )}
            </div>
            <div className={`grid gap-2 ${cols}`}>
                {shown.map((m) => (
                    <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg">
                        <RetryImg src={m.image} alt={m.caption || 'Instagram post'} loading="lazy" className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105" />
                        {d.show_captions && m.caption && (
                            <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                                <span className="line-clamp-3 text-xs leading-snug text-white">{m.caption}</span>
                            </span>
                        )}
                    </a>
                ))}
            </div>
        </section>
    );
}
