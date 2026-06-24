import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Forgot Password" />

            <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Reset your password</h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                    Enter your email and we'll send you a link to choose a new one.
                </p>
            </div>

            {status && (
                <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <div>
                    <InputLabel htmlFor="email" value="Email" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1.5 block w-full"
                        isFocused={true}
                        placeholder="you@studio.com"
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <PrimaryButton className="w-full" disabled={processing}>
                    {processing ? 'Sending…' : 'Email password reset link'}
                </PrimaryButton>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-500">
                <Link href={route('login')} className="font-semibold text-neutral-900 hover:underline">
                    Back to log in
                </Link>
            </p>
        </GuestLayout>
    );
}
