import { googleFontsHref, siteFont } from '@/lib/siteFonts';
import { BlogPostCard, PackageCard, SiteBlock, SiteNavItem, SiteTheme } from '@/types';
import { Link } from '@inertiajs/react';
import { CSSProperties, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { BlockEditing, BlockView } from './blocks';

interface PageRef {
    title: string;
    slug: string;
    is_home: boolean;
}

interface SiteShellProps {
    siteName: string;
    siteSlug: string;
    /** URL prefix for in-site links: "/site/{slug}" normally, "" on a custom domain. */
    basePath?: string;
    theme: SiteTheme;
    studioLogo?: string | null;
    pages: PageRef[];
    headerNav: SiteNavItem[];
    footerNav: SiteNavItem[];
    blocks?: SiteBlock[];
    activeSlug: string;
    interactive: boolean;
    posts?: BlogPostCard[];
    packages?: PackageCard[];
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

/**
 * Per-theme "style preset" CSS, scoped to the site, layered on top of the font
 * rules. Lets a template change its whole feel (heading treatment, nav, rules,
 * section rhythm) without per-block edits.
 */
function styleCss(scope: string, style?: string): string {
    if (style === 'studio') {
        return (
            // Boutique studio: centred masthead, widely-spaced uppercase wordmark
            // and nav for a clean, gallery-like feel.
            `.${scope} .site-nav-link{text-transform:uppercase;letter-spacing:0.2em;font-size:0.7rem;font-weight:500;}` +
            `.${scope} .site-logo-font{text-transform:uppercase;letter-spacing:0.34em;font-weight:500;}`
        );
    }

    if (style === 'editorial') {
        return (
            // Magazine masthead nav: small, uppercase, widely tracked.
            `.${scope} .site-nav-link{text-transform:uppercase;letter-spacing:0.22em;font-size:0.7rem;font-weight:500;}` +
            // Dramatic serif display headings with tighter tracking + an italic lede feel.
            `.${scope} :is(h1,h2,h3){letter-spacing:-0.01em;line-height:1.05;}` +
            // Editorial section headings: centred with a thin rule beneath.
            `.${scope} main h2{position:relative;padding-bottom:0.6rem;}` +
            `.${scope} main h2::after{content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:46px;height:2px;background:currentColor;opacity:0.35;}` +
            // Wider, airier wordmark.
            `.${scope} .site-logo-font{letter-spacing:0.04em;}`
        );
    }

    return '';
}

/** Renders a full public page: managed global header, the page's blocks, and a
 *  managed global footer. Shared by the live public site and the builder preview. */
export default function SiteShell({ siteName, siteSlug, basePath, theme, studioLogo, pages, headerNav, footerNav, blocks = [], activeSlug, interactive, posts, packages, editing, children }: SiteShellProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    // Default to the slug path; custom-domain serving passes "" for root links.
    const base = basePath ?? `/site/${siteSlug}`;
    const homeHref = base || '/';

    // Per-theme header sizing (full, responsive class names so Tailwind keeps them).
    const navSize = ({ sm: 'text-sm', base: 'text-base', lg: 'text-lg' } as Record<string, string>)[theme.nav_size ?? 'sm'] ?? 'text-sm';
    const logoSize = ({
        sm: 'text-base',
        md: 'text-lg lg:text-xl',
        lg: 'text-xl lg:text-2xl',
        xl: 'text-xl lg:text-2xl xl:text-3xl',
    } as Record<string, string>)[theme.logo_size ?? 'sm'] ?? 'text-base';

    // Expose the (sticky) header's height as a CSS variable so a full-height hero
    // can fill exactly the space beneath the nav instead of overflowing past it.
    const headerRef = useRef<HTMLElement>(null);
    const [headerH, setHeaderH] = useState(64);
    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        const update = () => setHeaderH(el.offsetHeight);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const resolve = (item: SiteNavItem): ResolvedLink => {
        if (item.kind === 'url') {
            const target = item.target || '#';
            return { label: item.label, href: target, external: /^https?:\/\//i.test(target), active: false };
        }
        const page = pages.find((p) => p.slug === item.target);
        const isHome = page?.is_home ?? item.target === 'home';
        return {
            label: item.label,
            href: isHome ? homeHref : `${base}/${item.target}`,
            external: false,
            active: item.target === activeSlug,
        };
    };

    // Fall back to page-derived nav if the studio hasn't set a header menu.
    const fallback: SiteNavItem[] = pages.map((p) => ({ label: p.title, kind: 'page', target: p.slug }));
    const header = (headerNav.length > 0 ? headerNav : fallback).map(resolve);
    const footer = footerNav.map(resolve);

    const logoColor = theme.logo_color || undefined;
    const navColor = theme.nav_color || undefined;

    const renderLink = (l: ResolvedLink, cls: string, key: number, style?: CSSProperties) => {
        if (!interactive) return <span key={key} className={cls} style={style}>{l.label}</span>;
        if (l.external) return <a key={key} href={l.href} target="_blank" rel="noreferrer" className={cls} style={style}>{l.label}</a>;
        return <Link key={key} href={l.href} className={cls} style={style}>{l.label}</Link>;
    };

    // Resolve fonts: body + headings, with the logo/menu inheriting the body
    // font unless a dedicated logo font is chosen. A scoped class keeps the
    // heading rule from leaking outside this site.
    const scope = `sf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const bodyFont = siteFont(theme.body_font ?? theme.font);
    const headingFont = siteFont(theme.heading_font ?? theme.font);
    const logoFont = theme.logo_font ? siteFont(theme.logo_font) : bodyFont;
    const fontsHref = googleFontsHref([theme.body_font ?? theme.font, theme.heading_font ?? theme.font, theme.logo_font]);
    const fontCss =
        `.${scope}{font-family:${bodyFont.stack};${bodyFont.weight ? `font-weight:${bodyFont.weight};` : ''}}` +
        `.${scope} :is(h1,h2,h3,h4,h5,h6){font-family:${headingFont.stack};${headingFont.headingWeight ? `font-weight:${headingFont.headingWeight};` : ''}}` +
        `.${scope} .site-logo-font{font-family:${logoFont.stack};${logoFont.weight ? `font-weight:${logoFont.weight};` : ''}}` +
        styleCss(scope, theme.style) +
        // "Wide" templates bump the main content container up one size (6xl → 7xl).
        (theme.width === 'wide' ? `.${scope} .max-w-6xl{max-width:80rem;}` : '');

    // The Studio style uses a centred masthead instead of the inline logo/nav row.
    const centeredHeader = theme.style === 'studio';

    const logoMark = studioLogo
        ? <img src={studioLogo} alt={siteName} className="h-8 w-auto object-contain" />
        : <span className={`site-logo-font font-semibold tracking-tight ${logoSize}`} style={logoColor ? { color: logoColor } : undefined}>{siteName}</span>;
    const logoLink = interactive
        ? <Link href={homeHref} className="flex items-center gap-2">{logoMark}</Link>
        : <span className="flex items-center gap-2">{logoMark}</span>;

    const menuButton = (extra: string) => (
        <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className={`${extra} inline-flex items-center justify-center rounded-md p-2 text-neutral-700 md:hidden`}
        >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {menuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />}
            </svg>
        </button>
    );

    return (
        <div className={`${scope} min-h-screen bg-white text-neutral-900`} style={{ ['--site-header-h' as string]: `${headerH}px` }}>
            {fontsHref && <link rel="stylesheet" href={fontsHref} />}
            <style dangerouslySetInnerHTML={{ __html: fontCss }} />
            <header ref={headerRef} className="sticky top-0 z-20 border-b border-neutral-100 bg-white/85 backdrop-blur">
                {centeredHeader ? (
                    // Studio: centred masthead — wordmark on top, nav centred beneath.
                    <div className="mx-auto max-w-6xl px-6 py-5 sm:px-10">
                        <div className="relative flex items-center justify-center">
                            {logoLink}
                            {header.length > 0 && menuButton('absolute right-0 top-1/2 -translate-y-1/2')}
                        </div>
                        {header.length > 0 && (
                            <nav className="mt-3 hidden flex-wrap items-center justify-center gap-x-2 gap-y-1 md:flex">
                                {header.map((l, i) => renderLink(l, `site-nav-link site-logo-font px-2.5 py-1 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.7 } : undefined))}
                            </nav>
                        )}
                    </div>
                ) : (
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
                        {logoLink}
                        {header.length > 0 && (
                            <>
                                <nav className="hidden items-center gap-1 md:flex">
                                    {header.map((l, i) => renderLink(l, `site-nav-link site-logo-font rounded-full px-3 py-1.5 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.7 } : undefined))}
                                </nav>
                                {menuButton('-mr-1')}
                            </>
                        )}
                    </div>
                )}
                {header.length > 0 && menuOpen && (
                    <nav className="flex flex-col gap-1 border-t border-neutral-100 px-6 py-3 md:hidden">
                        {header.map((l, i) => renderLink(l, `site-nav-link site-logo-font rounded-md px-3 py-2 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.7 } : undefined))}
                    </nav>
                )}
            </header>

            <main>
                {children ? (
                    children
                ) : blocks.length === 0 ? (
                    <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-400">This page has no content yet.</div>
                ) : (
                    blocks.map((block) => <BlockView key={block.id} block={block} theme={theme} slug={siteSlug} basePath={base} interactive={interactive} posts={posts} packages={packages} editing={editing} />)
                )}
            </main>

            <footer className="border-t border-neutral-100 bg-neutral-50 px-6 py-12 sm:px-10">
                <div className="mx-auto max-w-6xl text-center">
                    <p className="site-logo-font text-base font-semibold tracking-tight text-neutral-900" style={logoColor ? { color: logoColor } : undefined}>{siteName}</p>
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
