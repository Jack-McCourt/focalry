import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface PublicCollection {
    id: number;
    title: string;
    slug: string;
}

export default function GalleryPassword({
    collection,
    error,
}: PageProps<{ collection: PublicCollection; error: string | null }>) {
    const { data, setData, post, processing } = useForm({ password: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('gallery.show', collection.slug));
    };

    return (
        <>
            <Head title={collection.title} />
            <div
                className="flex min-h-screen items-center justify-center px-6"
                style={{ background: '#0e0e0e' }}
            >
                <div className="w-full max-w-xs text-center">
                    <div className="mb-8">
                        <p className="mb-3 text-xs uppercase tracking-widest" style={{ color: '#555' }}>
                            Private gallery
                        </p>
                        <h1 className="text-xl font-light tracking-widest uppercase text-white"
                            style={{ letterSpacing: '0.15em' }}>
                            {collection.title}
                        </h1>
                    </div>

                    <form onSubmit={submit} className="space-y-3">
                        <input
                            type="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Enter password"
                            autoFocus
                            className="w-full rounded-none border-0 border-b bg-transparent py-3 text-center text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none focus:ring-0 transition-colors"
                            style={{ borderColor: '#333' }}
                        />
                        {error && (
                            <p className="text-xs text-red-400">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={processing}
                            className="mt-4 w-full rounded-none bg-white py-3 text-xs font-medium uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-50"
                        >
                            {processing ? 'Verifying…' : 'View gallery'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
