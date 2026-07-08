import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ReactNode } from 'react';

/** The platform's brand name. */
const BRAND = 'Focalry';

/* ─────────────────────────────  Icons  ───────────────────────────── */

type IconProps = { className?: string };
const Icon = ({ className = 'h-6 w-6', d }: IconProps & { d: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);

const CameraIcon = (p: IconProps) => <Icon {...p} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />;
const UploadIcon = (p: IconProps) => <Icon {...p} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />;
const StoreIcon = (p: IconProps) => <Icon {...p} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />;
const UsersIcon = (p: IconProps) => <Icon {...p} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />;
const BoltIcon = (p: IconProps) => <Icon {...p} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />;
const GlobeIcon = (p: IconProps) => <Icon {...p} d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0a8.949 8.949 0 004.951-1.488A3.987 3.987 0 0013 16h-2a3.987 3.987 0 00-3.951 3.512A8.949 8.949 0 0012 21zm3-11.25a3 3 0 11-6 0 3 3 0 016 0z" />;
const CalendarIcon = (p: IconProps) => <Icon {...p} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />;
const HeartIcon = (p: IconProps) => <Icon {...p} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />;
const ShieldIcon = (p: IconProps) => <Icon {...p} d="M9 12.75L11.25 15 15 9.75M21 12c0 5.591-3.824 10.29-9 11.622C6.824 22.29 3 17.591 3 12V5.25l9-3 9 3V12z" />;
const SparkIcon = (p: IconProps) => <Icon {...p} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />;
const CheckIcon = (p: IconProps) => <Icon {...p} d="M4.5 12.75l6 6 9-13.5" />;
const ArrowIcon = (p: IconProps) => <Icon {...p} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />;

/* ─────────────────────────  Building blocks  ───────────────────────── */

function Screenshot({ label, src, className = '', ratio = 'aspect-[16/10]' }: { label: string; src?: string; className?: string; ratio?: string }) {
    if (src) {
        return (
            <div className={`relative overflow-hidden rounded-xl ${ratio} ${className}`}>
                <img src={src} alt={label} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
            </div>
        );
    }

    // Placeholder until a real screenshot is provided.
    return (
        <div className={`relative overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-gradient-to-br from-neutral-50 to-neutral-100 ${ratio} ${className}`}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <CameraIcon className="h-7 w-7" />
                <span className="px-4 text-center text-[11px] font-semibold uppercase tracking-[0.15em]">{label}</span>
            </div>
        </div>
    );
}

function BrowserFrame({ children }: { children: ReactNode }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/10 ring-1 ring-black/5">
            <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400/70" />
                <span className="h-3 w-3 rounded-full bg-amber-400/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
                <div className="mx-auto h-5 w-full max-w-xs rounded-md border border-neutral-200 bg-white" />
            </div>
            <div className="bg-white p-2 sm:p-3">{children}</div>
        </div>
    );
}

const PILLARS = [
    { icon: CameraIcon, title: 'Client galleries', body: 'Cinematic, masonry galleries with favourites, private access and controlled downloads.' },
    { icon: UploadIcon, title: 'Lightroom plugin', body: 'Publish straight from Lightroom Classic — collections and sets sync to the cloud.' },
    { icon: StoreIcon, title: 'Print & digital store', body: 'Sell in-gallery with automatic lab fulfilment and instant digital delivery.' },
    { icon: UsersIcon, title: 'Studio manager', body: 'Contacts, projects, invoices and contracts — your whole business in one CRM.' },
    { icon: BoltIcon, title: 'Automations', body: 'Tasks, questionnaires, proposals and workflows that run while you shoot.' },
    { icon: GlobeIcon, title: 'Your own website', body: 'A block-based site builder with a lead-capturing contact form, no code.' },
];

