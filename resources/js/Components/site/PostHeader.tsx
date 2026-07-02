import { SiteCategory, SiteTheme } from '@/types';
import { HeroSection } from './blocks';

export interface PostMeta {
    title: string;
    cover_image: string | null;
    cover_focal?: { x: number; y: number } | null;
    published_at: string | null;
    categories: SiteCategory[];
    /** Hero-style formatting options (mirrors the hero block's data keys). */
    header?: Record<string, unknown> | null;
}

/**
 * Auto-generated header for a blog post page: a hero (using the post's cover
 * image with the title overlaid) followed by the publish date and the categories
 * the post belongs to. The hero shares the hero block's renderer, so it offers
 * the same formatting options (overlay, gradient/panel, position, height, …).
 *
 * In the builder, pass `onEdit` to make the header clickable (jumps to the post
 * settings where its options live).
 */
export default function PostHeader({ post, theme, onEdit }: { post: PostMeta; theme: SiteTheme; onEdit?: () => void }) {
    const primary = theme.primary_color || '#111827';
    const cats = post.categories ?? [];
    const h = post.header ?? {};
    const fmt = (s: string | null) =>
        s ? new Date(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

    // Sensible defaults that look good for a post header; overridable via `header`.
    const d: Record<string, unknown> = {
        heading: post.title,
        image_url: post.cover_image || '',
        alt: post.title,
        focal_x: post.cover_focal?.x ?? 50,
        focal_y: post.cover_focal?.y ?? 50,
        overlay: 35,
        content_x: 'center',
        content_y: 'center',
        text_align: 'center',
        title_size: 'lg',
        text_shadow: 'soft',
        height: 'default',
        text_bg: 'none',
        text_bg_color: '#000000',
        text_bg_opacity: 60,
        text_bg_extent: 65,
        ...h,
    };

    return (
        <header>
            <div className={onEdit ? 'group relative cursor-pointer' : undefined} onClick={onEdit} role={onEdit ? 'button' : undefined}>
                {onEdit && (
                    <span className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                        Edit header design on the Blog page
                    </span>
                )}
                <HeroSection d={d} theme={theme} />
            </div>

            {(cats.length > 0 || post.published_at) && (
                <div className="mx-auto max-w-3xl px-6 pt-8 sm:px-10">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
                        {cats.length > 0 && (
                            <span className="font-semibold" style={{ color: primary }}>{cats.map((c) => c.name).join(', ')}</span>
                        )}
                        {cats.length > 0 && post.published_at && <span>·</span>}
                        {post.published_at && <span>{fmt(post.published_at)}</span>}
                    </div>
                </div>
            )}
        </header>
    );
}
