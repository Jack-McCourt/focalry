import ColorPicker from '@/Components/ColorPicker';
import CustomDomainPanel from '@/Components/site/CustomDomainPanel';
import { ImageField, NavEditor } from '@/Components/site/editors';
import { SITE_FONTS } from '@/lib/siteFonts';
import { SiteTemplateMeta } from '@/types';
import { router } from '@inertiajs/react';

export type SettingsTabKey = 'navigation' | 'theme' | 'header_footer' | 'redirects' | 'domain' | 'general' | 'templates';

export const SETTINGS_TABS: { key: SettingsTabKey; label: string }[] = [
    { key: 'navigation', label: 'Menus' },
    { key: 'theme', label: 'Theme' },
    { key: 'header_footer', label: 'Header & Footer' },
    { key: 'redirects', label: 'Redirects' },
    { key: 'domain', label: 'Domain' },
    { key: 'general', label: 'General' },
    { key: 'templates', label: 'Templates' },
];

// The site-wide settings form. Shared shape used by the dedicated Settings page.
// Pass `onSave`/`saving` for an explicit Save button (page mode), or `onClose`
// for a "Done" link.
export default function SiteSettings(props: any) {
    const { name, setName, slug, setSlug, contactEmail, setContactEmail, seoTitle, setSeoTitle, seoDescription, setSeoDescription, theme, setTheme, errors, templates, applyTemplate, pageRefs, headerNav, setHeaderNav, footerNav, setFooterNav, headCode, setHeadCode, bodyCode, setBodyCode, cookieConsent, setCookieConsent, cookieMessage, setCookieMessage, cookiePolicyUrl, setCookiePolicyUrl, faviconUrl, setFaviconUrl, ogImageUrl, setOgImageUrl, redirects, setRedirects, site, domainConfig, studioLogo, tab, setTab, onClose, onSave, saving } = props;

    const uploadLogo = (file: File) => {
        const fd = new FormData();
        fd.append('logo', file);
        router.post(route('studio.logo.upload'), fd, { forceFormData: true, preserveScroll: true });
    };
    const removeLogo = () => router.delete(route('studio.logo.delete'), { preserveScroll: true });

    return (
        <div>
            <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
                <div className="flex items-center justify-between px-4 pt-4">
                    <h2 className="text-sm font-semibold text-neutral-900">Site settings</h2>
                    {onSave ? (
                        <button onClick={onSave} disabled={saving} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
                    ) : onClose ? (
                        <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-700">Done</button>
                    ) : null}
                </div>
                <div className="mt-3 flex gap-1 px-2">
                    {SETTINGS_TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`relative -mb-px border-b-2 px-2.5 py-2 text-xs font-medium transition ${tab === t.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4">
                {tab === 'navigation' && (
                    <div>
                        <h3 className="mb-1 text-sm font-semibold text-neutral-900">Header menu</h3>
                        <p className="mb-3 text-xs text-neutral-500">Links shown in the site header. Leave empty to list all pages automatically.</p>
                        <NavEditor items={headerNav} pages={pageRefs} onChange={setHeaderNav} />
                        <h3 className="mb-3 mt-6 text-sm font-semibold text-neutral-900">Footer menu</h3>
                        <NavEditor items={footerNav} pages={pageRefs} onChange={setFooterNav} />
                    </div>
                )}

                {tab === 'header_footer' && (
                    <div className="space-y-5">
                        <div>
                            <h3 className="mb-1 text-sm font-semibold text-neutral-900">Header code</h3>
                            <p className="mb-2 text-xs text-neutral-500">Injected into <code>&lt;head&gt;</code> on every page. Paste your Google Analytics / GA4, Google Tag Manager, Meta Pixel or Google Ads base tag, custom <code>&lt;meta&gt;</code> tags or styles here.</p>
                            <textarea className="input font-mono text-xs" rows={6} value={headCode} onChange={(e) => setHeadCode(e.target.value)} placeholder={'<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>'} />
                        </div>
                        <div>
                            <h3 className="mb-1 text-sm font-semibold text-neutral-900">Footer code</h3>
                            <p className="mb-2 text-xs text-neutral-500">Injected just before <code>&lt;/body&gt;</code> — e.g. a GTM <code>&lt;noscript&gt;</code> fallback or a chat widget.</p>
                            <textarea className="input font-mono text-xs" rows={5} value={bodyCode} onChange={(e) => setBodyCode(e.target.value)} placeholder={'<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXX"></iframe></noscript>'} />
                        </div>
                        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                            Code here <strong>runs on your published site</strong>. To fire a conversion when the enquiry form is submitted, set a tracking event on the <strong>Contact form</strong> block.
                        </p>

                        <div className="border-t border-neutral-100 pt-4">
                            <label className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-neutral-900">Cookie consent banner</span>
                                <input type="checkbox" checked={cookieConsent} onChange={(e) => setCookieConsent(e.target.checked)} />
                            </label>
                            <p className="mt-1 text-xs text-neutral-500">Recommended if you use tracking. When on, the code above only loads <strong>after</strong> a visitor accepts.</p>
                            {cookieConsent && (
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <span className="label mb-1.5 block">Banner message</span>
                                        <textarea className="input" rows={2} value={cookieMessage} onChange={(e) => setCookieMessage(e.target.value)} placeholder="We use cookies to analyse traffic and improve your experience." />
                                    </div>
                                    <div>
                                        <span className="label mb-1.5 block">Privacy policy URL (optional)</span>
                                        <input className="input" value={cookiePolicyUrl} onChange={(e) => setCookiePolicyUrl(e.target.value)} placeholder="/privacy" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'redirects' && (
                    <div>
                        <h3 className="mb-1 text-sm font-semibold text-neutral-900">Redirects</h3>
                        <p className="mb-3 text-xs text-neutral-500">Send an old URL to a new one. “From” is a path on your site (e.g. <code>old-pricing</code>); “To” is a page slug or a full URL.</p>
                        <div className="space-y-2">
                            {redirects.map((r: { from: string; to: string }, i: number) => (
                                <div key={i} className="flex items-center gap-1">
                                    <input className="input flex-1" placeholder="old-path" value={r.from} onChange={(e) => setRedirects(redirects.map((x: any, xi: number) => xi === i ? { ...x, from: e.target.value } : x))} />
                                    <span className="text-neutral-300">→</span>
                                    <input className="input flex-1" placeholder="new-slug or https://…" value={r.to} onChange={(e) => setRedirects(redirects.map((x: any, xi: number) => xi === i ? { ...x, to: e.target.value } : x))} />
                                    <button onClick={() => setRedirects(redirects.filter((_: any, xi: number) => xi !== i))} className="px-1 text-red-500 hover:text-red-700" title="Remove">✕</button>
                                </div>
                            ))}
                            <button onClick={() => setRedirects([...redirects, { from: '', to: '' }])} className="btn-secondary w-full justify-center py-1.5 text-xs">+ Add redirect</button>
                        </div>
                    </div>
                )}

                {tab === 'domain' && site && (
                    <CustomDomainPanel site={site} config={domainConfig ?? { target: null, ip: null }} />
                )}

                {tab === 'theme' && (
                    <div className="space-y-3">
                        <div>
                            <span className="label mb-1.5 block">Accent colour</span>
                            <ColorPicker value={theme.primary_color} onChange={(c) => setTheme({ ...theme, primary_color: c })} />
                        </div>
                        <div>
                            <span className="label mb-1.5 block">Logo colour</span>
                            <ColorPicker value={theme.logo_color ?? ''} onChange={(c) => setTheme({ ...theme, logo_color: c || undefined })} allowClear />
                            <p className="mt-1 text-xs text-neutral-400">Applies to the text logo (site name). Clear to use the default.</p>
                        </div>
                        <div>
                            <span className="label mb-1.5 block">Navigation text colour</span>
                            <ColorPicker value={theme.nav_color ?? ''} onChange={(c) => setTheme({ ...theme, nav_color: c || undefined })} allowClear />
                        </div>
                        <label className="block">
                            <span className="label mb-1.5 block">Title font</span>
                            <select className="input" value={theme.heading_font ?? theme.font} onChange={(e) => setTheme({ ...theme, heading_font: e.target.value })}>
                                {SITE_FONTS.map((f) => (
                                    <option key={f.key} value={f.key}>{f.label}{f.note ? ` — ${f.note}` : ''}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-neutral-400">Used for all headings.</p>
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Body font</span>
                            <select className="input" value={theme.body_font ?? theme.font} onChange={(e) => setTheme({ ...theme, body_font: e.target.value, font: e.target.value === 'serif' ? 'serif' : 'sans' })}>
                                {SITE_FONTS.map((f) => (
                                    <option key={f.key} value={f.key}>{f.label}{f.note ? ` — ${f.note}` : ''}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-neutral-400">Used for paragraphs and everything else.</p>
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Logo &amp; menu font</span>
                            <select className="input" value={theme.logo_font ?? ''} onChange={(e) => setTheme({ ...theme, logo_font: e.target.value })}>
                                <option value="">Same as body font</option>
                                {SITE_FONTS.map((f) => (
                                    <option key={f.key} value={f.key}>{f.label}{f.note ? ` — ${f.note}` : ''}</option>
                                ))}
                            </select>
                        </label>

                        <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3">
                            <label className="block">
                                <span className="label mb-1.5 block">Logo size</span>
                                <select className="input" value={theme.logo_size ?? 'sm'} onChange={(e) => setTheme({ ...theme, logo_size: e.target.value })}>
                                    <option value="sm">Small</option>
                                    <option value="md">Medium</option>
                                    <option value="lg">Large</option>
                                    <option value="xl">Extra large</option>
                                </select>
                            </label>
                            <label className="block">
                                <span className="label mb-1.5 block">Nav text size</span>
                                <select className="input" value={theme.nav_size ?? 'sm'} onChange={(e) => setTheme({ ...theme, nav_size: e.target.value })}>
                                    <option value="sm">Small</option>
                                    <option value="base">Medium</option>
                                    <option value="lg">Large</option>
                                </select>
                            </label>
                        </div>

                        <div className="border-t border-neutral-100 pt-3">
                            <span className="label mb-1.5 block">Logo image</span>
                            {studioLogo ? (
                                <div className="flex items-center gap-3">
                                    <img src={studioLogo} alt="Logo" className="h-10 w-auto max-w-[160px] object-contain" />
                                    <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                                        Replace
                                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
                                    </label>
                                    <button type="button" onClick={removeLogo} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                                </div>
                            ) : (
                                <label className="btn-secondary inline-flex cursor-pointer px-3 py-1.5 text-xs">
                                    Upload logo
                                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
                                </label>
                            )}
                            <p className="mt-1 text-xs text-neutral-400">Shown in the header in place of the site name. PNG or SVG with a transparent background works best.</p>
                        </div>
                    </div>
                )}

                {tab === 'general' && (
                    <div className="space-y-3">
                        <label className="block">
                            <span className="label mb-1.5 block">Site name</span>
                            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                            {errors?.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Web address</span>
                            <div className="flex items-center gap-1 text-sm">
                                <span className="text-neutral-400">/site/</span>
                                <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
                            </div>
                            {errors?.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Contact email</span>
                            <input className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@studio.com" />
                        </label>
                        <div className="mt-2 border-t border-neutral-100 pt-3">
                            <span className="label mb-1.5 block">SEO meta title</span>
                            <input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                        </div>
                        <label className="block">
                            <span className="label mb-1.5 block">SEO meta description</span>
                            <textarea className="input" rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
                        </label>
                        <div className="border-t border-neutral-100 pt-3">
                            <ImageField label="Default social share image (Open Graph)" value={ogImageUrl} onChange={setOgImageUrl} />
                            <p className="mt-1 text-xs text-neutral-400">Shown when your site is shared on social media. Ideally 1200×630. Pages can override this.</p>
                        </div>
                        <div className="border-t border-neutral-100 pt-3">
                            <ImageField label="Favicon" value={faviconUrl} onChange={setFaviconUrl} allowGallery={false} />
                            <p className="mt-1 text-xs text-neutral-400">The little icon in the browser tab. A square PNG works best.</p>
                        </div>
                    </div>
                )}

                {tab === 'templates' && (
                    <div className="space-y-2">
                        <p className="mb-1 text-xs text-neutral-500">“Apply style” keeps all your pages &amp; content and just changes the colours and fonts. “Start fresh” replaces everything with the template’s sample pages.</p>
                        {templates.map((t: SiteTemplateMeta) => (
                            <div key={t.key} className="rounded-lg border border-neutral-200 p-3">
                                <p className="text-sm font-medium text-neutral-800">{t.name}</p>
                                <p className="mt-0.5 text-xs text-neutral-500">{t.description}</p>
                                <div className="mt-2 flex gap-2">
                                    <button onClick={() => applyTemplate(t.key, false)} className="btn-secondary flex-1 justify-center py-1.5 text-xs">Apply style</button>
                                    <button onClick={() => applyTemplate(t.key, true)} className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">Start fresh</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
