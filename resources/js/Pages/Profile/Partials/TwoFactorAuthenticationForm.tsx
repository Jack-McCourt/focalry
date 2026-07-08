import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { router, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

export interface TwoFactorState {
    enabled: boolean;
    pending: boolean;
    qrCodeSvg: string | null;
    secretKey: string | null;
    recoveryCodes: string[];
}

export default function TwoFactorAuthenticationForm({
    twoFactor,
    className = '',
}: {
    twoFactor: TwoFactorState;
    className?: string;
}) {
    const confirmForm = useForm({ code: '' });

    const enable = () => router.post(route('two-factor.enable'), {}, { preserveScroll: true });
    const disable = async () => {
        if (await confirmDialog('Disable two-factor authentication? Your account will be less secure.')) {
            router.delete(route('two-factor.disable'), { preserveScroll: true });
        }
    };
    const regenerate = () => router.post(route('two-factor.recovery-codes'), {}, { preserveScroll: true });

    const confirm2fa: FormEventHandler = (e) => {
        e.preventDefault();
        confirmForm.post(route('two-factor.confirm'), {
            preserveScroll: true,
            onSuccess: () => confirmForm.reset('code'),
        });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-neutral-900">Two-Factor Authentication</h2>
                <p className="mt-1 text-sm text-neutral-600">
                    Add an extra layer of security using a TOTP authenticator app (Google Authenticator, 1Password, Authy).
                </p>
            </header>

            {/* Active */}
            {twoFactor.enabled && (
                <div className="mt-6 space-y-4">
                    <p className="inline-flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
                        <span className="h-2 w-2 rounded-full bg-green-500" /> Two-factor authentication is enabled.
                    </p>

                    <div>
                        <p className="text-sm font-medium text-neutral-900">Recovery codes</p>
                        <p className="text-sm text-neutral-600">
                            Store these somewhere safe. Each code can be used once to sign in if you lose your device.
                        </p>
                        <div className="mt-2 grid max-w-md grid-cols-2 gap-1 rounded-md bg-neutral-100 p-3 font-mono text-sm text-neutral-800">
                            {twoFactor.recoveryCodes.map((code) => (
                                <span key={code}>{code}</span>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <SecondaryButton onClick={regenerate}>Regenerate recovery codes</SecondaryButton>
                        <DangerButton onClick={disable}>Disable</DangerButton>
                    </div>
                </div>
            )}

            {/* Setup in progress — scan + confirm */}
            {!twoFactor.enabled && twoFactor.pending && (
                <div className="mt-6 space-y-4">
                    <p className="text-sm text-neutral-600">
                        Scan this QR code with your authenticator app, then enter the generated code to finish enabling.
                    </p>
                    {twoFactor.qrCodeSvg && (
                        <div
                            className="inline-block rounded-md border border-neutral-200 bg-white p-3"
                            dangerouslySetInnerHTML={{ __html: twoFactor.qrCodeSvg }}
                        />
                    )}
                    {twoFactor.secretKey && (
                        <p className="text-sm text-neutral-600">
                            Or enter this key manually:{' '}
                            <span className="font-mono text-neutral-900">{twoFactor.secretKey}</span>
                        </p>
                    )}

                    <form onSubmit={confirm2fa} className="max-w-xs space-y-3">
                        <div>
                            <InputLabel htmlFor="tfa-code" value="Authentication code" />
                            <TextInput
                                id="tfa-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={confirmForm.data.code}
                                className="mt-1.5 block w-full tracking-[0.3em]"
                                placeholder="000000"
                                onChange={(e) => confirmForm.setData('code', e.target.value)}
                            />
                            <InputError message={confirmForm.errors.code} className="mt-2" />
                        </div>
                        <div className="flex items-center gap-3">
                            <PrimaryButton disabled={confirmForm.processing}>Confirm</PrimaryButton>
                            <SecondaryButton type="button" onClick={disable}>
                                Cancel
                            </SecondaryButton>
                        </div>
                    </form>
                </div>
            )}

            {/* Off */}
            {!twoFactor.enabled && !twoFactor.pending && (
                <div className="mt-6">
                    <PrimaryButton onClick={enable}>Enable two-factor authentication</PrimaryButton>
                </div>
            )}
        </section>
    );
}
