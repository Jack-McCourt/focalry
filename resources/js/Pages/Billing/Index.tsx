import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { PlanFeature, PlanKey } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

interface Tier {
    key: PlanKey;
    name: string;
    tagline: string;
    price: number; // monthly, in cents
    storage: number | null; // bytes, null = unlimited
    commission_rate: number;
    features: PlanFeature[];
    has_stripe_price: boolean;
}

interface Props {
    tiers: Tier[];
    featureLabels: Record<PlanFeature, string>;
    currency: string;
    currentPlan: PlanKey;
    storage: { used: number; limit: number | null };
    subscription: {
        active: boolean;
        on_grace_period: boolean;
        cancelled: boolean;
        ends_at: string | null;
    } | null;
}

function formatBytes(bytes: number | null): string {
    if (bytes === null) return 'Unlimited';
    const TB = 1024 ** 4;
    const GB = 1024 ** 3;
    const MB = 1024 ** 2;
    if (bytes >= TB) return `${+(bytes / TB).toFixed(bytes % TB === 0 ? 0 : 1)} TB`;
    if (bytes >= GB) return `${+(bytes / GB).toFixed(bytes % GB === 0 ? 0 : 1)} GB`;
    if (bytes >= MB) return `${+(bytes / MB).toFixed(1)} MB`;
    return `${bytes} B`;
}

export default function BillingIndex({ tiers, featureLabels, currency, currentPlan, storage, subscription }: Props) {
    const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
    const [busy, setBusy] = useState<string | null>(null);

    const order = tiers.map((t) => t.key);
    const currentIndex = order.indexOf(currentPlan);

    const usedPct =
        storage.limit && storage.limit > 0 ? Math.min(100, Math.round((storage.used / storage.limit) * 100)) : null;

    const subscribe = (plan: PlanKey) => {
        setBusy(plan);
        router.post(
            route('billing.subscribe'),
            { plan, interval },
            { onFinish: () => setBusy(null) },
        );
    };

    const portal = () => {
        setBusy('portal');
        router.post(route('billing.portal'), {}, { onFinish: () => setBusy(null) });
    };

    // Yearly = 10× the monthly price (2 months free), matching the backend prices.
    const displayPrice = (tier: Tier) => (interval === 'yearly' ? tier.price * 10 : tier.price);

    const allFeatures = Object.keys(featureLabels) as PlanFeature[];

    return (
        <AuthenticatedLayout>
            <Head title="Plans & Billing" />

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-neutral-900">Plans &amp; Billing</h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        Choose the plan that fits your studio. Upgrade any time — your storage and unlocked areas update
                        immediately.
                    </p>
                </div>

                {/* Storage usage */}
                <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-neutral-900">Storage used</p>
                            <p className="text-xs text-neutral-500">
                                {formatBytes(storage.used)} of {formatBytes(storage.limit)}
                            </p>
                        </div>
                        {subscription?.active && (
                            <button
                                onClick={portal}
                                disabled={busy === 'portal'}
                                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            >
                                Manage billing
                            </button>
                        )}
                    </div>
                    {usedPct !== null && (
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                            <div
                                className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : 'bg-brand'}`}
                                style={{ width: `${usedPct}%` }}
                            />
                        </div>
                    )}
                </div>

                {subscription?.cancelled && subscription.ends_at && (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Your subscription is cancelled and will end on{' '}
                        {new Date(subscription.ends_at).toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                        })}
                        . Re-subscribe below to keep your plan.
                    </div>
                )}

                {/* Billing interval toggle */}
                <div className="mb-6 flex items-center justify-center gap-3">
                    <span className={`text-sm ${interval === 'monthly' ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>
                        Monthly
                    </span>
                    <button
                        type="button"
                        onClick={() => setInterval((i) => (i === 'monthly' ? 'yearly' : 'monthly'))}
                        className={`relative h-6 w-11 rounded-full transition ${interval === 'yearly' ? 'bg-brand' : 'bg-neutral-300'}`}
                        aria-label="Toggle billing interval"
                    >
                        <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${interval === 'yearly' ? 'left-[22px]' : 'left-0.5'}`}
                        />
                    </button>
                    <span className={`text-sm ${interval === 'yearly' ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>
                        Yearly <span className="text-emerald-600">(2 months free)</span>
                    </span>
                </div>

                {/* Plan cards */}
                <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-5">
                    {tiers.map((tier, idx) => {
                        const isCurrent = tier.key === currentPlan;
                        const isFree = tier.key === 'free';
                        const isDowngrade = idx < currentIndex;
                        const unavailable = !isFree && !tier.has_stripe_price;

                        let cta = 'Upgrade';
                        if (isCurrent) cta = 'Current plan';
                        else if (isFree) cta = 'Downgrade to Free';
                        else if (isDowngrade) cta = 'Downgrade';

                        return (
                            <div
                                key={tier.key}
                                className={`flex flex-col rounded-2xl border bg-white p-5 ${
                                    isCurrent ? 'border-brand ring-1 ring-brand' : 'border-neutral-200'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-neutral-900">{tier.name}</h3>
                                    {isCurrent && (
                                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                                            Current
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 min-h-[32px] text-xs text-neutral-500">{tier.tagline}</p>

                                <div className="mt-4">
                                    <span className="text-2xl font-bold text-neutral-900">
                                        {tier.price === 0 ? 'Free' : formatMoney(displayPrice(tier), currency)}
                                    </span>
                                    {tier.price > 0 && (
                                        <span className="text-sm text-neutral-500">/{interval === 'yearly' ? 'yr' : 'mo'}</span>
                                    )}
                                </div>

                                <div className="mt-4 space-y-2 text-sm text-neutral-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Storage</span>
                                        <span className="font-medium">{formatBytes(tier.storage)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Store commission</span>
                                        <span className="font-medium">{tier.commission_rate}%</span>
                                    </div>
                                </div>

                                <ul className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-sm">
                                    {allFeatures.map((f) => {
                                        const included = tier.features.includes(f);
                                        return (
                                            <li
                                                key={f}
                                                className={`flex items-center gap-2 ${included ? 'text-neutral-700' : 'text-neutral-300'}`}
                                            >
                                                <span className={included ? 'text-emerald-500' : 'text-neutral-300'}>
                                                    {included ? '✓' : '–'}
                                                </span>
                                                {featureLabels[f]}
                                            </li>
                                        );
                                    })}
                                </ul>

                                <button
                                    disabled={isCurrent || unavailable || busy === tier.key}
                                    onClick={() => subscribe(tier.key)}
                                    className={`mt-5 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                        isCurrent
                                            ? 'cursor-default bg-neutral-100 text-neutral-400'
                                            : unavailable
                                              ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                                              : isDowngrade || isFree
                                                ? 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                                                : 'bg-brand text-white hover:bg-brand-700'
                                    }`}
                                >
                                    {unavailable ? 'Coming soon' : busy === tier.key ? 'Working…' : cta}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
