import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="Email Verification" />

            <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Verify your email</h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                    Thanks for signing up! Click the link we just emailed you to get started. Didn't get it? We'll happily send another.
                </p>
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    A new verification link has been sent to your email address.
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <PrimaryButton className="w-full" disabled={processing}>
                    {processing ? 'Sending…' : 'Resend verification email'}
                </PrimaryButton>

                <Link
                    href={route('logout')}
                    method="post"
                    as="button"
                    className="block w-full text-center text-sm font-medium text-neutral-500 hover:text-neutral-900"
                >
                    Log out
                </Link>
            </form>
        </GuestLayout>
    );
}
