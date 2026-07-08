import { ReactNode } from 'react';

/**
 * Standard page-level content wrapper — keeps every page on the same
 * horizontal/vertical rhythm. Use for new pages instead of hand-rolling
 * `px-4 py-8 sm:px-8`.
 */
export default function PageContainer({ className = '', children }: { className?: string; children: ReactNode }) {
    return <div className={`px-4 py-8 sm:px-8 ${className}`}>{children}</div>;
}

/**
 * Standard in-page heading (below the top bar) with an optional subtitle.
 * The top bar's own h1 stays `text-sm font-semibold` via the layout header.
 */
export function PageHeading({ title, sub, className = 'mb-6' }: { title: ReactNode; sub?: ReactNode; className?: string }) {
    return (
        <div className={className}>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h2>
            {sub && <p className="mt-1 text-sm text-neutral-500">{sub}</p>}
        </div>
    );
}
