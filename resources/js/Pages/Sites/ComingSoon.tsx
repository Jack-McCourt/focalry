import { SiteTheme } from '@/types';
import { Head } from '@inertiajs/react';

/** Branded holding page shown while a site is unpublished (opt-in). */
export default function ComingSoon({ name, studio_logo, favicon_url, contact_email, theme }: {
    name: string;
    studio_logo: string | null;
    favicon_url?: string | null;
    contact_email: string | null;
    theme: SiteTheme;
}) {
    return (
        <>
            <Head title={`${name} — coming soon`}>
                <meta name="robots" content="noindex, nofollow" />
                {favicon_url && <link rel="icon" href={favicon_url} />}
            </Head>
            <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-6 text-center">
                {studio_logo ? (
                    <img src={studio_logo} alt={name} className="h-14 w-auto object-contain brightness-0 invert" />
                ) : (
                    <p className="text-3xl font-semibold tracking-tight text-white">{name}</p>
                )}
                <p className="mt-6 text-sm font-medium uppercase tracking-[0.3em] text-neutral-400">Coming soon</p>
                <span className="mt-6 h-px w-16" style={{ backgroundColor: theme.primary_color }} />
                <p className="mt-6 max-w-sm text-sm leading-relaxed text-neutral-400">
                    Something beautiful is on its way.
                    {contact_email && (
                        <>
                            {' '}In the meantime, reach us at{' '}
                            <a href={`mailto:${contact_email}`} className="text-white underline-offset-2 hover:underline">{contact_email}</a>.
                        </>
                    )}
                </p>
            </div>
        </>
    );
}
