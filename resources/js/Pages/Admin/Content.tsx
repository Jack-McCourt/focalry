import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';

interface CollectionRow {
    id: number;
    title: string;
    slug: string;
    photos_count: number;
    studio: { id: number; name: string } | null;
    published_at: string | null;
}

interface SiteRow {
    id: number;
    name: string;
    slug: string;
    studio: { id: number; name: string } | null;
    published_at: string | null;
}

interface Props {
    collections: CollectionRow[];
    sites: SiteRow[];
}

function fmtDate(d: string | null) {
    return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function AdminContent({ collections, sites }: Props) {
    const takedownCollection = (c: CollectionRow) => {
        if (confirm(`Take down “${c.title}”? It will be set back to draft and the public link will stop working.`)) {
            router.post(route('admin.content.collections.takedown', c.id), {}, { preserveScroll: true });
        }
    };

    const takedownSite = (s: SiteRow) => {
        if (confirm(`Unpublish “${s.name}”? The public website will go offline.`)) {
            router.post(route('admin.content.sites.takedown', s.id), {}, { preserveScroll: true });
        }
    };

    return (
        <AdminLayout header={<h1 className="text-sm font-semibold text-neutral-900">Content moderation</h1>}>
            <Head title="Admin · Content" />

            <div className="mx-auto max-w-6xl space-y-8 px-6 py-6">
                {/* Galleries */}
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-neutral-900">
                        Published galleries <span className="text-neutral-400">({collections.length})</span>
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                    <th className="px-4 py-3 font-medium">Gallery</th>
                                    <th className="px-4 py-3 font-medium">Studio</th>
                                    <th className="px-4 py-3 font-medium">Photos</th>
                                    <th className="px-4 py-3 font-medium">Published</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {collections.map((c) => (
                                    <tr key={c.id} className="hover:bg-neutral-50">
                                        <td className="px-4 py-3 font-medium text-neutral-900">{c.title}</td>
                                        <td className="px-4 py-3 text-neutral-600">
                                            {c.studio ? (
                                                <Link
                                                    href={route('admin.studios.show', c.studio.id)}
                                                    className="hover:text-rose-600 hover:underline"
                                                >
                                                    {c.studio.name}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-500">{c.photos_count}</td>
                                        <td className="px-4 py-3 text-xs text-neutral-400">{fmtDate(c.published_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => takedownCollection(c)}
                                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                            >
                                                Take down
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {collections.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-400">
                                            No published galleries.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Websites */}
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-neutral-900">
                        Published websites <span className="text-neutral-400">({sites.length})</span>
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                                    <th className="px-4 py-3 font-medium">Website</th>
                                    <th className="px-4 py-3 font-medium">Studio</th>
                                    <th className="px-4 py-3 font-medium">Published</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {sites.map((s) => (
                                    <tr key={s.id} className="hover:bg-neutral-50">
                                        <td className="px-4 py-3 font-medium text-neutral-900">{s.name}</td>
                                        <td className="px-4 py-3 text-neutral-600">
                                            {s.studio ? (
                                                <Link
                                                    href={route('admin.studios.show', s.studio.id)}
                                                    className="hover:text-rose-600 hover:underline"
                                                >
                                                    {s.studio.name}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-neutral-400">{fmtDate(s.published_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => takedownSite(s)}
                                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                            >
                                                Unpublish
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {sites.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-400">
                                            No published websites.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AdminLayout>
    );
}
