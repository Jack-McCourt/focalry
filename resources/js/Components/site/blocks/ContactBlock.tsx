import { SiteTheme } from '@/types';
import { useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { EVENT_TYPES } from './registry';
import { InlineText, containerW } from './ui';

// ─── Contact form (the lead capture) ──────────────────────────────────────────

export function ContactBlock({ data: d, theme, slug, basePath, interactive, width, onEditHeading, onEditSubheading }: { data: Record<string, any>; theme: SiteTheme; slug: string; basePath?: string; interactive: boolean; width?: string; onEditHeading?: (v: string) => void; onEditSubheading?: (v: string) => void }) {
    return (
        <section id="contact" className="bg-neutral-50 px-6 py-20 sm:px-10">
            <div className={`mx-auto ${containerW(width, 'max-w-xl')}`}>
                {onEditHeading ? (
                    <>
                        <InlineText as="h2" value={d.heading ?? ''} placeholder="Heading" onChange={onEditHeading} className="block text-center text-3xl font-semibold tracking-tight text-neutral-900" />
                        <InlineText as="p" value={d.subheading ?? ''} placeholder="Supporting line (optional)" onChange={onEditSubheading!} className="mt-3 block text-center text-neutral-600" />
                    </>
                ) : (
                    <>
                        {d.heading && <h2 className="text-center text-3xl font-semibold tracking-tight text-neutral-900">{d.heading}</h2>}
                        {d.subheading && <p className="mt-3 text-center text-neutral-600">{d.subheading}</p>}
                    </>
                )}
                <div className="mt-10">
                    {interactive ? (
                        <ContactFormLive data={d} theme={theme} slug={slug} basePath={basePath ?? `/site/${slug}`} />
                    ) : (
                        <ContactFormPreview data={d} theme={theme} />
                    )}
                </div>
            </div>
        </section>
    );
}

function fieldClass() {
    return 'block w-full rounded-lg border-neutral-200 bg-white text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-0';
}

/**
 * Resolves the contact form's "after submit" target to a URL, or null to keep
 * the inline thank-you message. Accepts a full URL / absolute path as-is, the
 * sentinel `home`, or a page slug (resolved against the current site).
 */
function resolveRedirect(target: string | undefined, base: string): string | null {
    const t = (target ?? '').trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t) || t.startsWith('/')) return t;
    if (t === 'home') return base || '/';
    return `${base}/${t}`;
}

/**
 * Fires the studio's conversion tracking when an enquiry is submitted.
 *  - `tracking_event`: the easy path — pushes a GTM dataLayer event and a GA4
 *    gtag event of that name (works with no code once their base tag is set).
 *  - `conversion_code`: advanced — runs a raw snippet (e.g. a Google Ads
 *    conversion gtag call) in page context.
 */
function fireConversion(d: Record<string, any>) {
    const event = (d.tracking_event ?? '').trim();
    if (event) {
        const w = window as any;
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push({ event });
        if (typeof w.gtag === 'function') w.gtag('event', event);
    }

    const code = (d.conversion_code ?? '').trim();
    if (code) {
        try {
            // eslint-disable-next-line no-new-func
            new Function(code)();
        } catch (e) {
            console.error('Conversion tracking error:', e);
        }
    }
}

