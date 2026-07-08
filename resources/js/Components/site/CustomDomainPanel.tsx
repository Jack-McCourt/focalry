import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface SiteDomain {
    custom_domain: string | null;
    domain_token: string | null;
    domain_verified: boolean;
    domain_live: boolean;
}

/** A copyable DNS record row. */
function Record({ type, host, value }: { type: string; host: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
            <span className="font-semibold text-neutral-500">{type}</span>
            <div className="min-w-0">
                <div className="truncate text-neutral-500">Host: <span className="font-mono text-neutral-800">{host}</span></div>
                <div className="truncate text-neutral-500">Value: <span className="font-mono text-neutral-800">{value}</span></div>
            </div>
            <button type="button" onClick={copy} className="shrink-0 rounded border border-neutral-200 bg-white px-2 py-1 font-medium text-neutral-600 hover:bg-neutral-100">
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
}

export default function CustomDomainPanel({ site, config }: { site: SiteDomain; config: { target: string | null; ip: string | null } }) {
    const form = useForm({ custom_domain: site.custom_domain ?? '' });
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const connect = (e: React.FormEvent) => {
        e.preventDefault();
        setVerifyError(null);
        form.post(route('website.domain.update'), { preserveScroll: true });
    };

    const verify = () => {
        setVerifying(true);
        setVerifyError(null);
        router.post(route('website.domain.verify'), {}, {
            preserveScroll: true,
            onError: (errors) => setVerifyError((errors.custom_domain as string) ?? 'Verification failed.'),
            onFinish: () => setVerifying(false),
        });
    };

    const disconnect = async () => {
        if (!(await confirmDialog('Disconnect this custom domain? Your site will go back to its focalry URL.'))) return;
        router.delete(route('website.domain.remove'), { preserveScroll: true });
    };

    const domain = site.custom_domain;
    const apex = domain && domain.split('.').length === 2; // e.g. example.com (vs www.example.com)

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-sm font-semibold text-neutral-900">Custom domain</h3>
                <p className="mt-1 text-xs text-neutral-500">Serve your website on your own domain (e.g. yourstudio.com) instead of the focalry address.</p>
            </div>

            <form onSubmit={connect} className="flex items-end gap-2">
                <label className="flex-1">
                    <span className="label mb-1.5 block">Domain</span>
                    <input
                        className="input"
                        placeholder="yourstudio.com"
                        value={form.data.custom_domain}
                        onChange={(e) => form.setData('custom_domain', e.target.value)}
                    />
                </label>
                <button type="submit" disabled={form.processing} className="btn-primary px-3 py-2 text-xs">
                    {domain ? 'Update' : 'Connect'}
                </button>
            </form>
            {form.errors.custom_domain && <p className="text-xs text-red-600">{form.errors.custom_domain}</p>}

            {domain && (
                <div className="space-y-4 rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-neutral-900">{domain}</span>
                        {site.domain_live ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Live</span>
                        ) : site.domain_verified ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Verified — issuing certificate…</span>
                        ) : (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">Pending verification</span>
                        )}
                    </div>

                    {!site.domain_verified && (
                        <>
                            <p className="text-xs text-neutral-500">Add these records at your domain registrar, then click Verify. DNS changes can take a few minutes (sometimes longer) to propagate.</p>
                            <div className="space-y-2">
                                <Record type="TXT" host={`_focalry-verify.${domain}`} value={site.domain_token ?? ''} />
                                {apex
                                    ? config.ip && <Record type="A" host="@" value={config.ip} />
                                    : config.target && <Record type="CNAME" host={domain.split('.')[0]} value={config.target} />}
                            </div>
                            <button type="button" onClick={verify} disabled={verifying} className="btn-secondary px-3 py-1.5 text-xs">
                                {verifying ? 'Verifying…' : 'Verify domain'}
                            </button>
                            {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
                        </>
                    )}

                    {site.domain_verified && !site.domain_live && (
                        <p className="text-xs text-neutral-500">Ownership confirmed. Your certificate is being issued automatically — this usually takes a few minutes, after which your site is live on {domain}.</p>
                    )}

                    {site.domain_live && (
                        <p className="text-xs text-neutral-500">
                            Your site is live at{' '}
                            <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">https://{domain}</a>.
                        </p>
                    )}

                    <button type="button" onClick={disconnect} className="text-xs font-medium text-red-600 hover:underline">Disconnect domain</button>
                </div>
            )}
        </div>
    );
}
