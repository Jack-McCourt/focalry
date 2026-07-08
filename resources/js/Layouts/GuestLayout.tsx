import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

const BRAND = 'Focalry';

function Logo({ light = false }: { light?: boolean }) {
    return (
        <Link href="/" className="inline-flex items-center">
            <img
                src={light ? '/images/logo/focalry-logo-white.png' : '/images/logo/focalry-logo.png'}
                alt={BRAND}
                className="h-11 w-auto"
            />
        </Link>
    );
}

const FEATURES = [
    'Deliver galleries your clients will love',
    'Sell prints & digital downloads on autopilot',
    'Manage bookings, invoices & contracts',
    'Build your website in minutes',
];

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen bg-white text-neutral-900">
            {/* ── Brand panel (desktop) ── */}
            <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-neutral-950 p-12 text-white lg:flex xl:w-[55%]">
                {/* gradient glow */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/40 blur-3xl" />
                    <div className="absolute -bottom-28 right-0 h-[30rem] w-[30rem] rounded-full bg-violet-600/30 blur-3xl" />
                    <div className="absolute right-1/4 top-1/3 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl" />
                </div>

                <div className="relative">
                    <Logo light />
                </div>

                <div className="relative max-w-lg">
                    <h1 className="text-4xl font-bold leading-tight tracking-tight">
                        Everything your photography studio needs,{' '}
                        <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-rose-200 bg-clip-text text-transparent">
                            beautifully in one place.
                        </span>
                    </h1>
                    <p className="mt-5 text-lg text-white/60">
                        Client galleries, an online store, your CRM and a website builder — all connected.
                    </p>
                    <ul className="mt-8 space-y-3">
                        {FEATURES.map((f) => (
                            <li key={f} className="flex items-center gap-3 text-sm text-white/75">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                </span>
                                {f}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-xs text-white/40">© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
            </div>

            {/* ── Form panel ── */}
            <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 xl:w-[45%]">
                <div className="mx-auto w-full max-w-sm">
                    <div className="mb-8 lg:hidden">
                        <Logo />
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
