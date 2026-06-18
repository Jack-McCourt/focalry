import { Link } from '@inertiajs/react';

type Tab = 'bookings' | 'session-types' | 'availability';

const TABS: { key: Tab; label: string; href: string }[] = [
    { key: 'bookings', label: 'Bookings', href: '/bookings' },
    { key: 'session-types', label: 'Session types', href: '/session-types' },
    { key: 'availability', label: 'Availability', href: '/availability' },
];

export default function BookingsSubNav({ active }: { active: Tab }) {
    return (
        <div className="flex items-center gap-1 px-4 pt-4 sm:px-8">
            {TABS.map((t) => (
                <Link
                    key={t.key}
                    href={t.href}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        t.key === active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                >
                    {t.label}
                </Link>
            ))}
        </div>
    );
}
