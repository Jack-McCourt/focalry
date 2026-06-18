import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function Create(_: PageProps) {
    const { data, setData, post, processing, errors } = useForm({
        title: '',
        event_date: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('collections.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2 text-sm">
                    <Link
                        href={route('collections.index')}
                        className="text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                        Galleries
                    </Link>
                    <svg className="h-4 w-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-neutral-900">New gallery</span>
                </div>
            }
        >
            <Head title="New Gallery" />

            <div className="flex min-h-[calc(100vh-3.5rem)] items-start justify-center px-4 sm:px-8 pt-16">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <h2 className="text-xl font-light text-neutral-900">
                            Create a new gallery
                        </h2>
                        <p className="mt-1.5 text-sm text-neutral-500">
                            Give your gallery a name and optionally set the event date.
                            You can upload photos right after.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-5">
                        <div>
                            <label htmlFor="title" className="label mb-1.5">
                                Gallery name
                            </label>
                            <input
                                id="title"
                                type="text"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                placeholder="e.g. Smith Wedding — June 2026"
                                className="input"
                                autoFocus
                            />
                            {errors.title && (
                                <p className="mt-1.5 text-xs text-red-500">{errors.title}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="event_date" className="label mb-1.5">
                                Event date{' '}
                                <span className="normal-case font-normal text-neutral-400">
                                    — optional
                                </span>
                            </label>
                            <input
                                id="event_date"
                                type="date"
                                value={data.event_date}
                                onChange={(e) => setData('event_date', e.target.value)}
                                className="input"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Link
                                href={route('collections.index')}
                                className="btn-ghost"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={processing || !data.title.trim()}
                                className="btn-primary"
                            >
                                {processing ? 'Creating…' : 'Create gallery'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
