import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

const modules = [
    {
        name: 'Galleries',
        description: 'Deliver, share, and proof photos with clients.',
        href: '/collections',
        available: true,
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
        ),
    },
    {
        name: 'Store',
        description: 'Sell prints, albums, and digital downloads.',
        href: '#',
        available: false,
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
        ),
    },
    {
        name: 'Studio Manager',
        description: 'Meetings, invoices, contracts, and CRM.',
        href: '#',
        available: false,
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
        ),
    },
    {
        name: 'Website',
        description: 'Drag-and-drop photography website builder.',
        href: '#',
        available: false,
        icon: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
        ),
    },
];

export default function Dashboard(_: PageProps) {
    const { auth } = usePage<PageProps>().props;

    return (
        <AuthenticatedLayout
            header={
                <h1 className="text-sm font-semibold text-neutral-900">
                    Dashboard
                </h1>
            }
        >
            <Head title="Dashboard" />

            <div className="px-4 sm:px-8 py-10">
                {/* Welcome */}
                <div className="mb-10">
                    <h2 className="text-2xl font-light text-neutral-900">
                        Welcome back, {auth.user?.name?.split(' ')[0]}.
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        Here's everything you need to run your photography business.
                    </p>
                </div>

                {/* Module grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {modules.map((mod) =>
                        mod.available ? (
                            <Link
                                key={mod.name}
                                href={mod.href}
                                className="group card p-6 transition hover:shadow-md"
                            >
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition group-hover:bg-neutral-900 group-hover:text-white">
                                    {mod.icon}
                                </div>
                                <h3 className="font-semibold text-neutral-900">
                                    {mod.name}
                                </h3>
                                <p className="mt-1 text-sm text-neutral-500">
                                    {mod.description}
                                </p>
                                <div className="mt-4 flex items-center text-sm font-medium text-neutral-900">
                                    Open
                                    <svg className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        ) : (
                            <div
                                key={mod.name}
                                className="card p-6 opacity-60"
                            >
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                                    {mod.icon}
                                </div>
                                <h3 className="font-semibold text-neutral-900">
                                    {mod.name}
                                </h3>
                                <p className="mt-1 text-sm text-neutral-500">
                                    {mod.description}
                                </p>
                                <div className="mt-4">
                                    <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
                                        Coming soon
                                    </span>
                                </div>
                            </div>
                        ),
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
