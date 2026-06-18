import SiteShell from '@/Components/site/SiteShell';
import { BlogPostCard, PackageCard, SiteBlock, SiteNavItem, SiteTheme } from '@/types';
import { Head } from '@inertiajs/react';

interface PageRef {
    title: string;
    slug: string;
    is_home: boolean;
}

export default function Public({
    site,
    studio_logo,
    pages,
    posts,
    packages,
    page,
}: {
    site: { name: string; slug: string; theme: SiteTheme; header_nav: SiteNavItem[]; footer_nav: SiteNavItem[]; seo_title: string; seo_description: string | null };
    studio_logo: string | null;
    pages: PageRef[];
    posts: BlogPostCard[];
    packages: PackageCard[];
    page: { title: string; slug: string; blocks: SiteBlock[] };
}) {
    return (
        <>
            <Head title={site.seo_title}>
                {site.seo_description && <meta name="description" content={site.seo_description} />}
            </Head>
            <SiteShell
                siteName={site.name}
                siteSlug={site.slug}
                theme={site.theme}
                studioLogo={studio_logo}
                pages={pages}
                headerNav={site.header_nav}
                footerNav={site.footer_nav}
                blocks={page.blocks}
                activeSlug={page.slug}
                interactive
                posts={posts}
                packages={packages}
            />
        </>
    );
}
