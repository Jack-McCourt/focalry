import { buildSrcSet } from '@/lib/responsiveImage';
import { BlogPostCard, BlogState, SiteCategory } from '@/types';
import { useEffect, useState } from 'react';
import { containerW } from './ui';

export function BlogBlock({ d, posts, categories, slug, interactive, primary, width, blogState }: { d: Record<string, any>; posts?: BlogPostCard[]; categories?: SiteCategory[]; slug: string; interactive: boolean; primary: string; width?: string; blogState?: BlogState | null }) {
    const all = posts ?? [];
    const cols = Number(d.columns) === 2 ? 'sm:grid-cols-2' : Number(d.columns) === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
    const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

    // Server mode: on the live site a paginating blog block receives posts
    // already filtered + sliced (see PublicSiteController::paginatePosts), and
    // the filter/pager render as ?category / ?page links so every page is a
    // cacheable URL. Without blogState (builder preview, non-paginating blocks)
    // the original client-side filtering below applies.
    const server = blogState ?? null;
    const pageHref = (p: number, category: string | null) => {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (p > 1) params.set('page', String(p));
        const qs = params.toString();
        // A bare '?' resolves to the current path with no query (SSR-safe).
        return qs ? `?${qs}` : '?';
    };

    // Build the filter tree. Prefer the site's full category list (so empty parents
    // still appear); otherwise fall back to the categories the posts reference.
    const catList: SiteCategory[] = (categories && categories.length)
        ? categories
        : Array.from(new Map(all.flatMap((p) => p.categories ?? []).map((c) => [c.id, c])).values());
    const byId = new Map(catList.map((c) => [c.id, c]));
    // Only surface categories that actually have a (direct or descendant) post.
    // In server mode the shipped posts are just one page, so show the full list.
    const directIds = new Set(all.flatMap((p) => (p.categories ?? []).map((c) => c.id)));
    const ancestors = (id: number): number[] => {
        const out: number[] = [];
        let cur = byId.get(id)?.parent_id ?? null;
        while (cur != null) { out.push(cur); cur = byId.get(cur)?.parent_id ?? null; }
        return out;
    };
    // A category counts if a post sits in it or any of its descendants.
    const usableIds = new Set<number>();
    directIds.forEach((id) => { usableIds.add(id); ancestors(id).forEach((a) => usableIds.add(a)); });

    const tree = orderedCategoryTree(server ? catList : catList.filter((c) => usableIds.has(c.id)));
    const showFilter = d.show_categories !== false && tree.length > 1;
    const [active, setActive] = useState<number | null>(null);

    // Descendant ids of the active category (so a parent shows its children's posts).
    const descendantsOf = (id: number): Set<number> => {
        const set = new Set<number>([id]);
        let added = true;
        while (added) {
            added = false;
            for (const c of catList) {
                if (c.parent_id != null && set.has(c.parent_id) && !set.has(c.id)) { set.add(c.id); added = true; }
            }
        }
        return set;
    };
    const activeSet = !server && active != null ? descendantsOf(active) : null;
    const filtered = activeSet ? all.filter((p) => (p.categories ?? []).some((c) => activeSet.has(c.id))) : all;
    const limit = !server && Number(d.limit) > 0 ? Number(d.limit) : 0;
    const list = limit > 0 ? filtered.slice(0, limit) : filtered;

    // Optional pagination: "Posts per page" on the blog page (0 = show all).
    const perPage = Number(d.per_page) || 0;
    const [page, setPage] = useState(1);
    // Reset to the first page when the category filter changes.
    useEffect(() => setPage(1), [active]);
    const pageCount = server ? server.page_count : perPage > 0 ? Math.max(1, Math.ceil(list.length / perPage)) : 1;
    const currentPage = server ? server.page : Math.min(page, pageCount);
    const pageList = server ? list : perPage > 0 ? list.slice((currentPage - 1) * perPage, currentPage * perPage) : list;
    const activeCategorySlug = server?.category ?? null;

    return (
        <section className={`mx-auto ${containerW(width, 'max-w-6xl')} px-6 py-20 sm:px-10`}>
            {d.heading && <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}

            {showFilter && (
                <div className="mb-10 flex flex-wrap justify-center gap-2">
                    {(() => {
                        const pill = (isActive: boolean) =>
                            `rounded-full border px-4 py-1.5 text-sm font-medium transition ${isActive ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`;
                        const pillStyle = (isActive: boolean) => (isActive ? { backgroundColor: primary } : undefined);

                        // Server mode: filters are plain links (?category=…) so each
                        // combination is a real, cacheable URL.
                        if (server) {
                            return (
                                <>
                                    <a href={pageHref(1, null)} className={pill(activeCategorySlug === null)} style={pillStyle(activeCategorySlug === null)}>All</a>
                                    {tree.map(({ cat, depth }) => (
                                        <a key={cat.id} href={pageHref(1, cat.slug)} className={pill(activeCategorySlug === cat.slug)} style={pillStyle(activeCategorySlug === cat.slug)}>
                                            {depth > 0 && <span className="mr-1 text-neutral-300">{'—'.repeat(depth)}</span>}
                                            {cat.name}
                                        </a>
                                    ))}
                                </>
                            );
                        }

                        return (
                            <>
                                <button type="button" onClick={() => interactive && setActive(null)} className={pill(active === null)} style={pillStyle(active === null)}>All</button>
                                {tree.map(({ cat, depth }) => (
                                    <button key={cat.id} type="button" onClick={() => interactive && setActive(cat.id)} className={pill(active === cat.id)} style={pillStyle(active === cat.id)}>
                                        {depth > 0 && <span className="mr-1 text-neutral-300">{'—'.repeat(depth)}</span>}
                                        {cat.name}
                                    </button>
                                ))}
                            </>
                        );
                    })()}
                </div>
            )}

            {list.length === 0 ? (
                <p className="text-center text-sm text-neutral-400">No posts published yet.</p>
            ) : (
                <div className={`grid grid-cols-1 gap-8 ${cols}`}>
                    {pageList.map((p) => {
                        const href = p.url ?? `/site/${slug}/blog/${p.slug}`;
                        const cats = p.categories ?? [];
                        const inner = (
                            <>
                                {p.cover_image ? (
                                    <img src={p.cover_image} srcSet={buildSrcSet(p.cover_image) ?? undefined} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" alt="" loading="lazy" decoding="async" className="aspect-[3/2] w-full rounded-xl object-cover" />
                                ) : (
                                    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-300">Cover</div>
                                )}
                                <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
                                    {cats.length > 0 && <span className="font-semibold" style={{ color: primary }}>{cats.map((c) => c.name).join(', ')}</span>}
                                    {cats.length > 0 && p.published_at && <span>·</span>}
                                    {p.published_at && <span>{fmt(p.published_at)}</span>}
                                </div>
                                <h3 className="mt-1 text-lg font-semibold text-neutral-900">{p.title}</h3>
                                {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{p.excerpt}</p>}
                            </>
                        );
                        return interactive ? (
                            <a key={p.slug} href={href} className="group block">{inner}</a>
                        ) : (
                            <div key={p.slug} className="block">{inner}</div>
                        );
                    })}
                </div>
            )}

            {perPage > 0 && pageCount > 1 && (
                <div className="mt-14 flex flex-wrap items-center justify-center gap-2">
                    {(() => {
                        const prevNextCls = (enabled: boolean) =>
                            `rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-600 transition ${enabled ? 'hover:border-neutral-300' : 'pointer-events-none opacity-30'}`;
                        const numCls = (isCurrent: boolean) =>
                            `flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition ${isCurrent ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`;
                        const numStyle = (isCurrent: boolean) => (isCurrent ? { backgroundColor: primary } : undefined);
                        const nums = Array.from({ length: pageCount }, (_, i) => i + 1);

                        // Server mode: pagination is plain ?page links (SEO-crawlable,
                        // each page a cacheable URL).
                        if (server) {
                            return (
                                <>
                                    <a href={pageHref(currentPage - 1, activeCategorySlug)} rel="prev" className={prevNextCls(currentPage > 1)}>Prev</a>
                                    {nums.map((n) => (
                                        <a key={n} href={pageHref(n, activeCategorySlug)} className={numCls(n === currentPage)} style={numStyle(n === currentPage)}>{n}</a>
                                    ))}
                                    <a href={pageHref(currentPage + 1, activeCategorySlug)} rel="next" className={prevNextCls(currentPage < pageCount)}>Next</a>
                                </>
                            );
                        }

                        return (
                            <>
                                <button type="button" disabled={currentPage <= 1} onClick={() => interactive && setPage(currentPage - 1)} className={prevNextCls(currentPage > 1)}>Prev</button>
                                {nums.map((n) => (
                                    <button key={n} type="button" onClick={() => interactive && setPage(n)} className={numCls(n === currentPage)} style={numStyle(n === currentPage)}>{n}</button>
                                ))}
                                <button type="button" disabled={currentPage >= pageCount} onClick={() => interactive && setPage(currentPage + 1)} className={prevNextCls(currentPage < pageCount)}>Next</button>
                            </>
                        );
                    })()}
                </div>
            )}
        </section>
    );
}

/** Depth-first category ordering with depth, for indented filter rendering. */
function orderedCategoryTree(categories: SiteCategory[]): { cat: SiteCategory; depth: number }[] {
    const out: { cat: SiteCategory; depth: number }[] = [];
    const present = new Set(categories.map((c) => c.id));
    const walk = (parentId: number | null, depth: number) => {
        for (const cat of categories.filter((c) => (c.parent_id != null && present.has(c.parent_id) ? c.parent_id : null) === parentId)) {
            out.push({ cat, depth });
            walk(cat.id, depth + 1);
        }
    };
    walk(null, 0);
    return out;
}
