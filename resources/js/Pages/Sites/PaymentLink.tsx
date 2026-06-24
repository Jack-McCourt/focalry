import PaymentLinkPanels, { PaymentPkg } from '@/Components/PaymentLinkPanels';
import SiteShell from '@/Components/site/SiteShell';
import { SiteNavItem, SiteTheme } from '@/types';
import { Head } from '@inertiajs/react';

interface PageRef {
    title: string;
    slug: string;
    is_home: boolean;
}

/** A payment link served inside the studio's own website (its header/footer/theme). */
export default function PaymentLink({
    site,
    studio_logo,
    pages,
    studio_slug,
    can_pay,
    package: pkg,
}: {
    site: { name: string; slug: string; base_path: string; theme: SiteTheme; header_nav: SiteNavItem[]; footer_nav: SiteNavItem[] };
    studio_logo: string | null;
    pages: PageRef[];
    studio_slug: string;
    can_pay: boolean;
    package: PaymentPkg;
}) {
    return (
        <>
            <Head title={pkg.name} />
            <SiteShell
                siteName={site.name}
                siteSlug={site.slug}
                basePath={site.base_path}
                theme={site.theme}
                studioLogo={studio_logo}
                pages={pages}
                headerNav={site.header_nav}
                footerNav={site.footer_nav}
                activeSlug=""
                interactive
            >
                <section className="mx-auto max-w-4xl px-6 py-16 sm:px-10">
                    <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight text-neutral-900">{pkg.name}</h1>
                    <PaymentLinkPanels studioSlug={studio_slug} pkg={pkg} canPay={can_pay} accent={site.theme.primary_color} />
                </section>
            </SiteShell>
        </>
    );
}
