import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SkeletonImage from '@/Components/SkeletonImage';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface FavPhoto {
    id: number;
    collection_id: number;
    thumb_url: string | null;
}

interface Group {
    collection: { id: number; title: string };
    count: number;
    photos: FavPhoto[];
}

export default function FavouritesIndex({ groups, total }: PageProps<{ groups: Group[]; total: number }>) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between">
                    <h1 className="text-sm font-semibold text-neutral-900">
                        Favourites
                        {total > 0 && <span className="ml-2 font-normal text-neutral-400">{total}</span>}
                    </h1>
                    {total > 0 && (
                        <a href={route('favourites.download-all')} className="btn-primary">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download all
                        </a>
                    )}
                </div>
            }
        >
            <Head title="Favourites" />

            <div className="mx-auto max-w-6xl p-6 lg:p-8">
                {total === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 py-24 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
                            <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.562.562 0 011.04 0l2.125 5.11a.563.563 0 00.475.346l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.884a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                        </div>
                        <p className="text-base font-medium text-neutral-900">No favourites yet</p>
                        <p className="mt-1 max-w-sm text-sm text-neutral-500">
                            Open any gallery and tap the star on the photos you love — they'll gather here, ready to download.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {groups.map((g) => (
                            <section key={g.collection.id}>
                                <div className="mb-3 flex items-center justify-between">
                                    <Link
                                        href={route('collections.show', g.collection.id)}
                                        className="group inline-flex items-baseline gap-2"
                                    >
                                        <h2 className="text-sm font-semibold text-neutral-900 group-hover:text-neutral-600">{g.collection.title}</h2>
                                        <span className="text-xs text-neutral-400">{g.count}</span>
                                    </Link>
                                    <a
                                        href={route('favourites.download', g.collection.id)}
                                        className="btn-secondary text-xs"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                        </svg>
                                        Download
                                    </a>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                                    {g.photos.map((p) => (
                                        <div key={p.id} className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
                                            {p.thumb_url && (
                                                <SkeletonImage src={p.thumb_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
