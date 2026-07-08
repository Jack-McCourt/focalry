import { PropsWithChildren } from 'react';

const MAX = {
    sm: 'max-w-xl',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
} as const;

// Studio logo size (matches the email sizes: 32 / 48 / 96 / 144px). Full class
// names so Tailwind keeps them. Medium (max-h-12) is the established default.
const LOGO_SIZE: Record<string, string> = {
    small: 'max-h-8',
    medium: 'max-h-12',
    large: 'max-h-24',
    xlarge: 'max-h-36',
};

/**
 * Shared frame for the studio's public-facing documents/forms (proposals,
 * contracts, questionnaires, payment links). A calm, paper-like background, a
 * quiet branded header and footer, so every client touchpoint feels of a piece —
 * clean, classy and unmistakably the studio's.
 */
export default function PublicShell({
    brand,
    maxWidth = 'lg',
    children,
}: PropsWithChildren<{
    brand?: { name?: string | null; logo?: string | null; size?: string | null };
    maxWidth?: keyof typeof MAX;
}>) {
    return (
        <div className="min-h-screen bg-[#f6f5f2] text-neutral-900">
            <div className={`mx-auto ${MAX[maxWidth]} px-4`}>
                <header className="pb-7 pt-12 text-center sm:pt-16">
                    {brand?.logo ? (
                        <img src={brand.logo} alt={brand.name ?? ''} className={`mx-auto ${LOGO_SIZE[brand.size ?? 'medium'] ?? 'max-h-12'} object-contain`} />
                    ) : brand?.name ? (
                        <span className="text-sm font-medium uppercase tracking-[0.28em] text-neutral-600">{brand.name}</span>
                    ) : null}
                </header>

                <main className="pb-10">{children}</main>

                <footer className="pb-12 pt-2 text-center">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">
                        Powered by Focalry
                    </span>
                </footer>
            </div>
        </div>
    );
}

/** A single elegant content panel — hairline border, soft shadow, airy padding. */
export function PublicCard({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
    return (
        <div className={`rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
            {children}
        </div>
    );
}
