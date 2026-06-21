import AdminLayout from '@/Layouts/AdminLayout';
import { Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface UserRow {
    id: number;
    name: string;
    email: string;
    role: string;
    is_super_admin: boolean;
    studio: { id: number; name: string } | null;
    created_at: string;
}

interface Props {
    users: Paginated<UserRow>;
    filters: { search: string };
}

export default function UsersIndex({ users, filters }: Props) {
    const [search, setSearch] = useState(filters.search);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('admin.users.index'), search ? { search } : {}, { preserveState: true, replace: true });
    };

    const impersonate = (id: number) => router.post(route('admin.users.impersonate', id));

    return (
        <AdminLayout header={<h1 className="text-sm font-semibold text-neutral-900">Users</h1>}>
            <Head title="Admin · Users" />

            <div className="mx-auto max-w-6xl px-6 py-6">
                <form onSubmit={submit} className="mb-4 flex gap-2">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-rose-500"
                    />
                    <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
                        Search
                    </button>
                </form>

                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                <th className="px-4 py-3 font-medium">User</th>
                                <th className="px-4 py-3 font-medium">Studio</th>
                                <th className="px-4 py-3 font-medium">Role</th>
                                <th className="px-4 py-3 font-medium" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {users.data.map((u) => (
                                <tr key={u.id} className="hover:bg-neutral-50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-neutral-900">
                                            {u.name}
                                            {u.is_super_admin && (
                                                <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                                                    Admin
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-neutral-400">{u.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600">
                                        {u.studio ? (
                                            <Link
                                                href={route('admin.studios.show', u.studio.id)}
                                                className="hover:text-rose-600 hover:underline"
                                            >
                                                {u.studio.name}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 capitalize text-neutral-500">{u.role}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => impersonate(u.id)}
                                            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                        >
                                            Log in as
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.data.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-neutral-400">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {(users.prev_page_url || users.next_page_url) && (
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">
                            Page {users.current_page} of {users.last_page} · {users.total} total
                        </span>
                        <div className="flex gap-2">
                            <Link
                                href={users.prev_page_url ?? '#'}
                                preserveState
                                className={`rounded-lg border px-3 py-1.5 ${users.prev_page_url ? 'border-neutral-300 hover:bg-neutral-50' : 'pointer-events-none border-neutral-100 text-neutral-300'}`}
                            >
                                Previous
                            </Link>
                            <Link
                                href={users.next_page_url ?? '#'}
                                preserveState
                                className={`rounded-lg border px-3 py-1.5 ${users.next_page_url ? 'border-neutral-300 hover:bg-neutral-50' : 'pointer-events-none border-neutral-100 text-neutral-300'}`}
                            >
                                Next
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
