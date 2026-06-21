import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode } from 'react';

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
        >
            {label}
        </Link>
    );
}

export default function AdminLayout({ header, children }: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth } = usePage<PageProps>().props;
    const current = (name: string) => route().current(name);

    return (
        <div className="flex min-h-screen bg-neutral-50">
            {/* Sidebar */}
            <aside className="flex w-56 shrink-0 flex-col" style={{ background: '#0b0b0c' }}>
                <div className="flex h-14 items-center gap-2 px-4">
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Admin
                    </span>
                    <span className="text-sm font-semibold text-white">Platform</span>
                </div>
                <nav className="flex-1 space-y-1 px-2 py-3">
                    <NavLink href={route('admin.dashboard')} label="Dashboard" active={current('admin.dashboard')} />
                    <NavLink href={route('admin.studios.index')} label="Studios" active={current('admin.studios.*')} />
                    <NavLink href={route('admin.users.index')} label="Users" active={current('admin.users.*')} />
                    <NavLink href={route('admin.orders.index')} label="Orders" active={current('admin.orders.*')} />
                    <NavLink href={route('admin.content.index')} label="Content" active={current('admin.content.*')} />
                    <NavLink href={route('admin.audit.index')} label="Audit log" active={current('admin.audit.*')} />
                </nav>
                <div className="border-t border-white/10 px-2 py-3">
                    <Link
                        href={route('dashboard')}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
                    >
                        ← Back to app
                    </Link>
                    <div className="mt-2 px-3 py-1 text-[11px] text-zinc-500">{auth.user?.email}</div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 items-center border-b border-neutral-200 bg-white px-6">
                    {header ?? <h1 className="text-sm font-semibold text-neutral-900">Super Admin</h1>}
                </header>
                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
        </div>
    );
}
