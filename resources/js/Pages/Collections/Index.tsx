import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Collection, PageProps, Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

function StatusBadge({ status }: { status: Collection['status'] }) {
    return status === 'published' ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Published
        </span>
    ) : (
        <span className="text-xs text-neutral-400">Draft</span>
    );
}

function CollectionCard({ collection }: { collection: Collection }) {
    return (
        <Link
            href={route('collections.show', collection.id)}
            className="group block"
        >
            {/* Cover image / placeholder */}
            <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
                {collection.cover_url ? (
                    <img
                        src={collection.cover_url}
                        alt={collection.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-300">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span className="text-xs">No cover</span>
                    </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-neutral-900/0 transition group-hover:bg-neutral-900/10" />
            </div>

            {/* Info */}
            <div>
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-neutral-900 group-hover:text-neutral-600 transition-colors line-clamp-1">
                        {collection.title}
                    </h3>
                    <StatusBadge status={collection.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                    {collection.event_date && (
                        <>
                            <span>
                                {new Date(collection.event_date).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                            <span>·</span>
                        </>
                    )}
                    <span>{collection.photos_count ?? 0} photos</span>
                </div>
            </div>
        </Link>
    );
}

export default function Index({
    collections,
}: PageProps<{ collections: Paginated<Collection> }>) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">Galleries</h1>
                    <div className="flex items-center gap-2">
                        <a href={route('lightroom.plugin.download')} className="btn-secondary" title="Upload galleries straight from Lightroom Classic">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Lightroom plugin
                        </a>
                        <Link href={route('collections.create')} className="btn-primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            New gallery
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title="Galleries" />

            <div className="px-4 sm:px-8 py-10">
                {collections.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-32">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100">
                            <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                        </div>
                        <p className="mt-4 text-base font-medium text-neutral-900">
                            No galleries yet
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                            Create your first gallery to start delivering photos.
                        </p>
                        <Link href={route('collections.create')} className="btn-primary mt-6">
                            Create gallery
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {collections.data.map((c) => (
                                <CollectionCard key={c.id} collection={c} />
                            ))}
                        </div>

                        {collections.last_page > 1 && (
                            <div className="mt-10 flex items-center justify-center gap-2">
                                {collections.prev_page_url && (
                                    <button
                                        onClick={() => router.get(collections.prev_page_url!)}
                                        className="btn-secondary px-3 py-1.5 text-xs"
                                    >
                                        Previous
                                    </button>
                                )}
                                <span className="text-xs text-neutral-500">
                                    Page {collections.current_page} of {collections.last_page}
                                </span>
                                {collections.next_page_url && (
                                    <button
                                        onClick={() => router.get(collections.next_page_url!)}
                                        className="btn-secondary px-3 py-1.5 text-xs"
                                    >
                                        Next
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
