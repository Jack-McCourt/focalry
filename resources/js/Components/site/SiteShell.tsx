import { googleFontsHref, siteFont } from '@/lib/siteFonts';
import { BlogPostCard, BlogState, PackageCard, SiteBlock, SiteCategory, SiteNavItem, SiteTheme } from '@/types';
import { Link } from '@inertiajs/react';
import { CSSProperties, Fragment, ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { PostMeta } from './blocks/data';
import { BlockEditing, BlockView, CanvasInsertPoint, PostContext } from './blocks';

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
    /** Separate logo shown in the footer (falls back to the site-name wordmark). */
    footerLogo?: string | null;
    pages: PageRef[];
    headerNav: SiteNavItem[];
    footerNav: SiteNavItem[];
    blocks?: SiteBlock[];
    activeSlug: string;
    interactive: boolean;
    posts?: BlogPostCard[];
    categories?: SiteCategory[];
    packages?: PackageCard[];
    /** Server-side pagination state for a paginating blog block (live site). */
    blogState?: BlogState | null;
    /** Site-wide announcement bar ({enabled, text, link, background}). */
    announcement?: { enabled?: boolean; text?: string; link?: string; background?: string } | null;
    /** Social profile URLs keyed by platform (instagram, facebook, …). */
    social?: Record<string, string> | null;
    /** Footer info: tagline / contact details / social toggle / logo size. */
    footerInfo?: { tagline?: string; email?: string; phone?: string; show_social?: boolean; logo_size?: string } | null;
    /** The studio's public scheduling page URL (booking block). */
    bookingUrl?: string | null;
    /** Self-hosted fonts uploaded by the studio. */
    customFonts?: { name: string; url: string }[] | null;
    /** Builder-only: makes blocks clickable/editable in the preview. */
    editing?: BlockEditing;
    /** The current blog post, on a post page — supplies the post_header block. */
    post?: PostMeta | null;
    /** Custom main content (e.g. a blog post), rendered instead of blocks. */
    children?: ReactNode;
}

interface ResolvedLink {
    label: string;
    href: string;
    external: boolean;
    active: boolean;
    /** Header CTA button (rendered as a primary-colour pill). */
    isButton?: boolean;
    /** One level of dropdown links under this item (header only). */
    children?: ResolvedLink[];
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

