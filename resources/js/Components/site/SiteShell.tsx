import { BlogPostCard, SiteBlock, SiteNavItem, SiteTheme } from '@/types';
import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';
import { BlockEditing, BlockView, fontClass } from './blocks';

interface PageRef {
    title: string;
    slug: string;
    is_home: boolean;
}

interface SiteShellProps {
    siteName: string;
    siteSlug: string;
    theme: SiteTheme;
    studioLogo?: string | null;
    pages: PageRef[];
    headerNav: SiteNavItem[];
    footerNav: SiteNavItem[];
    blocks?: SiteBlock[];
    activeSlug: string;
    interactive: boolean;
    posts?: BlogPostCard[];
    /** Builder-only: makes blocks clickable/editable in the preview. */
    editing?: BlockEditing;
    /** Custom main content (e.g. a blog post), rendered instead of blocks. */
    children?: ReactNode;
}

interface ResolvedLink {
    label: string;
    href: string;
    external: boolean;
    active: boolean;
}

/** Renders a full public page: managed global header, the page's blocks, and a
 *  managed global footer. Shared by the live public site and the builder preview. */
export default function SiteShell({ siteName, siteSlug, theme, studioLogo, pages, headerNav, footerNav, blocks = [], activeSlug, interactive, posts, editing, children }: SiteShellProps) {
    const resolve = (item: SiteNavItem): ResolvedLink => {
        if (item.kind === 'url') {
            const target = item.target || '#';
            return { label: item.label, href: target, external: /^https?:\/\//i.test(target), active: false };
        }
        const page = pages.find((p) => p.slug === item.target);
        const isHome = page?.is_home ?? item.target === 'home';
        return {
            label: item.label,
            href: isHome ? `/site/${siteSlug}` : `/site/${siteSlug}/${item.target}`,
            external: false,
            active: item.target === activeSlug,
        };
    };

    // Fall back to page-derived nav if the studio hasn't set a header menu.
    const fallback: SiteNavItem[] = pages.map((p) => ({ label: p.title, kind: 'page', target: p.slug }));
    const header = (headerNav.length > 0 ? headerNav : fallback).map(resolve);
    const footer = footerNav.map(resolve);

    const renderLink = (l: ResolvedLink, cls: string, key: number) => {
        if (!interactive) return <span key={key} className={cls}>{l.label}</span>;
        if (l.external) return <a key={key} href={l.href} target="_blank" rel="noreferrer" className={cls}>{l.label}</a>;
        return <Link key={key} href={l.href} className={cls}>{l.label}</Link>;
    };

    return (
        <div className={`min-h-screen bg-white text-neutral-900 ${fontClass(theme)}`}>
            <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
                    {interactive ? (
                        <Link href={`/site/${siteSlug}`} className="flex items-center gap-2">
                            {studioLogo ? <img src={studioLogo} alt={siteName} className="h-8 w-auto object-contain" /> : <span className="text-base font-semibold tracking-tight">{siteName}</span>}
                        </Link>
                    ) : (
                        <span className="flex items-center gap-2">
                            {studioLogo ? <img src={studioLogo} alt={siteName} className="h-8 w-auto object-contain" /> : <span className="text-base font-semibold tracking-tight">{siteName}</span>}
                        </span>
                    )}
                    {header.length > 0 && (
                        <nav className="flex items-center gap-1">
                            {header.map((l, i) => renderLink(l, `rounded-full px-3 py-1.5 text-sm font-medium transition ${l.active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`, i))}
                        </nav>
                    )}
                </div>
            </header>

            <main>
                {children ? (
                    children
                ) : blocks.length === 0 ? (
                    <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-400">This page has no content yet.</div>
                ) : (
                    blocks.map((block) => <BlockView key={block.id} block={block} theme={theme} slug={siteSlug} interactive={interactive} posts={posts} editing={editing} />)
                )}
            </main>

            <footer className="border-t border-neutral-100 bg-neutral-50 px-6 py-12 sm:px-10">
                <div className="mx-auto max-w-6xl text-center">
                    <p className="text-base font-semibold tracking-tight text-neutral-900">{siteName}</p>
                    {footer.length > 0 && (
                        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                            {footer.map((l, i) => renderLink(l, 'text-sm text-neutral-500 hover:text-neutral-900', i))}
                        </nav>
                    )}
                    <p className="mt-6 text-xs text-neutral-400">© {new Date().getFullYear()} {siteName}</p>
                </div>
            </footer>
        </div>
    );
}
