import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SiteSettings, { SettingsTabKey } from '@/Components/site/SiteSettings';
import { useUrlState } from '@/lib/useUrlState';
import { PageProps, SiteData, SiteNavItem, SiteTemplateMeta, SiteTheme } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

export default function Settings({ site, templates, public_url, domain_config, studio_logo, site_logo, snapshots }: PageProps<{ site: SiteData; templates: SiteTemplateMeta[]; public_url: string; domain_config: { target: string | null; ip: string | null }; studio_logo: string | null; site_logo: string | null; snapshots?: { id: number; published_at: string; pages: number; name: string }[] }>) {
    const [name, setName] = useState(site.name);
    const [slug, setSlug] = useState(site.slug);
    const [contactEmail, setContactEmail] = useState(site.contact_email ?? '');
    const [autoCreateProject, setAutoCreateProject] = useState(site.auto_create_project ?? true);
    const [seoTitle, setSeoTitle] = useState(site.seo_title ?? '');
    const [seoDescription, setSeoDescription] = useState(site.seo_description ?? '');
    const [faviconUrl, setFaviconUrl] = useState(site.favicon_url ?? '');
    const [ogImageUrl, setOgImageUrl] = useState(site.og_image_url ?? '');
    const [redirects, setRedirects] = useState<{ from: string; to: string }[]>(site.redirects ?? []);
    const [theme, setTheme] = useState<SiteTheme>(site.theme);
    const [headerNav, setHeaderNav] = useState<SiteNavItem[]>(site.header_nav ?? []);
    const [footerNav, setFooterNav] = useState<SiteNavItem[]>(site.footer_nav ?? []);
    const [headCode, setHeadCode] = useState(site.head_code ?? '');
    const [bodyCode, setBodyCode] = useState(site.body_code ?? '');
    const [customCss, setCustomCss] = useState(site.custom_css ?? '');
    const [cookieConsent, setCookieConsent] = useState(!!site.cookie_consent);
    const [cookieMessage, setCookieMessage] = useState(site.cookie_message ?? '');
    const [cookiePolicyUrl, setCookiePolicyUrl] = useState(site.cookie_policy_url ?? '');
    const [announcement, setAnnouncement] = useState<Record<string, any>>(site.announcement ?? {});
    const [social, setSocial] = useState<Record<string, string>>((site.social as Record<string, string>) ?? {});
    const [footerInfo, setFooterInfo] = useState<Record<string, any>>(site.footer ?? {});
    const [comingSoon, setComingSoon] = useState(!!site.coming_soon);
    const [turnstileSiteKey, setTurnstileSiteKey] = useState(site.turnstile_site_key ?? '');
    const [turnstileSecretKey, setTurnstileSecretKey] = useState('');
    const [customFonts, setCustomFonts] = useState<{ name: string; url: string }[]>(site.custom_fonts ?? []);
    const [tab, setTab] = useUrlState<SettingsTabKey>('tab', 'general');
    const [saving, setSaving] = useState(false);

    const errors = usePage().props.errors as Record<string, string>;
    const pageRefs = site.pages.filter((p) => !p.is_post).map((p) => ({ title: p.title, slug: p.slug, is_home: !!p.is_home }));

    const applyTemplate = async (key: string, replace = false) => {
        const msg = replace
            ? 'Replace all pages and content with this template’s sample pages? This cannot be undone.'
            : 'Apply this template’s colours & fonts? Your pages and content are kept.';
        if (!(await confirmDialog(msg))) return;
        router.post(route('website.template'), { template: key, replace }, { onSuccess: () => location.reload() });
    };

    const save = () => {
        const payload = {
            name,
            slug,
            contact_email: contactEmail,
            auto_create_project: autoCreateProject,
            seo_title: seoTitle,
            seo_description: seoDescription,
            favicon_url: faviconUrl,
            og_image_url: ogImageUrl,
            redirects,
            theme,
            header_nav: headerNav,
            footer_nav: footerNav,
            head_code: headCode,
            body_code: bodyCode,
            custom_css: customCss,
            cookie_consent: cookieConsent,
            cookie_message: cookieMessage,
            cookie_policy_url: cookiePolicyUrl,
            announcement,
            social,
            footer: footerInfo,
            coming_soon: comingSoon,
            turnstile_site_key: turnstileSiteKey,
            turnstile_secret_key: turnstileSecretKey,
            custom_fonts: customFonts,
        };
        router.patch(route('website.settings'), payload as any, {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Website settings</h1>
                    <a href={public_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">View site →</a>
                </div>
            }
            actions={
                <>
                    <Link href={route('website.edit')} className="btn-secondary">Back to editor</Link>
                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
                </>
            }
        >
            <Head title="Website settings" />

            <div className="my-6 w-full px-4 sm:px-6">
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                    <SiteSettings
                        {...{ name, setName, slug, setSlug, contactEmail, setContactEmail, autoCreateProject, setAutoCreateProject, seoTitle, setSeoTitle, seoDescription, setSeoDescription, theme, setTheme, errors, templates, applyTemplate }}
                        faviconUrl={faviconUrl}
                        setFaviconUrl={setFaviconUrl}
                        ogImageUrl={ogImageUrl}
                        setOgImageUrl={setOgImageUrl}
                        pageRefs={pageRefs}
                        headerNav={headerNav}
                        setHeaderNav={setHeaderNav}
                        footerNav={footerNav}
                        setFooterNav={setFooterNav}
                        headCode={headCode}
                        setHeadCode={setHeadCode}
                        bodyCode={bodyCode}
                        setBodyCode={setBodyCode}
                        customCss={customCss}
                        setCustomCss={setCustomCss}
                        cookieConsent={cookieConsent}
                        setCookieConsent={setCookieConsent}
                        cookieMessage={cookieMessage}
                        setCookieMessage={setCookieMessage}
                        cookiePolicyUrl={cookiePolicyUrl}
                        setCookiePolicyUrl={setCookiePolicyUrl}
                        redirects={redirects}
                        setRedirects={setRedirects}
                        site={site}
                        domainConfig={domain_config}
                        studioLogo={studio_logo}
                        siteLogo={site_logo}
                        footerLogo={site.footer_logo}
                        announcement={announcement}
                        setAnnouncement={setAnnouncement}
                        social={social}
                        setSocial={setSocial}
                        footerInfo={footerInfo}
                        setFooterInfo={setFooterInfo}
                        comingSoon={comingSoon}
                        setComingSoon={setComingSoon}
                        turnstileSiteKey={turnstileSiteKey}
                        setTurnstileSiteKey={setTurnstileSiteKey}
                        turnstileSecretKey={turnstileSecretKey}
                        setTurnstileSecretKey={setTurnstileSecretKey}
                        customFonts={customFonts}
                        setCustomFonts={setCustomFonts}
                        snapshots={snapshots ?? []}
                        tab={tab}
                        setTab={setTab}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
