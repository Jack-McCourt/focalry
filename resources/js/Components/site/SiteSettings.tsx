import ColorPicker from '@/Components/ColorPicker';
import CustomDomainPanel from '@/Components/site/CustomDomainPanel';
import { ImageField, NavEditor } from '@/Components/site/editors';
import { SITE_FONTS } from '@/lib/siteFonts';
import { SiteTemplateMeta } from '@/types';
import { router } from '@inertiajs/react';

export type SettingsTabKey = 'navigation' | 'theme' | 'header_footer' | 'custom_css' | 'redirects' | 'domain' | 'general' | 'history' | 'templates';

export const SETTINGS_TABS: { key: SettingsTabKey; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'navigation', label: 'Menus' },
    { key: 'theme', label: 'Theme' },
    { key: 'header_footer', label: 'Header & Footer' },
    { key: 'custom_css', label: 'Custom CSS' },
    { key: 'redirects', label: 'Redirects' },
    { key: 'domain', label: 'Domain' },
    { key: 'history', label: 'History' },
    { key: 'templates', label: 'Templates' },
];

// The site-wide settings form. Shared shape used by the dedicated Settings page.
// Pass `onSave`/`saving` for an explicit Save button (page mode), or `onClose`
// for a "Done" link.
export default function SiteSettings(props: any) {
    const { name, setName, slug, setSlug, contactEmail, setContactEmail, autoCreateProject, setAutoCreateProject, seoTitle, setSeoTitle, seoDescription, setSeoDescription, theme, setTheme, errors, templates, applyTemplate, pageRefs, headerNav, setHeaderNav, footerNav, setFooterNav, headCode, setHeadCode, bodyCode, setBodyCode, customCss, setCustomCss, cookieConsent, setCookieConsent, cookieMessage, setCookieMessage, cookiePolicyUrl, setCookiePolicyUrl, faviconUrl, setFaviconUrl, ogImageUrl, setOgImageUrl, redirects, setRedirects, site, domainConfig, siteLogo, footerLogo, announcement, setAnnouncement, social, setSocial, footerInfo, setFooterInfo, comingSoon, setComingSoon, turnstileSiteKey, setTurnstileSiteKey, turnstileSecretKey, setTurnstileSecretKey, customFonts, setCustomFonts, snapshots, tab, setTab, onClose, onSave, saving } = props;

    const uploadLogo = (file: File) => {
        const fd = new FormData();
        fd.append('logo', file);
        router.post(route('website.logo.upload'), fd, { forceFormData: true, preserveScroll: true });
    };
    const removeLogo = () => router.delete(route('website.logo.delete'), { preserveScroll: true });

    const uploadFooterLogo = (file: File) => {
        const fd = new FormData();
        fd.append('logo', file);
        router.post(route('website.footer-logo.upload'), fd, { forceFormData: true, preserveScroll: true });
    };
    const removeFooterLogo = () => router.delete(route('website.footer-logo.delete'), { preserveScroll: true });

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
                        <NavEditor items={headerNav} pages={pageRefs} onChange={setHeaderNav} allowExtras />
                        <h3 className="mb-3 mt-6 text-sm font-semibold text-neutral-900">Footer menu</h3>
                        <NavEditor items={footerNav} pages={pageRefs} onChange={setFooterNav} />
                    </div>
                )}

                {tab === 'header_footer' && (
                    <div className="space-y-5">
                        {announcement && setAnnouncement && (
                            <div>
                                <label className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-neutral-900">Announcement bar</span>
                                    <input type="checkbox" checked={!!announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} />
                                </label>
                                <p className="mt-1 text-xs text-neutral-500">A slim, dismissible strip above the header — “Booking 2027 weddings now”.</p>
                                {announcement.enabled && (
                                    <div className="mt-3 space-y-3">
                                        <input className="input" placeholder="Announcement text" value={announcement.text ?? ''} onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })} />
                                        <input className="input" placeholder="Link (optional) — /contact or https://…" value={announcement.link ?? ''} onChange={(e) => setAnnouncement({ ...announcement, link: e.target.value })} />
                                        <div>
                                            <span className="label mb-1.5 block">Bar colour</span>
                                            <ColorPicker value={announcement.background ?? ''} onChange={(c: string) => setAnnouncement({ ...announcement, background: c || undefined })} allowClear />
                                            <p className="mt-1 text-xs text-neutral-400">Clear to use your accent colour.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border-t border-neutral-100 pt-4">
                            <h3 className="mb-1 text-sm font-semibold text-neutral-900">Header</h3>
                            <p className="mb-2 text-xs text-neutral-500">The logo shown in your site header, in place of the site name.</p>

                            <div>
                                <span className="label mb-1.5 block">Header logo</span>
                                {siteLogo ? (
                                    <div className="flex items-center gap-3">
                                        <img src={siteLogo} alt="Header logo" className="h-10 w-auto max-w-[160px] object-contain" />
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
                                <p className="mt-1 text-xs text-neutral-400">Shown in the header in place of the site name. PNG or SVG with a transparent background works best. Separate from your studio logo (used on invoices &amp; emails){!siteLogo ? ' — until you upload one, the header shows your site name as text' : ''}.</p>
                                {siteLogo && (
                                    <label className="mt-2 block max-w-[220px]">
                                        <span className="label mb-1.5 block">Header logo size</span>
                                        <select className="input" value={theme.header_logo_size ?? 'medium'} onChange={(e) => setTheme({ ...theme, header_logo_size: e.target.value })}>
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="xlarge">Extra large</option>
                                        </select>
                                    </label>
                                )}
                            </div>
                        </div>

                        {social && setSocial && (
                            <div className="border-t border-neutral-100 pt-4">
                                <h3 className="mb-1 text-sm font-semibold text-neutral-900">Social links</h3>
                                <p className="mb-2 text-xs text-neutral-500">Shown as icons in your site footer.</p>
                                <div className="space-y-2">
                                    {(['instagram', 'facebook', 'pinterest', 'tiktok', 'youtube'] as const).map((k) => (
                                        <div key={k} className="flex items-center gap-2">
                                            <span className="w-20 shrink-0 text-xs capitalize text-neutral-500">{k}</span>
                                            <input className="input flex-1" placeholder={`https://${k === 'youtube' ? 'youtube.com/@you' : `${k}.com/yourstudio`}`} value={social[k] ?? ''} onChange={(e) => setSocial({ ...social, [k]: e.target.value })} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {footerInfo && setFooterInfo && (
                            <div className="border-t border-neutral-100 pt-4">
                                <h3 className="mb-1 text-sm font-semibold text-neutral-900">Footer</h3>
                                <p className="mb-2 text-xs text-neutral-500">Adding any of these upgrades the footer to a multi-column layout (brand · menu · contact).</p>

                                <div className="mb-3">
                                    <span className="label mb-1.5 block">Footer logo</span>
                                    {footerLogo ? (
                                        <div className="flex items-center gap-3">
                                            <img src={footerLogo} alt="Footer logo" className="h-10 w-auto max-w-[160px] object-contain" />
                                            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                                                Replace
                                                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFooterLogo(f); e.target.value = ''; }} />
                                            </label>
                                            <button type="button" onClick={removeFooterLogo} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                                        </div>
                                    ) : (
                                        <label className="btn-secondary inline-flex cursor-pointer px-3 py-1.5 text-xs">
                                            Upload logo
                                            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFooterLogo(f); e.target.value = ''; }} />
                                        </label>
                                    )}
                                    <p className="mt-1 text-xs text-neutral-400">Shown in the footer in place of the site name. Separate from the header logo.</p>
                                    {footerLogo && (
                                        <label className="mt-2 block max-w-[220px]">
                                            <span className="label mb-1.5 block">Footer logo size</span>
                                            <select className="input" value={footerInfo.logo_size ?? 'medium'} onChange={(e) => setFooterInfo({ ...footerInfo, logo_size: e.target.value })}>
                                                <option value="small">Small</option>
                                                <option value="medium">Medium</option>
                                                <option value="large">Large</option>
                                                <option value="xlarge">Extra large</option>
                                            </select>
                                        </label>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <textarea className="input" rows={2} placeholder="Short tagline (optional)" value={footerInfo.tagline ?? ''} onChange={(e) => setFooterInfo({ ...footerInfo, tagline: e.target.value })} />
                                    <input className="input" placeholder="Contact email (optional)" value={footerInfo.email ?? ''} onChange={(e) => setFooterInfo({ ...footerInfo, email: e.target.value })} />
                                    <input className="input" placeholder="Phone (optional)" value={footerInfo.phone ?? ''} onChange={(e) => setFooterInfo({ ...footerInfo, phone: e.target.value })} />
                                    <label className="flex items-center justify-between gap-2 pt-1">
                                        <span className="text-sm text-neutral-700">Show social icons in the footer</span>
                                        <input type="checkbox" checked={footerInfo.show_social !== false} onChange={(e) => setFooterInfo({ ...footerInfo, show_social: e.target.checked })} />
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-neutral-100 pt-4">
                            <h3 className="mb-1 text-sm font-semibold text-neutral-900">Header code</h3>
                            <p className="mb-2 text-xs text-neutral-500">Injected into <code>&lt;head&gt;</code> on every page. Paste your Google Analytics / GA4, Google Tag Manager, Meta Pixel or Google Ads base tag, custom <code>&lt;meta&gt;</code> tags or styles here.</p>
                            <textarea className="input font-mono text-xs" rows={6} value={headCode} onChange={(e) => setHeadCode(e.target.value)} placeholder={'<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>'} />
                        </div>
                        <div>
                            <h3 className="mb-1 text-sm font-semibold text-neutral-900">Footer code</h3>
                            <p className="mb-2 text-xs text-neutral-500">Injected just before <code>&lt;/body&gt;</code> — e.g. a GTM <code>&lt;noscript&gt;</code> fallback or a chat widget.</p>
                            <textarea className="input font-mono text-xs" rows={5} value={bodyCode} onChange={(e) => setBodyCode(e.target.value)} placeholder={'<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXX"></iframe></noscript>'} />
                        </div>
                        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
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

                {tab === 'custom_css' && (
                    <div>
                        <h3 className="mb-1 text-sm font-semibold text-neutral-900">Custom CSS</h3>
                        <p className="mb-2 text-xs text-neutral-500">Added as a <code>&lt;style&gt;</code> tag on every page of your published site, after the theme styles. Target a block with the class you set in its <strong>Style</strong> tab, or the built-in <code>.site-block</code> / <code>.block-&lt;type&gt;</code> hooks.</p>
                        <textarea
                            className="input font-mono text-xs"
                            rows={16}
                            value={customCss}
                            onChange={(e) => setCustomCss(e.target.value)}
                            placeholder={'.block-hero h1 {\n    letter-spacing: 0.04em;\n}\n\n.my-custom-block {\n    background: #faf7f2;\n}'}
                            spellCheck={false}
                        />
                        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                            Tip: give a block a class in its <strong>Style → Custom class</strong> field, then style it here with <code>.your-class</code>.
                        </p>
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
                        <div>
                            <span className="label mb-1.5 block">Body text colour</span>
                            <ColorPicker value={theme.text_color ?? ''} onChange={(c) => setTheme({ ...theme, text_color: c || undefined })} allowClear />
                            <p className="mt-1 text-xs text-neutral-400">Overrides the general text colour across your pages. Clear to use the default.</p>
                        </div>
                        <label className="block">
                            <span className="label mb-1.5 block">Title font</span>
                            <select className="input" value={theme.heading_font ?? theme.font} onChange={(e) => setTheme({ ...theme, heading_font: e.target.value })}>
                                {SITE_FONTS.map((f) => (
                                    <option key={f.key} value={f.key}>{f.label}{f.note ? ` — ${f.note}` : ''}</option>
                                ))}
                                {(customFonts ?? []).map((f: { name: string }) => (
                                    <option key={`c-${f.name}`} value={`custom:${f.name}`}>{f.name} — custom</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-neutral-400">Used for all headings.</p>
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Title weight</span>
                            <select className="input" value={theme.heading_weight ?? ''} onChange={(e) => setTheme({ ...theme, heading_weight: e.target.value ? Number(e.target.value) : undefined })}>
                                <option value="">Default (font's own)</option>
                                <option value="300">Light</option>
                                <option value="400">Regular</option>
                                <option value="500">Medium</option>
                                <option value="600">Semibold</option>
                                <option value="700">Bold</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Body font</span>
                            <select className="input" value={theme.body_font ?? theme.font} onChange={(e) => setTheme({ ...theme, body_font: e.target.value, font: e.target.value === 'serif' ? 'serif' : 'sans' })}>
                                {SITE_FONTS.map((f) => (
                                    <option key={f.key} value={f.key}>{f.label}{f.note ? ` — ${f.note}` : ''}</option>
                                ))}
                                {(customFonts ?? []).map((f: { name: string }) => (
                                    <option key={`c-${f.name}`} value={`custom:${f.name}`}>{f.name} — custom</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-neutral-400">Used for paragraphs and everything else.</p>
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Body weight</span>
                            <select className="input" value={theme.body_weight ?? ''} onChange={(e) => setTheme({ ...theme, body_weight: e.target.value ? Number(e.target.value) : undefined })}>
                                <option value="">Default (font's own)</option>
                                <option value="300">Light</option>
                                <option value="400">Regular</option>
                                <option value="500">Medium</option>
                                <option value="600">Semibold</option>
                                <option value="700">Bold</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Logo &amp; menu font</span>
                            <select className="input" value={theme.logo_font ?? ''} onChange={(e) => setTheme({ ...theme, logo_font: e.target.value })}>
                                <option value="">Same as body font</option>
                                {SITE_FONTS.map((f) => (
                                    <option key={f.key} value={f.key}>{f.label}{f.note ? ` — ${f.note}` : ''}</option>
                                ))}
                                {(customFonts ?? []).map((f: { name: string }) => (
                                    <option key={`c-${f.name}`} value={`custom:${f.name}`}>{f.name} — custom</option>
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

                        <label className="block border-t border-neutral-100 pt-3">
                            <span className="label mb-1.5 block">Header style</span>
                            <select className="input" value={theme.header_style ?? 'solid'} onChange={(e) => setTheme({ ...theme, header_style: e.target.value })}>
                                <option value="solid">Solid bar</option>
                                <option value="transparent">Transparent over hero (solid on scroll)</option>
                            </select>
                            <p className="mt-1 text-xs text-neutral-400">Transparent looks best when pages start with a full-width hero image.</p>
                        </label>

                        {setCustomFonts && (
                            <div className="border-t border-neutral-100 pt-3">
                                <span className="label mb-1.5 block">Custom fonts (.woff2)</span>
                                <p className="mb-2 text-xs text-neutral-400">Upload up to 4 brand fonts — they appear in the font pickers above as “— custom”.</p>
                                {(customFonts ?? []).map((f: { name: string; url: string }, i: number) => (
                                    <div key={i} className="mb-1.5 flex items-center gap-2">
                                        <input className="input flex-1 py-1 text-sm" value={f.name} onChange={(e) => setCustomFonts(customFonts.map((x: any, xi: number) => xi === i ? { ...x, name: e.target.value } : x))} />
                                        <button type="button" onClick={() => setCustomFonts(customFonts.filter((_: any, xi: number) => xi !== i))} className="px-1 text-red-500 hover:text-red-700" title="Remove font">✕</button>
                                    </div>
                                ))}
                                {(customFonts ?? []).length < 4 && (
                                    <label className="btn-secondary inline-flex cursor-pointer px-3 py-1.5 text-xs">
                                        Upload font
                                        <input type="file" accept=".woff2,.woff" className="hidden" onChange={async (e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (!f) return;
                                            const fd = new FormData();
                                            fd.append('font', f);
                                            try {
                                                const res = await (window as any).axios.post(route('website.upload.font'), fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                setCustomFonts([...(customFonts ?? []), { name: res.data.name, url: res.data.url }]);
                                            } catch { alert('Upload failed — use a .woff2 file under 2MB.'); }
                                        }} />
                                    </label>
                                )}
                            </div>
                        )}

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
                        <div className="border-t border-neutral-100 pt-3">
                            <label className="flex items-start justify-between gap-3">
                                <span>
                                    <span className="label block">Create a project for each enquiry</span>
                                    <span className="mt-0.5 block text-xs text-neutral-400">Automatically add a CRM project (a “Lead”) when someone submits a contact form. A notification and contact are created either way.</span>
                                </span>
                                <input type="checkbox" className="mt-0.5 shrink-0" checked={autoCreateProject} onChange={(e) => setAutoCreateProject(e.target.checked)} />
                            </label>
                        </div>
                        {setComingSoon && (
                            <div className="border-t border-neutral-100 pt-3">
                                <label className="flex items-start justify-between gap-3">
                                    <span>
                                        <span className="label block">“Coming soon” page while unpublished</span>
                                        <span className="mt-0.5 block text-xs text-neutral-400">Until you publish, visitors see a branded holding page (logo, name, contact email) instead of a 404.</span>
                                    </span>
                                    <input type="checkbox" className="mt-0.5 shrink-0" checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} />
                                </label>
                            </div>
                        )}
                        {setTurnstileSiteKey && (
                            <div className="border-t border-neutral-100 pt-3">
                                <span className="label mb-1.5 block">Spam protection — Cloudflare Turnstile (optional)</span>
                                <p className="mb-2 text-xs text-neutral-400">
                                    Create a free widget at <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">Cloudflare → Turnstile</a> (mode: <strong>Managed</strong>), add your domain{site?.custom_domain ? <> (<code>{site.custom_domain}</code>)</> : null} to its hostnames, and paste both keys here. Then enable “Spam protection” on your contact form block.
                                </p>
                                <div className="space-y-2">
                                    <input className="input" placeholder="Site key (0x…)" value={turnstileSiteKey} onChange={(e) => setTurnstileSiteKey(e.target.value)} />
                                    <input
                                        className="input"
                                        type="password"
                                        placeholder={site?.turnstile_secret_set ? 'Secret key — saved (leave blank to keep)' : 'Secret key'}
                                        value={turnstileSecretKey}
                                        onChange={(e) => setTurnstileSecretKey(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                </div>
                                {site?.turnstile_secret_set && <p className="mt-1 text-xs text-neutral-400">Clearing the site key removes both keys.</p>}
                            </div>
                        )}
                        {site && (
                            <div className="border-t border-neutral-100 pt-3">
                                <span className="label mb-1.5 block">Draft preview link</span>
                                <p className="mb-2 text-xs text-neutral-400">A private link that shows your current draft (unindexed) — share it with a partner before publishing.</p>
                                {site.preview_url ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input className="input flex-1 text-xs" readOnly value={site.preview_url} onFocus={(e) => e.target.select()} />
                                            <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={() => navigator.clipboard?.writeText(site.preview_url!)}>Copy</button>
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="button" className="text-xs text-neutral-500 hover:text-neutral-800" onClick={() => router.post(route('website.preview.create'), {}, { preserveScroll: true })}>Rotate link</button>
                                            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => router.delete(route('website.preview.revoke'), { preserveScroll: true })}>Revoke</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => router.post(route('website.preview.create'), {}, { preserveScroll: true })}>Create preview link</button>
                                )}
                            </div>
                        )}
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
                            <ImageField label="Favicon" value={faviconUrl} onChange={setFaviconUrl} allowGallery={false} iconPreview />
                            <p className="mt-1 text-xs text-neutral-400">The little icon in the browser tab. A square PNG works best.</p>
                        </div>
                    </div>
                )}

                {tab === 'history' && (
                    <div className="space-y-2">
                        <p className="mb-1 text-xs text-neutral-500">Every publish is kept here (last 10). Restoring loads that version into your <strong>draft</strong> — review it in the builder, then press Publish to put it live.</p>
                        {(snapshots ?? []).length === 0 ? (
                            <p className="rounded-lg border-2 border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-400">No published versions yet — versions appear here each time you publish.</p>
                        ) : (
                            (snapshots as { id: number; published_at: string; pages: number; name: string }[]).map((sn, i) => (
                                <div key={sn.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-800">
                                            {new Date(sn.published_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            {i === 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Current live</span>}
                                        </p>
                                        <p className="mt-0.5 text-xs text-neutral-400">{sn.name} · {sn.pages} pages</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                                        onClick={() => { if (confirm('Restore this version into your draft? Your current draft (if any) will be replaced.')) router.post(route('website.snapshots.restore', sn.id)); }}
                                    >
                                        Restore as draft
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {tab === 'templates' && (
                    <div>
                        <p className="mb-3 text-xs text-neutral-500">“Apply style” keeps all your pages &amp; content and just changes the colours and fonts. “Start fresh” replaces everything with the template’s sample pages.</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {templates.map((t: SiteTemplateMeta) => (
                                <div key={t.key} className={`group flex flex-col overflow-hidden rounded-xl border transition ${site.template === t.key ? 'border-brand-500 ring-1 ring-brand-500' : 'border-neutral-200 hover:border-neutral-300 hover:shadow-md'}`}>
                                    <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
                                        <img
                                            src={t.thumbnail}
                                            alt={`${t.name} template preview`}
                                            loading="lazy"
                                            className="absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        {site.template === t.key && (
                                            <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white shadow">Current</span>
                                        )}
                                    </div>
                                    <div className="flex flex-1 flex-col p-3">
                                        <p className="text-sm font-medium text-neutral-800">{t.name}</p>
                                        <p className="mt-0.5 flex-1 text-xs leading-relaxed text-neutral-500">{t.description}</p>
                                        <div className="mt-3 flex gap-2">
                                            <button onClick={() => applyTemplate(t.key, false)} className="btn-secondary flex-1 justify-center py-1.5 text-xs">Apply style</button>
                                            <button onClick={() => applyTemplate(t.key, true)} className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">Start fresh</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
