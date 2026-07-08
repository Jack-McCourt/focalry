import { SiteTheme } from '@/types';
import { HeroSection } from './HeroSection';
import { usePostMeta } from './PostContext';

/**
 * The blog post header, as a regular block. The post supplies the heading,
 * cover image, date and categories (via PostMeta context); the block's own
 * `data` supplies only the hero-style visual design (overlay, position, height…),
 * so it offers the exact same formatting options as a hero block.
 *
 * On a non-post page (no post context) it renders a builder-only placeholder,
 * since there's no post to draw a title/cover from.
 */
export function PostHeaderBlock({ d, theme, editing }: { d: Record<string, any>; theme: SiteTheme; editing?: unknown }) {
    const post = usePostMeta();
    const primary = theme.primary_color || '#111827';
    const fmt = (s: string | null) =>
        s ? new Date(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

    if (!post) {
        // No post to render (e.g. added on a normal page). Only the builder ever
        // sees this; the picker offers this block on posts only.
        return editing ? (
            <div className="flex min-h-[160px] items-center justify-center bg-neutral-100 px-6 text-center text-sm text-neutral-400">
                Post header — shows the post's cover image, title, date &amp; categories. Add this block on a blog post.
            </div>
        ) : null;
    }

    const cats = post.categories ?? [];

    // Post-supplied content + sensible header defaults, overridden by the block's
    // saved design (`d`). Merge order matters: post content wins over d.heading.
    const hero: Record<string, unknown> = {
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
        ...d,
        heading: post.title,
        image_url: post.cover_image || '',
        alt: post.title,
        focal_x: post.cover_focal?.x ?? 50,
        focal_y: post.cover_focal?.y ?? 50,
    };

    return (
        <header>
            <HeroSection d={hero} theme={theme} />

            {(cats.length > 0 || post.published_at || post.author || post.reading_minutes) && (
                <div className="mx-auto max-w-3xl px-6 pt-8 sm:px-10">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-wider text-neutral-400">
                        {cats.length > 0 && (
                            <span className="font-semibold" style={{ color: primary }}>{cats.map((c) => c.name).join(', ')}</span>
                        )}
                        {cats.length > 0 && (post.published_at || post.author) && <span>·</span>}
                        {post.author && <span>By {post.author}</span>}
                        {post.author && post.published_at && <span>·</span>}
                        {post.published_at && <span>{fmt(post.published_at)}</span>}
                        {!!post.reading_minutes && (
                            <>
                                <span>·</span>
                                <span>{post.reading_minutes} min read</span>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
