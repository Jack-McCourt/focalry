import { InlineText, containerW } from './ui';

/**
 * Embeds the studio's public scheduling page (the meetings module's
 * /book/{studio} flow) — availability, meeting types and confirmation all
 * live in the iframe, so nothing is duplicated here.
 */
export function BookingBlock({ d, bookingUrl, width, onEditHeading, onEditSubheading }: {
    d: Record<string, any>;
    bookingUrl?: string | null;
    width?: string;
    onEditHeading?: (v: string) => void;
    onEditSubheading?: (v: string) => void;
}) {
    const height = Math.min(Math.max(Number(d.height) || 900, 400), 1600);

    return (
        <section className={`mx-auto ${containerW(width, 'max-w-4xl')} px-6 py-16 sm:px-10`}>
            <div className="mb-8 text-center">
                {onEditHeading
                    ? <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={onEditHeading} className="block text-3xl font-semibold tracking-tight text-neutral-900" />
                    : d.heading && <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                {onEditSubheading
                    ? <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={onEditSubheading!} className="mt-2 block text-neutral-500" />
                    : d.subheading && <p className="mt-2 text-neutral-500">{d.subheading}</p>}
            </div>
            {bookingUrl ? (
                <iframe
                    src={bookingUrl}
                    title={d.heading || 'Book a call'}
                    className="w-full rounded-2xl border border-neutral-200 bg-white"
                    style={{ height }}
                    loading="lazy"
                />
            ) : (
                <div className="flex h-64 items-center justify-center rounded-2xl bg-neutral-100 px-6 text-center text-sm text-neutral-400">
                    Set up meeting types under Studio → Meetings and your scheduling page will appear here.
                </div>
            )}
        </section>
    );
}
