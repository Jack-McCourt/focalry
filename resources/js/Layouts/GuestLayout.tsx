import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

const BRAND = 'Focalry';

function CameraIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
            />
        </svg>
    );
}

function Logo({ light = false }: { light?: boolean }) {
    return (
        <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                <CameraIcon className="h-5 w-5" />
            </span>
            <span className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-neutral-900'}`}>{BRAND}</span>
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
