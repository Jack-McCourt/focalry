import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

export default function TwoFactorChallenge() {
    const [useRecovery, setUseRecovery] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
        recovery_code: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('two-factor.login'), { onFinish: () => reset('code', 'recovery_code') });
    };

    const toggle = () => {
        setUseRecovery((v) => !v);
        reset('code', 'recovery_code');
    };

    return (
        <GuestLayout>
            <Head title="Two-Factor Confirmation" />

            <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Two-factor authentication</h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                    {useRecovery
                        ? 'Enter one of your emergency recovery codes to continue.'
                        : 'Enter the 6-digit code from your authenticator app to continue.'}
                </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
                {useRecovery ? (
                    <div>
                        <InputLabel htmlFor="recovery_code" value="Recovery code" />
                        <TextInput
                            id="recovery_code"
                            type="text"
                            name="recovery_code"
                            value={data.recovery_code}
                            className="mt-1.5 block w-full"
                            autoComplete="one-time-code"
                            isFocused
                            placeholder="XXXXX-XXXXX"
                            onChange={(e) => setData('recovery_code', e.target.value)}
                        />
                        <InputError message={errors.recovery_code} className="mt-2" />
                    </div>
                ) : (
                    <div>
                        <InputLabel htmlFor="code" value="Authentication code" />
                        <TextInput
                            id="code"
                            type="text"
                            name="code"
                            value={data.code}
                            className="mt-1.5 block w-full tracking-[0.4em]"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            isFocused
                            placeholder="000000"
                            onChange={(e) => setData('code', e.target.value)}
                        />
                        <InputError message={errors.code} className="mt-2" />
                    </div>
                )}

                <PrimaryButton className="w-full" disabled={processing}>
                    {processing ? 'Verifying…' : 'Verify'}
                </PrimaryButton>

                <button
                    type="button"
                    onClick={toggle}
                    className="block w-full text-center text-sm text-neutral-500 underline hover:text-neutral-800"
                >
                    {useRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
                </button>
            </form>
        </GuestLayout>
    );
}