function ContactFormLive({ data: d, theme, slug, basePath }: { data: Record<string, any>; theme: SiteTheme; slug: string; basePath: string }) {
    // Cloudflare Turnstile (optional): the block opts in and the platform must
    // have a site key configured; verification happens server-side.
    const turnstileKey: string | null = d.captcha ? ((usePage().props as any).site?.turnstile_site_key ?? null) : null;
    useEffect(() => {
        if (!turnstileKey || document.querySelector('script[data-turnstile]')) return;
        const el = document.createElement('script');
        el.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        el.async = true;
        el.defer = true;
        el.setAttribute('data-turnstile', '1');
        document.head.appendChild(el);
    }, [turnstileKey]);
    const customFields: any[] = Array.isArray(d.custom_fields) ? d.custom_fields : [];
    const form = useForm<Record<string, any>>({
        name: '', email: '', phone: '', event_date: '', event_type: '', message: '',
        company_website: '', // honeypot — must stay empty
        custom_values: customFields.map((f) => ({ label: f.label ?? '', value: '' })),
        attachment: null as File | null,
        // The autoresponder settings are NOT sent — the server reads them from
        // the saved contact block, so the form can't be abused as a mail relay.
    });

    const setCustom = (i: number, value: string) =>
        form.setData('custom_values', form.data.custom_values.map((c: any, ci: number) => (ci === i ? { ...c, value } : c)));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        // The Turnstile widget injects a hidden input; forward its token.
        form.transform((data) => ({
            ...data,
            'cf-turnstile-response': (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value ?? '',
        }));
        form.post(`${basePath}/contact`, {
            preserveScroll: true,
            onSuccess: () => {
                fireConversion(d);
                const target = resolveRedirect(d.redirect_url, basePath);
                if (target) {
                    window.location.href = target;
                    return;
                }
                form.reset();
            },
        });
    };

    if (form.recentlySuccessful) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                <p className="text-lg font-medium text-emerald-800">Thank you!</p>
                <p className="mt-1 text-sm text-emerald-700">Your enquiry has been sent. We'll be in touch soon.</p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {/* Honeypot — hidden from real users, catches bots */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden" style={{ position: 'absolute' }}>
                <label>
                    Company website
                    <input type="text" tabIndex={-1} autoComplete="off" value={form.data.company_website} onChange={(e) => form.setData('company_website', e.target.value)} />
                </label>
            </div>
            <div>
                <input className={fieldClass()} placeholder="Your name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
            </div>
            <div>
                <input type="email" className={fieldClass()} placeholder="Email address" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                {form.errors.email && <p className="mt-1 text-xs text-red-600">{form.errors.email}</p>}
            </div>
            {d.show_phone && (
                <input className={fieldClass()} placeholder="Phone (optional)" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                {d.show_event_date && (
                    <input type="date" className={fieldClass()} value={form.data.event_date} onChange={(e) => form.setData('event_date', e.target.value)} />
                )}
                {d.show_event_type && (
                    <select className={fieldClass()} value={form.data.event_type} onChange={(e) => form.setData('event_type', e.target.value)}>
                        <option value="">What are you after?</option>
                        {EVENT_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                )}
            </div>
            <textarea className={fieldClass()} rows={4} placeholder="Tell us a little about your enquiry…" value={form.data.message} onChange={(e) => form.setData('message', e.target.value)} />

            {customFields.map((f, i) => {
                const val = form.data.custom_values[i]?.value ?? '';
                return (
                    <div key={i}>
                        {f.type !== 'checkbox' && <label className="mb-1 block text-sm text-neutral-600">{f.label}{f.required ? ' *' : ''}</label>}
                        {f.type === 'textarea' ? (
                            <textarea className={fieldClass()} rows={3} required={!!f.required} value={val} onChange={(e) => setCustom(i, e.target.value)} />
                        ) : f.type === 'select' ? (
                            <select className={fieldClass()} required={!!f.required} value={val} onChange={(e) => setCustom(i, e.target.value)}>
                                <option value="">Choose…</option>
                                {String(f.options || '').split('\n').map((o: string) => o.trim()).filter(Boolean).map((o: string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : f.type === 'checkbox' ? (
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input type="checkbox" required={!!f.required} checked={val === 'Yes'} onChange={(e) => setCustom(i, e.target.checked ? 'Yes' : '')} /> {f.label}{f.required ? ' *' : ''}
                            </label>
                        ) : (
                            <input className={fieldClass()} required={!!f.required} value={val} onChange={(e) => setCustom(i, e.target.value)} />
                        )}
                    </div>
                );
            })}

            {d.allow_file && (
                <div>
                    <label className="mb-1 block text-sm text-neutral-600">{d.file_label || 'Attach a file'}</label>
                    <input type="file" className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200" onChange={(e) => form.setData('attachment', e.target.files?.[0] ?? null)} />
                    {form.errors.attachment && <p className="mt-1 text-xs text-red-600">{form.errors.attachment}</p>}
                </div>
            )}
            {turnstileKey && <div className="cf-turnstile" data-sitekey={turnstileKey} />}

            <button type="submit" disabled={form.processing} className="w-full rounded-full px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: theme.primary_color }}>
                {form.processing ? 'Sending…' : d.submit_label || 'Send enquiry'}
            </button>
        </form>
    );
}

function ContactFormPreview({ data: d, theme }: { data: Record<string, any>; theme: SiteTheme }) {
    return (
        <div className="pointer-events-none space-y-4 opacity-90">
            <input className={fieldClass()} placeholder="Your name" disabled />
            <input className={fieldClass()} placeholder="Email address" disabled />
            {d.show_phone && <input className={fieldClass()} placeholder="Phone (optional)" disabled />}
            <div className="grid gap-4 sm:grid-cols-2">
                {d.show_event_date && <input className={fieldClass()} placeholder="Event date" disabled />}
                {d.show_event_type && <input className={fieldClass()} placeholder="What are you after?" disabled />}
            </div>
            <textarea className={fieldClass()} rows={4} placeholder="Tell us a little about your enquiry…" disabled />
            {(Array.isArray(d.custom_fields) ? d.custom_fields : []).map((f: any, i: number) => (
                <input key={i} className={fieldClass()} placeholder={`${f.label || 'Field'}${f.required ? ' *' : ''}`} disabled />
            ))}
            {d.allow_file && <input className={fieldClass()} placeholder={d.file_label || 'Attach a file'} disabled />}
            <div className="w-full rounded-full px-6 py-3 text-center text-sm font-medium text-white" style={{ backgroundColor: theme.primary_color }}>
                {d.submit_label || 'Send enquiry'}
            </div>
        </div>
    );
}