    if (style === 'heirloom') {
        return (
            // Classic wedding masthead: tiny, widely-tracked uppercase nav either
            // side of a light serif wordmark (the header itself splits — see
            // `splitHeader` below), soft-grey uppercase serif headings, and flat
            // square buttons with letterspaced uppercase labels.
            `.${scope} .site-nav-link{text-transform:uppercase;letter-spacing:0.22em;font-size:0.68rem;font-weight:400;}` +
            `.${scope} .site-logo-font{text-transform:uppercase;letter-spacing:0.18em;font-weight:400;}` +
            `.${scope} main :is(h1,h2,h3){text-transform:uppercase;letter-spacing:0.06em;line-height:1.25;}` +
            // Square, quiet buttons: un-round the pill CTAs and set small tracked
            // uppercase labels (scoped to a/span so avatars/dots keep their shape).
            `.${scope} main :is(a,span).rounded-full{border-radius:0;text-transform:uppercase;letter-spacing:0.2em;font-size:0.72rem;font-weight:500;}` +
            `.${scope} main :is(a,span).rounded-full.border-2{border-width:1px;}` +
            // Form submit buttons too (scoped per block so slider dots/arrows and
            // avatars keep their round shape).
            `.${scope} main :is(.block-contact,.block-newsletter) button.rounded-full{border-radius:0;text-transform:uppercase;letter-spacing:0.2em;font-size:0.72rem;}` +
            // Everything square: no rounded corners on images, cards or panels.
            `.${scope} main :is(.rounded-lg,.rounded-xl,.rounded-2xl,.rounded-3xl){border-radius:0;}`
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
export default function SiteShell({ siteName, siteSlug, basePath, theme, studioLogo, footerLogo, pages, headerNav, footerNav, blocks = [], activeSlug, interactive, posts, categories, packages, blogState, announcement, social, footerInfo, bookingUrl, customFonts, editing, post, children }: SiteShellProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    // Transparent header: overlays the hero (white text), turns solid on scroll.
    const transparent = theme.header_style === 'transparent';
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        if (!transparent) return;
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [transparent]);
    const overlayHeader = transparent && !scrolled && !menuOpen;

    // Announcement bar — dismissal remembered per text (hidden after mount to
    // avoid an SSR hydration mismatch).
    const annText = (announcement?.enabled && announcement.text) ? announcement.text : '';
    const annKey = `ann:${siteSlug}:${annText}`;
    const [annDismissed, setAnnDismissed] = useState(false);
    useEffect(() => {
        if (annText && typeof window !== 'undefined' && window.localStorage.getItem(annKey) === '1') setAnnDismissed(true);
    }, [annKey, annText]);
    const dismissAnnouncement = () => {
        setAnnDismissed(true);
        try { window.localStorage.setItem(annKey, '1'); } catch { /* ignore */ }
    };
    // Builder-only: which top-level block the pointer is over, so the insert
    // seams above/below it can reveal their "+".
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
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
    // Height for an uploaded logo IMAGE: medium (h-8) is the established default,
    // large ≈ double, small ≈ two-thirds. Full class names so Tailwind keeps them.
    const imgLogoSize = (s?: string) => (({ small: 'h-5', medium: 'h-8', large: 'h-16', xlarge: 'h-24' } as Record<string, string>)[s ?? 'medium'] ?? 'h-8');
    const headerLogoSize = imgLogoSize(theme.header_logo_size);
    const footerLogoSize = imgLogoSize(footerInfo?.logo_size);

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
        const children = (item.children ?? []).map((c) => resolve({ ...c, children: undefined }));
        const extras = {
            isButton: item.style === 'button',
            children: children.length > 0 ? children : undefined,
        };
        if (item.kind === 'url') {
            const target = item.target || '#';
            return { label: item.label, href: target, external: /^https?:\/\//i.test(target), active: false, ...extras };
        }
        const page = pages.find((p) => p.slug === item.target);
        const isHome = page?.is_home ?? item.target === 'home';
        return {
            label: item.label,
            href: isHome ? homeHref : `${base}/${item.target}`,
            external: false,
            active: item.target === activeSlug || children.some((c) => c.active),
            ...extras,
        };
    };

    // Fall back to page-derived nav if the studio hasn't set a header menu.
    const fallback: SiteNavItem[] = pages.map((p) => ({ label: p.title, kind: 'page', target: p.slug }));
    const header = (headerNav.length > 0 ? headerNav : fallback).map(resolve);
    const footer = footerNav.map(resolve);

    const logoColor = overlayHeader ? '#ffffff' : (theme.logo_color || undefined);
    const navColor = overlayHeader ? '#ffffff' : (theme.nav_color || undefined);

    const renderLink = (l: ResolvedLink, cls: string, key: React.Key, style?: CSSProperties) => {
        if (!interactive) return <span key={key} className={cls} style={style}>{l.label}</span>;
        if (l.external) return <a key={key} href={l.href} target="_blank" rel="noreferrer" className={cls} style={style}>{l.label}</a>;
        return <Link key={key} href={l.href} className={cls} style={style}>{l.label}</Link>;
    };

    // Desktop header entries: a plain link, a CTA pill button, or a dropdown
    // group (one level, opened on hover/focus — touch devices get the flattened
    // mobile menu instead).
    const ctaCls = `site-nav-link inline-flex items-center rounded-full px-4 py-1.5 ${navSize} font-medium text-white shadow-sm transition hover:opacity-90`;
    const renderHeaderEntry = (l: ResolvedLink, cls: string, key: React.Key, style?: CSSProperties) => {
        if (l.isButton) {
            const btnStyle = { backgroundColor: theme.primary_color };
            if (!interactive) return <span key={key} className={ctaCls} style={btnStyle}>{l.label}</span>;
            if (l.external) return <a key={key} href={l.href} target="_blank" rel="noreferrer" className={ctaCls} style={btnStyle}>{l.label}</a>;
            return <Link key={key} href={l.href} className={ctaCls} style={btnStyle}>{l.label}</Link>;
        }
        if (l.children?.length) {
            return (
                <div key={key} className="group/nav relative">
                    {renderLink({ ...l, children: undefined }, `${cls} inline-flex items-center gap-1`, 'p', style)}
                    <svg className="pointer-events-none -ml-1 inline h-3 w-3 opacity-60" style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    <div className="invisible absolute left-1/2 top-full z-30 -translate-x-1/2 pt-2 opacity-0 transition group-focus-within/nav:visible group-focus-within/nav:opacity-100 group-hover/nav:visible group-hover/nav:opacity-100">
                        <div className="min-w-[11rem] rounded-xl border border-neutral-100 bg-white p-1.5 shadow-lg">
                            {l.children.map((c, ci) => renderLink(c, `block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${c.active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`, ci))}
                        </div>
                    </div>
                </div>
            );
        }
        return renderLink(l, cls, key, style);
    };

    // Resolve fonts: body + headings, with the logo/menu inheriting the body
    // font unless a dedicated logo font is chosen. A scoped class keeps the
    // heading rule from leaking outside this site.
    const scope = `sf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    // Self-hosted fonts: `custom:Name` theme keys resolve against the uploads.
    const customList = customFonts ?? [];
    const resolveFont = (key?: string | null) => {
        if (key?.startsWith('custom:')) {
            const name = key.slice(7);
            if (customList.some((f) => f.name === name)) {
                return { stack: `'${name.replace(/'/g, '')}', sans-serif`, weight: undefined as number | undefined, headingWeight: undefined as number | undefined };
            }
        }
        return siteFont(key);
    };
    const bodyFont = resolveFont(theme.body_font ?? theme.font);
    const headingFont = resolveFont(theme.heading_font ?? theme.font);
    const logoFont = theme.logo_font ? resolveFont(theme.logo_font) : bodyFont;
    const fontsHref = googleFontsHref([theme.body_font ?? theme.font, theme.heading_font ?? theme.font, theme.logo_font].filter((k) => !k?.startsWith('custom:')));
    const fontFaceCss = customList
        .map((f) => `@font-face{font-family:'${f.name.replace(/'/g, '')}';src:url('${f.url}') format('woff2');font-display:swap;}`)
        .join('');
    // Weight: explicit theme override wins, otherwise the font's registered default.
    const bodyWeight = theme.body_weight ?? bodyFont.weight;
    const headingWeight = theme.heading_weight ?? headingFont.headingWeight;
    const fontCss =
        fontFaceCss +
        `.${scope}{font-family:${bodyFont.stack};${bodyWeight ? `font-weight:${bodyWeight};` : ''}}` +
        `.${scope} :is(h1,h2,h3,h4,h5,h6){font-family:${headingFont.stack};${headingWeight ? `font-weight:${headingWeight};` : ''}}` +
        `.${scope} .site-logo-font{font-family:${logoFont.stack};${logoFont.weight ? `font-weight:${logoFont.weight};` : ''}}` +
        styleCss(scope, theme.style) +
        // "Wide" templates bump the main content container up one size (6xl → 7xl).
        (theme.width === 'wide' ? `.${scope} .max-w-6xl{max-width:80rem;}` : '') +
        // General text colour override: recolour the main content's neutral body/
        // heading shades. Leaves muted captions (neutral-400/300), hero white text,
        // and per-block colour overrides untouched.
        (theme.text_color
            ? `.${scope} main :is(.text-neutral-900,.text-neutral-800,.text-neutral-700,.text-neutral-600,.text-neutral-500){color:${theme.text_color};}`
            : '');

    // The Studio style uses a centred masthead instead of the inline logo/nav row.
    const centeredHeader = theme.style === 'studio';
    // The Heirloom style splits the nav around a centred wordmark (Pixieset-like).
    const splitHeader = theme.style === 'heirloom';
    const splitAt = Math.ceil(header.length / 2);

    const logoMark = studioLogo
        ? <img src={studioLogo} alt={siteName} className={`${headerLogoSize} w-auto object-contain`} />
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
        <div className={`${scope} relative min-h-screen bg-white text-neutral-900`} style={{ ['--site-header-h' as string]: overlayHeader || transparent ? '0px' : `${headerH}px` }}>
            {/* Keyboard users can jump past the nav (visible only when focused). */}
            <a href="#site-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-neutral-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white">
                Skip to content
            </a>
            {fontsHref && (
                <>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    {/* Load Google Fonts without blocking first paint: fetch as
                        non-applicable "print", then flip to "all" once loaded. */}
                    <link rel="stylesheet" href={fontsHref} media="print" onLoad={(e) => { (e.currentTarget as HTMLLinkElement).media = 'all'; }} />
                </>
            )}
            <style dangerouslySetInnerHTML={{ __html: fontCss }} />
            {annText && !annDismissed && (
                <div className="relative z-40 px-9 py-2 text-center text-sm text-white" style={{ backgroundColor: announcement?.background || theme.primary_color }}>
                    {announcement?.link ? (
                        interactive
                            ? <a href={announcement.link} className="font-medium underline-offset-2 hover:underline">{annText}</a>
                            : <span className="font-medium">{annText}</span>
                    ) : (
                        <span className="font-medium">{annText}</span>
                    )}
                    <button type="button" onClick={dismissAnnouncement} aria-label="Dismiss announcement" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/70 hover:text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
            <header
                ref={headerRef}
                className={
                    transparent
                        ? overlayHeader
                            ? 'absolute inset-x-0 z-30 border-b border-transparent bg-gradient-to-b from-black/45 to-transparent'
                            : 'fixed inset-x-0 top-0 z-30 border-b border-neutral-100 bg-white/95 backdrop-blur'
                        : 'sticky top-0 z-20 border-b border-neutral-100 bg-white/85 backdrop-blur'
                }
            >
                {splitHeader ? (
                    // Heirloom: nav links either side of a centred wordmark.
                    <div className="mx-auto max-w-7xl px-6 py-5 sm:px-10">
                        <div className="relative flex items-center justify-center md:hidden">
                            {logoLink}
                            {header.length > 0 && menuButton('absolute right-0 top-1/2 -translate-y-1/2')}
                        </div>
                        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
                            <nav className="flex flex-wrap items-center justify-start gap-x-1">
                                {header.slice(0, splitAt).map((l, i) => renderHeaderEntry(l, `site-nav-link site-logo-font rounded-full px-3 py-1.5 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.85 } : undefined))}
                            </nav>
                            {logoLink}
                            <nav className="flex flex-wrap items-center justify-end gap-x-1">
                                {header.slice(splitAt).map((l, i) => renderHeaderEntry(l, `site-nav-link site-logo-font rounded-full px-3 py-1.5 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.85 } : undefined))}
                            </nav>
                        </div>
                    </div>
                ) : centeredHeader ? (
                    // Studio: centred masthead — wordmark on top, nav centred beneath.
                    <div className="mx-auto max-w-6xl px-6 py-5 sm:px-10">
                        <div className="relative flex items-center justify-center">
                            {logoLink}
                            {header.length > 0 && menuButton('absolute right-0 top-1/2 -translate-y-1/2')}
                        </div>
                        {header.length > 0 && (
                            <nav className="mt-3 hidden flex-wrap items-center justify-center gap-x-2 gap-y-1 md:flex">
                                {header.map((l, i) => renderHeaderEntry(l, `site-nav-link site-logo-font px-2.5 py-1 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.85 } : undefined))}
                            </nav>
                        )}
                    </div>
                ) : (
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
                        {logoLink}
                        {header.length > 0 && (
                            <>
                                <nav className="hidden items-center gap-1 md:flex">
                                    {header.map((l, i) => renderHeaderEntry(l, `site-nav-link site-logo-font rounded-full px-3 py-1.5 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`, i, navColor ? { color: navColor, opacity: l.active ? 1 : 0.85 } : undefined))}
                                </nav>
                                {menuButton('-mr-1')}
                            </>
                        )}
                    </div>
                )}
                {header.length > 0 && menuOpen && (
                    <nav className="flex flex-col gap-1 border-t border-neutral-100 px-6 py-3 md:hidden">
                        {header.flatMap((l, i) => [
                            l.isButton
                                ? <div key={`m${i}`} className="px-3 py-2">{renderHeaderEntry(l, '', 'b')}</div>
                                : renderLink({ ...l, children: undefined }, `site-nav-link site-logo-font rounded-md px-3 py-2 ${navSize} font-medium transition ${navColor ? '' : l.active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`, `m${i}`, navColor ? { color: navColor, opacity: l.active ? 1 : 0.85 } : undefined),
                            ...(l.children ?? []).map((c, ci) => renderLink(c, `site-nav-link site-logo-font rounded-md py-2 pl-7 pr-3 text-sm transition ${navColor ? '' : c.active ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-50'}`, `m${i}-${ci}`, navColor ? { color: navColor, opacity: c.active ? 1 : 0.75 } : undefined)),
                        ])}
                    </nav>
                )}
            </header>

            <main id="site-main">
                <PostContext.Provider value={post ?? null}>
                {children ? (
                    children
                ) : blocks.length === 0 ? (
                    <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-400">This page has no content yet.</div>
                ) : editing?.onInsertAt ? (
                    // Builder preview: interleave hoverable insert seams between blocks.
                    <>
                        {blocks.map((block, i) => (
                            <Fragment key={block.id}>
                                <CanvasInsertPoint index={i} active={hoverIdx === i || hoverIdx === i - 1} onInsert={editing.onInsertAt!} />
                                <div onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}>
                                    <BlockView block={block} theme={theme} slug={siteSlug} basePath={base} interactive={interactive} posts={posts} categories={categories} packages={packages} blogState={blogState} bookingUrl={bookingUrl} editing={editing} />
                                </div>
                            </Fragment>
                        ))}
                        <CanvasInsertPoint index={blocks.length} active={hoverIdx === blocks.length - 1} onInsert={editing.onInsertAt!} />
                    </>
                ) : (
                    blocks.map((block) => <BlockView key={block.id} block={block} theme={theme} slug={siteSlug} basePath={base} interactive={interactive} posts={posts} categories={categories} packages={packages} blogState={blogState} bookingUrl={bookingUrl} editing={editing} />)
                )}
                </PostContext.Provider>
            </main>

            <footer className="border-t border-neutral-100 bg-neutral-50 px-6 py-12 sm:px-10">
                {(() => {
                    const fi = footerInfo ?? {};
                    const links = Object.entries(social ?? {}).filter(([, v]) => !!v);
                    const showSocial = fi.show_social !== false && links.length > 0;
                    const rich = !!(fi.tagline || fi.email || fi.phone || showSocial);
                    const socialRow = showSocial && (
                        <div className={`flex items-center gap-3 ${rich ? '' : 'justify-center'}`}>
                            {links.map(([platform, url]) => (
                                <a key={platform} href={url} target="_blank" rel="noreferrer" aria-label={platform} className="text-neutral-400 transition hover:text-neutral-900">
                                    <SocialIcon platform={platform} />
                                </a>
                            ))}
                        </div>
                    );

                    const footerBrand = footerLogo
                        ? <img src={footerLogo} alt={siteName} className={`${footerLogoSize} w-auto object-contain`} />
                        : <p className="site-logo-font text-base font-semibold tracking-tight text-neutral-900" style={theme.logo_color ? { color: theme.logo_color } : undefined}>{siteName}</p>;

                    if (!rich) {
                        return (
                            <div className="mx-auto max-w-6xl text-center">
                                {footerLogo ? <div className="flex justify-center">{footerBrand}</div> : footerBrand}
                                {footer.length > 0 && (
                                    <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                                        {footer.map((l, i) => renderLink(l, 'text-sm text-neutral-600 hover:text-neutral-900', i))}
                                    </nav>
                                )}
                                {socialRow && <div className="mt-4 flex justify-center">{socialRow}</div>}
                                <p className="mt-6 text-xs text-neutral-400">© {new Date().getFullYear()} {siteName}</p>
                            </div>
                        );
                    }

                    return (
                        <div className="mx-auto max-w-6xl">
                            <div className="grid gap-10 md:grid-cols-3">
                                <div>
                                    {footerBrand}
                                    {fi.tagline && <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">{fi.tagline}</p>}
                                </div>
                                <div>
                                    {footer.length > 0 && (
                                        <nav className="flex flex-col items-start gap-2">
                                            {footer.map((l, i) => renderLink(l, 'text-sm text-neutral-600 hover:text-neutral-900', i))}
                                        </nav>
                                    )}
                                </div>
                                <div className="space-y-2 text-sm text-neutral-600">
                                    {fi.email && <p><a href={`mailto:${fi.email}`} className="hover:text-neutral-900">{fi.email}</a></p>}
                                    {fi.phone && <p>{fi.phone}</p>}
                                    {socialRow && <div className="pt-1">{socialRow}</div>}
                                </div>
                            </div>
                            <p className="mt-10 border-t border-neutral-200/70 pt-5 text-xs text-neutral-400">© {new Date().getFullYear()} {siteName}</p>
                        </div>
                    );
                })()}
            </footer>
        </div>
    );
}


/** Minimal single-path icons for the supported social platforms. */
function SocialIcon({ platform }: { platform: string }) {
    const paths: Record<string, React.ReactNode> = {
        instagram: (
            <><rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" /></>
        ),
        facebook: <path fill="currentColor" d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7h2.5z" />,
        pinterest: <path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.3 9.3-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.5-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.8 0-2.5-1.8-4.3-4.4-4.3-3 0-4.7 2.2-4.7 4.5 0 .9.3 1.9.8 2.4.1.1.1.2.1.3l-.3 1.1c0 .2-.1.2-.3.1-1.2-.6-2-2.4-2-3.9 0-3.2 2.3-6.1 6.7-6.1 3.5 0 6.2 2.5 6.2 5.8 0 3.5-2.2 6.3-5.2 6.3-1 0-2-.5-2.3-1.2l-.6 2.4c-.2.9-.8 2-1.2 2.6.9.3 1.9.4 2.9.4 5.5 0 10-4.5 10-10S17.5 2 12 2z" />,
        tiktok: <path fill="currentColor" d="M16.6 3c.3 1.7 1.4 3 3.4 3.2v2.9c-1.3 0-2.5-.4-3.4-1v6.4c0 3.3-2.2 5.5-5.3 5.5-3 0-5.3-2.3-5.3-5.2 0-3 2.4-5.2 5.5-5.1v3c-.2-.1-.5-.1-.7-.1-1.4 0-2.4 1-2.4 2.3s1 2.3 2.4 2.3c1.5 0 2.6-1 2.6-2.8V3h3.2z" />,
        youtube: <path fill="currentColor" d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8 1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />,
    };

    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            {paths[platform] ?? <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />}
        </svg>
    );
}
