import { Link } from '@inertiajs/react';

type Section = 'contacts' | 'projects' | 'invoices' | 'contracts' | 'bookings';

const SECTIONS: { key: Section; label: string; href: string | null }[] = [
    { key: 'contacts', label: 'Contacts', href: '/contacts' },
    { key: 'projects', label: 'Projects', href: '/projects' },
    { key: 'invoices', label: 'Invoices', href: '/invoices' },
    { key: 'contracts', label: 'Contracts', href: '/contracts' },
    { key: 'bookings', label: 'Bookings', href: '/bookings' },
];

export default function StudioManagerNav({ active }: { active: Section }) {
    return (
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-neutral-200 px-4 sm:px-8">
            {SECTIONS.map((s) => {
                const isActive = s.key === active;
                const classes = `relative -mb-px border-b-2 px-3 py-3 text-sm font-medium transition ${
                    isActive
                        ? 'border-neutral-900 text-neutral-900'
                        : 'border-transparent text-neutral-400'
                } ${s.href && !isActive ? 'hover:text-neutral-700' : ''} ${
                    !s.href ? 'cursor-default' : ''
                }`;

                if (!s.href) {
                    return (
                        <span key={s.key} className={classes}>
                            {s.label}
                            <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                                Soon
                            </span>
                        </span>
                    );
                }

                return (
                    <Link key={s.key} href={s.href} className={classes}>
                        {s.label}
                    </Link>
                );
            })}
        </nav>
    );
}
