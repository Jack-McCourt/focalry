import { Link } from '@inertiajs/react';

type Section = 'orders' | 'products' | 'coupons' | 'gift-cards' | 'settings';

const SECTIONS: { key: Section; label: string; href: string }[] = [
    { key: 'orders', label: 'Orders', href: '/store/orders' },
    { key: 'products', label: 'Products', href: '/store/products' },
    { key: 'coupons', label: 'Coupons', href: '/store/coupons' },
    { key: 'gift-cards', label: 'Gift cards', href: '/store/gift-cards' },
    { key: 'settings', label: 'Settings', href: '/store/settings' },
];

export default function StoreNav({ active }: { active: Section }) {
    return (
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-neutral-200 px-4 sm:px-8">
            {SECTIONS.map((s) => {
                const isActive = s.key === active;
                return (
                    <Link
                        key={s.key}
                        href={s.href}
                        className={`relative -mb-px border-b-2 px-3 py-3 text-sm font-medium transition ${
                            isActive
                                ? 'border-neutral-900 text-neutral-900'
                                : 'border-transparent text-neutral-400 hover:text-neutral-700'
                        }`}
                    >
                        {s.label}
                    </Link>
                );
            })}
        </nav>
    );
}
