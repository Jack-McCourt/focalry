import PrimaryButton from '@/Components/PrimaryButton';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

function csrf(): string {
    const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

const postOpts = () => ({ headers: { 'X-XSRF-TOKEN': csrf() } });

export default function StripeConnectCard({
    status,
    stripeKey,
    className = '',
}: {
    status: string | null;
    stripeKey: string;
    className?: string;
}) {
    const [setup, setSetup] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [connectInstance, setConnectInstance] = useState<any>(null);

    const isActive = status === 'active';
    const isPending = status === 'pending';

    const begin = async () => {
        setError(null);
        setBusy(true);
        try {
            // Probe first so "Connect not enabled" surfaces as a clean message
            // rather than a broken embedded component.
            await axios.post(route('stripe.connect.session'), {}, postOpts());
        } catch (e: unknown) {
            const ax = e as { response?: { data?: { message?: string } } };
            setError(ax.response?.data?.message ?? 'Could not start Stripe setup. Please try again.');
            setBusy(false);
            return;
        }

        const instance = loadConnectAndInitialize({
            publishableKey: stripeKey,
            fetchClientSecret: async () => {
                const res = await axios.post(route('stripe.connect.session'), {}, postOpts());
                return res.data.client_secret as string;
            },
        });
        setConnectInstance(instance);
        setSetup(true);
        setBusy(false);
    };

    const finish = async () => {
        try {
            await axios.post(route('stripe.connect.refresh'), {}, postOpts());
        } catch {
            // status will simply stay as-is
        }
        setSetup(false);
        setConnectInstance(null);
        router.reload({ only: ['studio'] });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Online payments</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Connect a Stripe account to let clients pay invoices online. Funds go straight to
                    your account.
                </p>
            </header>

            {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="mt-6">
                {setup && connectInstance ? (
                    <div className="rounded-lg border border-gray-200 p-3">
                        <ConnectComponentsProvider connectInstance={connectInstance}>
                            <ConnectAccountOnboarding onExit={finish} />
                        </ConnectComponentsProvider>
                        <button onClick={finish} className="mt-3 text-sm text-gray-500 underline hover:text-gray-800">
                            Done / close
                        </button>
                    </div>
                ) : isActive ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-sm font-medium text-emerald-800">Stripe connected</span>
                        </div>
                        <button onClick={begin} disabled={busy} className="text-sm text-emerald-700 underline hover:text-emerald-900">
                            {busy ? 'Opening…' : 'Manage'}
                        </button>
                    </div>
                ) : isPending ? (
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <span className="text-sm font-medium text-amber-800">
                            Onboarding incomplete — finish setup to accept payments.
                        </span>
                        <button onClick={begin} disabled={busy} className="text-sm text-amber-800 underline hover:text-amber-900">
                            {busy ? 'Opening…' : 'Continue'}
                        </button>
                    </div>
                ) : (
                    <PrimaryButton onClick={begin} disabled={busy}>
                        {busy ? 'Opening…' : 'Set up payments'}
                    </PrimaryButton>
                )}
            </div>
        </section>
    );
}
