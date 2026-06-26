import SiteShell from '@/Components/site/SiteShell';
import CookieConsent, { ConsentChoice, readConsent } from '@/Components/site/CookieConsent';
import { BlogPostCard, PackageCard, SiteBlock, SiteCategory, SiteNavItem, SiteTheme } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';

interface PageRef {
    title: string;
    slug: string;
    is_home: boolean;
}

/**
 * Injects a studio's custom code (analytics, ad pixels, tag managers) into the
 * live document. Uses real DOM nodes — rebuilding any <script> tags so the
 * browser actually executes them (innerHTML-inserted scripts never run).
 */
function CustomCode({ html, target }: { html: string; target: 'head' | 'body' }) {
    useEffect(() => {
        if (!html) return;
        const parent = target === 'head' ? document.head : document.body;
        const tpl = document.createElement('template');
        tpl.innerHTML = html;

        const added: Node[] = [];
        Array.from(tpl.content.childNodes).forEach((node) => {
            if (node.nodeName === 'SCRIPT') {
                const orig = node as HTMLScriptElement;
                const script = document.createElement('script');
                Array.from(orig.attributes).forEach((a) => script.setAttribute(a.name, a.value));
                script.text = orig.text;
                parent.appendChild(script);
                added.push(script);
            } else {
                const clone = node.cloneNode(true);
                parent.appendChild(clone);
                added.push(clone);
            }
        });

        return () => added.forEach((n) => { try { parent.removeChild(n); } catch { /* already gone */ } });
    }, [html, target]);

    return null;
}

export default function Public({
    site,
    studio_logo,
    pages,
    posts,
    categories,
    packages,
    page,
}: {
    site: {
        name: string;
        slug: string;
        base_path: string;
        theme: SiteTheme;
        header_nav: SiteNavItem[];
        footer_nav: SiteNavItem[];
        head_code: string | null;
        body_code: string | null;
        cookie_consent: boolean;
        cookie_message: string | null;
        cookie_policy_url: string | null;
        favicon_url: string | null;
        og_image_url: string | null;
        seo_title: string;
        seo_description: string | null;
    };
    studio_logo: string | null;
    pages: PageRef[];
    posts: BlogPostCard[];
    categories: SiteCategory[];
    packages: PackageCard[];
    page: { title: string; slug: string; blocks: SiteBlock[]; head_code: string | null; body_code: string | null; og_image: string | null; canonical: string };
}) {
    const ogImage = page.og_image || site.og_image_url;
    // When consent is required, tracking code only injects once the visitor
    // accepts. Without the banner, code injects as before.
    const [consent, setConsent] = useState<ConsentChoice | null>(() => (site.cookie_consent ? readConsent(site.slug) : 'accepted'));
    const trackingAllowed = !site.cookie_consent || consent === 'accepted';

    return (
        <>
            <Head title={site.seo_title}>
                {site.seo_description && <meta name="description" content={site.seo_description} />}
                <link rel="canonical" href={page.canonical} />
                {site.favicon_url && <link rel="icon" href={site.favicon_url} />}
                <meta property="og:type" content="website" />
                <meta property="og:title" content={site.seo_title} />
                <meta property="og:url" content={page.canonical} />
                {site.seo_description && <meta property="og:description" content={site.seo_description} />}
                {ogImage && <meta property="og:image" content={ogImage} />}
                <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
                {ogImage && <meta name="twitter:image" content={ogImage} />}
            </Head>
            {trackingAllowed && site.head_code && <CustomCode html={site.head_code} target="head" />}
            {trackingAllowed && page.head_code && <CustomCode html={page.head_code} target="head" />}
            <SiteShell
                siteName={site.name}
                siteSlug={site.slug}
                basePath={site.base_path}
                theme={site.theme}
                studioLogo={studio_logo}
                pages={pages}
                headerNav={site.header_nav}
                footerNav={site.footer_nav}
                blocks={page.blocks}
                activeSlug={page.slug}
                interactive
                posts={posts}
                categories={categories}
                packages={packages}
            />
            {trackingAllowed && site.body_code && <CustomCode html={site.body_code} target="body" />}
            {trackingAllowed && page.body_code && <CustomCode html={page.body_code} target="body" />}
            {site.cookie_consent && (
                <CookieConsent
                    slug={site.slug}
                    message={site.cookie_message}
                    policyUrl={site.cookie_policy_url}
                    primaryColor={site.theme.primary_color}
                    onChoice={setConsent}
                />
            )}
        </>
    );
}
