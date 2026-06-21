import { Auth, Flash } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useEffect, useRef, useState } from 'react';

interface NotificationItem {
    id: string;
    conversation_id: number | null;
    from_name: string | null;
    subject: string | null;
    preview: string | null;
    read: boolean;
    created_at: string | null;
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

function IconDashboard({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
    );
}

function IconGalleries({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
    );
}

function IconStore({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
    );
}

function IconStudio({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
    );
}

function IconWebsite({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
    );
}

function IconMessages({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
    );
}

function IconSettings({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function IconLogout({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
    );
}

// ─── Sidebar link ─────────────────────────────────────────────────────────────

function IconLock({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25H6.75a2.25 2.25 0 01-2.25-2.25v-6a2.25 2.25 0 012.25-2.25z" />
        </svg>
    );
}

function IconShield({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
    );
}

function IconBilling({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
    );
}

function SidebarLink({
    href,
    icon: Icon,
    label,
    active,
    soon,
    badge,
    locked,
}: {
    href: string;
    icon: React.FC<{ className?: string }>;
    label: string;
    active: boolean;
    soon?: boolean;
    badge?: number;
    locked?: boolean;
}) {
    // Locked items aren't disabled — they route to billing so the user can upgrade.
    return (
        <Link
            href={soon ? '#' : locked ? route('billing.index') : href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                active
                    ? 'bg-sidebar-active text-sidebar-text-active'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
            } ${soon ? 'pointer-events-none' : ''} ${locked ? 'opacity-60' : ''}`}
            title={locked ? `Upgrade your plan to unlock ${label}` : undefined}
        >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 font-medium">{label}</span>
            {locked && <IconLock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
            {soon && (
                <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Soon
                </span>
            )}
            {!soon && !locked && !!badge && badge > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
}

// ─── Notification bell ──────────────────────────────────────────────────────

function IconBell({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
    );
}

function NotificationBell() {
    const { notifications = [], unread_notifications = 0 } = usePage<{
        auth: Auth;
        flash: Flash;
        notifications: NotificationItem[];
        unread_notifications: number;
    }>().props;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const openNotification = (n: NotificationItem) => {
        setOpen(false);
        router.post(
            route('notifications.read', n.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => {
                    if (n.conversation_id) router.visit(route('messages.show', n.conversation_id));
                },
            },
        );
    };

    const markAll = () =>
        router.post(route('notifications.read-all'), {}, { preserveScroll: true, preserveState: true });

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Notifications"
            >
                <IconBell className="h-5 w-5" />
                {unread_notifications > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                        {unread_notifications > 9 ? '9+' : unread_notifications}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                        <span className="text-sm font-semibold text-neutral-900">Notifications</span>
                        {unread_notifications > 0 && (
                            <button onClick={markAll} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-neutral-400">You're all caught up.</p>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => openNotification(n)}
                                    className={`block w-full border-b border-neutral-50 px-4 py-3 text-left transition hover:bg-neutral-50 ${n.read ? '' : 'bg-blue-50/50'}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-neutral-900">
                                                New reply from {n.from_name ?? 'a client'}
                                            </p>
                                            {n.subject && <p className="truncate text-xs text-neutral-500">{n.subject}</p>}
                                            {n.preview && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{n.preview}</p>}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Flash banner ─────────────────────────────────────────────────────────────

function FlashBanner() {
    const { flash } = usePage<{ auth: Auth; flash: Flash }>().props;
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || (!flash.success && !flash.error)) return null;

    return (
        <div
            className={`flex items-center justify-between px-6 py-3 text-sm ${
                flash.error
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-emerald-700'
            }`}
        >
            <span>{flash.success ?? flash.error}</span>
            <button
                onClick={() => setDismissed(true)}
                className="ml-4 shrink-0 opacity-60 hover:opacity-100"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, unread_messages, impersonation } = usePage<{
        auth: Auth;
        flash: Flash;
        unread_messages: number;
        impersonation: { user_name: string; studio_name: string | null } | null;
    }>().props;
    const user = auth.user!;
    const studio = auth.studio;
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // A nav item is "locked" when its product area isn't part of the studio's plan.
    const features = studio?.features ?? [];
    const has = (feature?: string) => !feature || features.includes(feature as never);

    const navItems = [
        {
            label: 'Dashboard',
            href: route('dashboard'),
            icon: IconDashboard,
            active: route().current('dashboard'),
            soon: false,
        },
        {
            label: 'Galleries',
            href: route('collections.index'),
            icon: IconGalleries,
            active: route().current('collections.*'),
            soon: false,
            feature: 'galleries',
        },
        {
            label: 'Store',
            href: route('store.orders.index'),
            icon: IconStore,
            active: route().current('store.*'),
            soon: false,
            feature: 'store',
        },
        {
            label: 'Studio Manager',
            href: route('contacts.index'),
            icon: IconStudio,
            active: route().current('contacts.*'),
            soon: false,
            feature: 'studio_manager',
        },
        {
            label: 'Messages',
            href: route('messages.index'),
            icon: IconMessages,
            active: route().current('messages.*'),
            soon: false,
            badge: unread_messages,
        },
        {
            label: 'Website',
            href: route('website.edit'),
            icon: IconWebsite,
            active: route().current('website.*'),
            soon: false,
            feature: 'website',
        },
    ].map((item) => ({ ...item, locked: !has((item as { feature?: string }).feature) }));

    const initials = user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="flex h-screen overflow-hidden bg-neutral-50">
            {/* ── Mobile backdrop ── */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                style={{ background: '#141414' }}
            >
                {/* Logo */}
                <div className="flex h-14 items-center justify-between px-4">
                    <Link href={route('dashboard')} className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white">
                            <svg className="h-4 w-4 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold tracking-wide text-white">
                            {studio?.name ?? 'Studio'}
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(false)}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-sidebar-hover hover:text-white lg:hidden"
                        aria-label="Close menu"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                    <div className="space-y-0.5">
                        {navItems.map((item) => (
                            <SidebarLink key={item.label} {...item} />
                        ))}
                    </div>
                </nav>

                {/* Bottom */}
                <div className="border-t border-sidebar-border px-2 py-3 space-y-0.5">
                    {user.is_super_admin && (
                        <Link
                            href={route('admin.dashboard')}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-sidebar-hover hover:text-rose-200"
                        >
                            <IconShield className="h-[18px] w-[18px] shrink-0" />
                            <span className="flex-1">Super Admin</span>
                        </Link>
                    )}
                    <SidebarLink
                        href={route('billing.index')}
                        icon={IconBilling}
                        label="Plans & Billing"
                        active={route().current('billing.*')}
                    />
                    <SidebarLink
                        href={route('profile.edit')}
                        icon={IconSettings}
                        label="Settings"
                        active={route().current('profile.*')}
                    />

                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-text transition hover:bg-sidebar-hover hover:text-white"
                    >
                        <IconLogout className="h-[18px] w-[18px] shrink-0" />
                        <span className="font-medium">Log out</span>
                    </Link>

                    <div className="mt-2 flex items-center gap-2.5 px-3 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-white">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-white">
                                {user.name}
                            </p>
                            <p className="truncate text-[11px] capitalize text-zinc-500">
                                {studio?.plan ?? 'free'} plan
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Impersonation banner — shown while a super admin is viewing as a user. */}
                {impersonation && (
                    <div className="flex shrink-0 items-center justify-center gap-3 bg-rose-600 px-4 py-2 text-center text-sm text-white">
                        <span>
                            Viewing as <strong>{impersonation.user_name}</strong>
                            {impersonation.studio_name ? ` · ${impersonation.studio_name}` : ''}
                        </span>
                        <Link
                            href={route('impersonate.stop')}
                            method="post"
                            as="button"
                            className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
                        >
                            Stop impersonating
                        </Link>
                    </div>
                )}

                {/* Top bar — always present: holds the mobile menu button, the page
                    header (when provided), and the global notification bell. */}
                <div className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="-ml-1 rounded-md p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
                        aria-label="Open menu"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                        </svg>
                    </button>
                    <div className="min-w-0 flex-1">{header}</div>
                    <NotificationBell />
                </div>

                {/* Flash */}
                <FlashBanner />

                {/* Content */}
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