type Feature = { eyebrow: string; title: string; body: string; points: string[]; shot: string; src?: string; reverse?: boolean };
const FEATURES: Feature[] = [
    {
        eyebrow: 'Client galleries',
        title: 'Galleries your clients will actually swoon over',
        body: 'Deliver work in a fast, full-screen experience. Masonry layouts adapt to every crop, photos are ordered the way the day unfolded, and clients can favourite, comment and download — all from a link.',
        points: ['Masonry layouts & cover styling', 'Favourites, notes & activity dashboard', 'Password / email-gated privacy', 'Controlled downloads with limits & PIN'],
        shot: 'Client gallery view',
        src: '/images/marketing/feature-gallery.jpg',
    },
    {
        eyebrow: 'Lightroom plugin',
        title: 'Upload from Lightroom — not your browser',
        body: 'Our Lightroom Classic plugin publishes straight from your catalogue. Create a Collection with multiple Sets, drag in your selects, hit Publish, and originals stream directly to secure storage.',
        points: ['Native Publish Service for Lightroom Classic', 'Collections & sets mirrored to the cloud', 'Re-publish edits, remove deletes', 'Direct-to-storage uploads — no middle-man'],
        shot: 'Lightroom publish panel',
        src: '/images/marketing/feature-lightroom.jpg',
        reverse: true,
    },
    {
        eyebrow: 'Store',
        title: 'Sell prints and downloads in a click',
        body: 'Turn galleries into income. Price sheets, products, coupons and gift cards, an in-gallery cart, secure checkout, and hands-off lab fulfilment — with the lowest commission in the business.',
        points: ['In-gallery cart & secure checkout', 'Automatic pro-lab fulfilment', 'Coupons, gift cards & tax handling', '0% commission on paid plans'],
        shot: 'Store & checkout',
        src: '/images/marketing/feature-store.jpg',
    },
    {
        eyebrow: 'Studio manager',
        title: 'Run the whole business from one place',
        body: 'Stop stitching together five tools. Contacts, an Airtable-style projects board, invoices, contracts with e-signature, and call scheduling — all connected, all in your studio.',
        points: ['Contacts & visual projects board', 'Invoices with online payment', 'Contracts & legally-binding e-signatures', 'Meeting scheduling with calendar sync'],
        shot: 'Studio manager / CRM',
        src: '/images/marketing/feature-crm.jpg',
        reverse: true,
    },
    {
        eyebrow: 'Automations',
        title: 'Let the busywork run itself',
        body: 'Build workflows that fire on the events that matter — a booking, a paid invoice, a signed contract. Send questionnaires, proposals and reminders automatically, so nothing slips.',
        points: ['Trigger-based workflow engine', 'Questionnaires & proposals', 'Task lists & templates', 'Scheduled, delayed steps'],
        shot: 'Workflow automation builder',
        src: '/images/marketing/feature-workflows.jpg',
    },
];

const DIFFERENTIATORS = [
    { icon: SparkIcon, title: 'Truly all-in-one', body: 'Galleries, store, CRM, website and automations under one login — not bolted-on add-ons.' },
    { icon: ShieldIcon, title: '0% commission', body: 'Keep every penny of your sales on paid plans. Your work, your money.' },
    { icon: UploadIcon, title: 'Lightroom-native', body: 'The only workflow that starts where you already edit — publish without leaving Lightroom.' },
    { icon: HeartIcon, title: 'Built for photographers', body: 'Designed around how a real studio actually works, from first enquiry to final print.' },
];

/* ───────────────────────────────  Page  ─────────────────────────────── */

