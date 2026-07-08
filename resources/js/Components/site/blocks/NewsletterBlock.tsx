import { SiteTheme } from '@/types';
import { useState } from 'react';
import { InlineText, containerW } from './ui';

/**
 * Newsletter signup: posts to the site's /subscribe endpoint (JSON, throttled,
 * honeypot-protected) and stores the address in the studio's subscriber list
 * (Website → Subscribers, exportable as CSV).
 */
export function NewsletterBlock({ d, theme, slug, basePath, interactive, width, onEditHeading, onEditSubheading }: {
    d: Record<string, any>;
    theme: SiteTheme;
    slug: string;
    basePath?: string;
    interactive: boolean;
    width?: string;
    onEditHeading?: (v: string) => void;
    onEditSubheading?: (v: string) => void;
}) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [company, setCompany] = useState(''); // honeypot
    const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
    const primary = theme.primary_color;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!interactive || state === 'busy') return;
        setState('busy');
        try {
            const url = `${basePath ?? `/site/${slug}`}/subscribe` || '/subscribe';
            await (window as any).axios.post(url, {
                email,
                name: name || null,
                company_website: company,
                source: typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null,
            });
            setState('done');
        } catch {
            setState('error');
        }
    };

    return (
        <section className="bg-neutral-50 px-6 py-16 sm:px-10">
            <div className={`mx-auto ${containerW(width, 'max-w-xl')} text-center`}>
                {onEditHeading ? (
                    <>
                        <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={onEditHeading} className="block text-2xl font-semibold tracking-tight text-neutral-900" />
                        <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={onEditSubheading!} className="mt-2 block text-neutral-600" />
                    </>
                ) : (
                    <>
                        {d.heading && <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                        {d.subheading && <p className="mt-2 text-neutral-600">{d.subheading}</p>}
                    </>
                )}

                {state === 'done' ? (
                    <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                        {d.success_message || "You're on the list — thank you!"}
                    </p>
                ) : (
                    <form onSubmit={submit} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
                        {/* Honeypot — hidden from humans, tempting to bots. */}
                        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                        {d.show_name && (
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="block w-full rounded-full border-neutral-200 bg-white px-4 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-0"
                            />
                        )}
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={d.placeholder || 'Your email address'}
                            className="block w-full rounded-full border-neutral-200 bg-white px-4 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-0"
                        />
                        <button
                            type="submit"
                            disabled={state === 'busy'}
                            className="shrink-0 rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: primary }}
                        >
                            {state === 'busy' ? '…' : d.button_label || 'Subscribe'}
                        </button>
                    </form>
                )}
                {state === 'error' && <p className="mt-2 text-xs text-red-600">Something went wrong — please try again.</p>}
            </div>
        </section>
    );
}
