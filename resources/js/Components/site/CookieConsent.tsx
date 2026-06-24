import { useEffect, useState } from 'react';

export type ConsentChoice = 'accepted' | 'declined';

/** Reads a stored consent decision for a site (client-side only). */
export function readConsent(slug: string): ConsentChoice | null {
    if (typeof window === 'undefined') return null;
    try {
        const v = window.localStorage.getItem(`cc:${slug}`);
        return v === 'accepted' || v === 'declined' ? v : null;
    } catch {
        return null;
    }
}

function storeConsent(slug: string, choice: ConsentChoice) {
    try {
        window.localStorage.setItem(`cc:${slug}`, choice);
    } catch {
        /* storage unavailable */
    }
}

/**
 * A bottom cookie-consent banner. Shown until the visitor accepts or declines;
 * the decision is persisted and reported up so tracking code can be gated on it.
 */
export default function CookieConsent({
    slug,
    message,
    policyUrl,
    primaryColor,
    onChoice,
}: {
    slug: string;
    message?: string | null;
    policyUrl?: string | null;
    primaryColor: string;
    onChoice: (c: ConsentChoice) => void;
}) {
    const [visible, setVisible] = useState(false);

    // Only show once mounted and if no prior decision exists.
    useEffect(() => {
        if (!readConsent(slug)) setVisible(true);
    }, [slug]);

    if (!visible) return null;

    const choose = (c: ConsentChoice) => {
        storeConsent(slug, c);
        setVisible(false);
        onChoice(c);
    };

    return (
        <div className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:gap-4">
                <p className="flex-1 text-sm text-neutral-600">
                    {message || 'We use cookies to analyse traffic and improve your experience.'}
                    {policyUrl && (
                        <>
                            {' '}
                            <a href={policyUrl} target="_blank" rel="noreferrer" className="font-medium underline" style={{ color: primaryColor }}>
                                Learn more
                            </a>
                        </>
                    )}
                </p>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={() => choose('declined')}
                        className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                        Decline
                    </button>
                    <button
                        type="button"
                        onClick={() => choose('accepted')}
                        className="rounded-full px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