export default function Welcome({ auth }: PageProps) {
    const ctaHref = auth.user ? route('dashboard') : route('register');
    const ctaLabel = auth.user ? 'Go to dashboard' : 'Start free';

    return (
        <>
            <Head title={`${BRAND} — the all-in-one platform for photographers`} />

            <div className="min-h-screen bg-white text-neutral-900 antialiased">
                {/* Nav */}
                <header className="sticky top-0 z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                        <img src="/images/logo/focalry-logo.png" alt={BRAND} className="h-10 w-auto" />
                        <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-600 md:flex">
                            <a href="#features" className="transition hover:text-neutral-900">Features</a>
                            <a href="#why" className="transition hover:text-neutral-900">Why {BRAND}</a>
                            <a href="#pricing" className="transition hover:text-neutral-900">Pricing</a>
                        </nav>
                        <div className="flex items-center gap-2">
                            {auth.user ? (
                                <Link href={route('dashboard')} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link href={route('login')} className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:text-neutral-900 sm:block">
                                        Log in
                                    </Link>
                                    <Link href={route('register')} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                                        Get started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Hero */}
                <section className="relative overflow-hidden">
                    {/* gradient blobs */}
                    <div className="pointer-events-none absolute inset-0 -z-10">
                        <div className="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-200/60 via-brand-100/40 to-accent-200/50 blur-3xl" />
                    </div>

                    <div className="mx-auto max-w-7xl px-6 pb-12 pt-20 text-center sm:pt-28">
                        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-neutral-600 shadow-sm">
                            <SparkIcon className="h-4 w-4 text-accent-600" />
                            Galleries · Store · CRM · Website — in one platform
                        </div>
                        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
                            Everything your photography studio needs,{' '}
                            <span className="bg-gradient-to-r from-brand via-brand-500 to-accent-600 bg-clip-text text-transparent">
                                beautifully in one place
                            </span>
                        </h1>
                        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
                            Deliver stunning galleries, sell prints with zero commission, manage clients and contracts, and publish straight from Lightroom — without juggling six different tools.
                        </p>
                        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:opacity-95">
                                {ctaLabel}
                                <ArrowIcon className="h-4 w-4" />
                            </Link>
                            <a href="#features" className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-7 py-3.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
                                See the features
                            </a>
                        </div>
                        <p className="mt-4 text-xs text-neutral-500">Free plan available · No credit card required</p>

                        {/* Hero screenshot */}
                        <div className="mx-auto mt-16 max-w-5xl">
                            <BrowserFrame>
                                <Screenshot label="Dashboard / hero screenshot" ratio="aspect-[16/9]" src="/images/marketing/hero-dashboard.jpg" />
                            </BrowserFrame>
                        </div>
                    </div>
                </section>

                {/* Pillars grid */}
                <section id="features" className="mx-auto max-w-7xl px-6 py-20">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One platform, the whole workflow</h2>
                        <p className="mt-4 text-neutral-600">From the first enquiry to the final print — every step lives here.</p>
                    </div>
                    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {PILLARS.map(({ icon: Ic, title, body }) => (
                            <div key={title} className="group rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
                                    <Ic className="h-6 w-6" />
                                </span>
                                <h3 className="text-base font-semibold">{title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Alternating feature sections */}
                <div className="space-y-24 bg-neutral-50/60 py-24">
                    {FEATURES.map((f) => (
                        <section key={f.title} className="mx-auto max-w-7xl px-6">
                            <div className={`grid items-center gap-12 lg:grid-cols-2 ${f.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-600">{f.eyebrow}</span>
                                    <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{f.title}</h3>
                                    <p className="mt-4 text-neutral-600">{f.body}</p>
                                    <ul className="mt-6 space-y-3">
                                        {f.points.map((p) => (
                                            <li key={p} className="flex items-start gap-3 text-sm text-neutral-700">
                                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                                    <CheckIcon className="h-3.5 w-3.5" />
                                                </span>
                                                {p}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <BrowserFrame>
                                    <Screenshot label={f.shot} src={f.src} />
                                </BrowserFrame>
                            </div>
                        </section>
                    ))}
                </div>

                {/* Differentiators */}
                <section id="why" className="mx-auto max-w-7xl px-6 py-24">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What sets {BRAND} apart</h2>
                        <p className="mt-4 text-neutral-600">Most tools do one thing. We do the whole job — and keep more money in your pocket.</p>
                    </div>
                    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {DIFFERENTIATORS.map(({ icon: Ic, title, body }) => (
                            <div key={title} className="rounded-2xl border border-neutral-100 bg-white p-6 text-center shadow-sm">
                                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                                    <Ic className="h-6 w-6" />
                                </span>
                                <h3 className="text-base font-semibold">{title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Scheduling / meetings callout with screenshot */}
                <section className="mx-auto max-w-7xl px-6 pb-24">
                    <div className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-sm">
                        <div className="grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-2">
                            <div>
                                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
                                    <CalendarIcon className="h-6 w-6" />
                                </span>
                                <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Let clients book you in their sleep</h3>
                                <p className="mt-4 text-neutral-600">
                                    Share a booking link, set your availability, and let clients schedule discovery calls. Video links and calendar invites are created automatically for both of you.
                                </p>
                            </div>
                            <Screenshot label="Booking page" ratio="aspect-[16/10]" src="/images/marketing/feature-booking.jpg" />
                        </div>
                    </div>
                </section>

                {/* Pricing teaser / CTA band */}
                <section id="pricing" className="mx-auto max-w-7xl px-6 pb-24">
                    <div className="relative overflow-hidden rounded-3xl bg-brand-900 px-8 py-16 text-center sm:px-16">
                        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
                            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent-500/30 blur-3xl" />
                            <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-brand-400/40 blur-3xl" />
                        </div>
                        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            Start free. Upgrade when you grow.
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-neutral-300">
                            Simple plans that scale with your studio — with 0% sales commission the moment you go paid.
                        </p>
                        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100">
                                {ctaLabel}
                                <ArrowIcon className="h-4 w-4" />
                            </Link>
                            {!auth.user && (
                                <Link href={route('login')} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                                    Log in
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-neutral-100">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-neutral-500 sm:flex-row">
                        <img src="/images/logo/focalry-logo.png" alt={BRAND} className="h-9 w-auto" />
                        <p>© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
