import PaymentLinkPanels, { PaymentPkg } from '@/Components/PaymentLinkPanels';
import PublicShell from '@/Components/PublicShell';
import { Head } from '@inertiajs/react';

interface StudioRef {
    name: string;
    slug: string;
    logo_url: string | null;
    logo_size?: string | null;
}

/** Standalone, shareable payment-link page (its own URL). */
export default function Show({
    studio,
    package: pkg,
    can_pay,
}: {
    studio: StudioRef;
    package: PaymentPkg;
    embed: boolean;
    can_pay: boolean;
}) {
    return (
        <>
            <Head title={`${pkg.name} — ${studio.name}`} />
            <PublicShell brand={{ name: studio.name, logo: studio.logo_url, size: studio.logo_size }} maxWidth="xl">
                <PaymentLinkPanels studioSlug={studio.slug} pkg={pkg} canPay={can_pay} />
            </PublicShell>
        </>
    );
}
