import SiteShell from '@/Components/site/SiteShell';
import type { PostMeta } from '@/Components/site/blocks/data';
import CookieConsent, { ConsentChoice, readConsent } from '@/Components/site/CookieConsent';
import { BlogPostCard, BlogState, PackageCard, SiteBlock, SiteCategory, SiteNavItem, SiteTheme } from '@/types';
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
    blog_state,
    related_posts,
    page,
    post,
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
        custom_css: string | null;
        cookie_consent: boolean;
        cookie_message: string | null;
        cookie_policy_url: string | null;
        favicon_url: string | null;
        og_image_url: string | null;
        seo_title: string;
        seo_description: string | null;
        feed_url: string | null;
        announcement?: { enabled?: boolean; text?: string; link?: string; background?: string };
        social?: Record<string, string>;
        footer?: { tagline?: string; email?: string; phone?: string; show_social?: boolean; logo_size?: string };
        footer_logo?: string | null;
        turnstile_site_key?: string | null;
        noindex?: boolean;
        booking_url?: string | null;
        custom_fonts?: { name: string; url: string }[];
    };
    studio_logo: string | null;
    pages: PageRef[];
    posts: BlogPostCard[];
    categories: SiteCategory[];
    packages: PackageCard[];
    blog_state?: BlogState | null;
    related_posts?: { title: string; slug: string; excerpt: string | null; cover_image: string | null; published_at: string | null; url: string }[];
    page: { title: string; slug: string; is_home?: boolean; blocks: SiteBlock[]; head_code: string | null; body_code: string | null; og_image: string | null; canonical: string };
    /** Present only on a blog post page — drives the auto-generated post header. */
    post?: PostMeta;
}) {
    const ogImage = page.og_image || site.og_image_url;
    // When consent is required, tracking code only injects once the visitor
    // accepts. Without the banner, code injects as before.
    const [consent, setConsent] = useState<ConsentChoice | null>(() => (site.cookie_consent ? readConsent(site.slug) : 'accepted'));
    const trackingAllowed = !site.cookie_consent || consent === 'accepted';

    // Structured data (server-rendered via SSR): the business on the home page,
    // an article on blog posts. Helps rich results without any studio setup.
    const jsonLd = post
        ? {
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              url: page.canonical,
              ...(post.published_at ? { datePublished: post.published_at } : {}),
              ...(post.cover_image ? { image: [post.cover_image] } : {}),
              author: { '@type': 'Organization', name: site.name },
              publisher: { '@type': 'Organization', name: site.name, ...(studio_logo ? { logo: { '@type': 'ImageObject', url: studio_logo } } : {}) },
          }
        : page.is_home
          ? {
                '@context': 'https://schema.org',
                '@type': 'LocalBusiness',
                name: site.name,
                url: page.canonical,
                ...(studio_logo ? { image: studio_logo } : ogImage ? { image: ogImage } : {}),
            }
          : null;

    return (
        <>
            <Head title={site.seo_title}>
                {site.seo_description && <meta name="description" content={site.seo_description} />}
                {site.noindex && <meta name="robots" content="noindex, nofollow" />}
                <link rel="canonical" href={page.canonical} />
                {site.feed_url && <link rel="alternate" type="application/rss+xml" title={`${site.name} — blog`} href={site.feed_url} />}
                {site.favicon_url && <link rel="icon" href={site.favicon_url} />}
                <meta property="og:type" content="website" />
                <meta property="og:title" content={site.seo_title} />
                <meta property="og:url" content={page.canonical} />
                {site.seo_description && <meta property="og:description" content={site.seo_description} />}
                {ogImage && <meta property="og:image" content={ogImage} />}
                <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
                {ogImage && <meta name="twitter:image" content={ogImage} />}
                {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
                {site.custom_css && <style id="site-custom-css">{site.custom_css}</style>}
            </Head>
            {trackingAllowed && site.head_code && <CustomCode html={site.head_code} target="head" />}
            {trackingAllowed && page.head_code && <CustomCode html={page.head_code} target="head" />}
            <SiteShell
                siteName={site.name}
                siteSlug={site.slug}
                basePath={site.base_path}
                theme={site.theme}
                studioLogo={studio_logo}
                footerLogo={site.footer_logo}
                pages={pages}
                headerNav={site.header_nav}
                footerNav={site.footer_nav}
                blocks={page.blocks}
                activeSlug={page.slug}
                interactive
                posts={posts}
                categories={categories}
                packages={packages}
                blogState={blog_state}
                announcement={site.announcement}
                social={site.social}
                footerInfo={site.footer}
                bookingUrl={site.booking_url}
                customFonts={site.custom_fonts}
                post={post ?? null}
            />
            {post && (related_posts?.length ?? 0) > 0 && (
                <section className="border-t border-neutral-100 bg-neutral-50 px-6 py-14 sm:px-10">
                    <div className="mx-auto max-w-6xl">
                        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-neutral-900">Keep reading</h2>
                        <div className="grid gap-8 sm:grid-cols-3">
                            {related_posts!.map((p) => (
                                <a key={p.slug} href={p.url} className="group block">
                                    {p.cover_image ? (
                                        <img src={p.cover_image} alt="" loading="lazy" decoding="async" className="aspect-[3/2] w-full rounded-xl object-cover" />
                                    ) : (
                                        <div className="flex aspect-[3/2] w-full items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-300">Cover</div>
                                    )}
                                    <h3 className="mt-3 text-base font-semibold text-neutral-900 group-hover:underline">{p.title}</h3>
                                    {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{p.excerpt}</p>}
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            )}
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
