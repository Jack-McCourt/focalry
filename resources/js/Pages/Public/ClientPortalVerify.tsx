import PublicShell from '@/Components/PublicShell';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

export default function ClientPortalVerify({
    token,
    masked_email,
    sent,
    studio_name,
    studio_logo,
    studio_logo_size,
}: PageProps<{
    token: string;
    masked_email: string;
    sent: boolean;
    studio_name: string | null;
    studio_logo: string | null;
    studio_logo_size: string | null;
}>) {
    const codeForm = useForm({ code: '' });
    const sendForm = useForm({});

    const requestCode = () => sendForm.post(route('portal.code', token), { preserveScroll: true });
    const submitCode = (e: React.FormEvent) => {
        e.preventDefault();
        codeForm.post(route('portal.verify', token), { preserveScroll: true });
    };

    return (
        <PublicShell brand={{ name: studio_name, logo: studio_logo, size: studio_logo_size }} maxWidth="sm">
            <Head title="Your portal" />

            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
                <svg className="mx-auto h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <h1 className="mt-4 text-xl font-semibold text-neutral-900">Welcome back</h1>
                <p className="mt-2 text-sm text-neutral-500">
                    Enter the code sent to <span className="font-medium text-neutral-700">{masked_email}</span> to open your portal.
                </p>

                {sent && (
                    <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        A new code is on its way to {masked_email}.
                    </p>
                )}

                <form onSubmit={submitCode} className="mt-6 space-y-3 text-left">
                    <div>
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            autoFocus
                            value={codeForm.data.code}
                            onChange={(e) => codeForm.setData('code', e.target.value)}
                            placeholder="Enter 6-digit code"
                            className="input w-full text-center text-lg tracking-[0.3em]"
                        />
                        {codeForm.errors.code && <p className="mt-1 text-center text-xs text-red-600">{codeForm.errors.code}</p>}
                    </div>
                    <button type="submit" disabled={codeForm.processing} className="btn-primary w-full">
                        {codeForm.processing ? 'Verifying…' : 'Open portal'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={requestCode}
                    disabled={sendForm.processing}
                    className="mt-4 block w-full text-center text-xs text-neutral-500 underline hover:text-neutral-800"
                >
                    {sendForm.processing ? 'Sending…' : "Didn't get a code? Send another"}
                </button>
            </div>
        </PublicShell>
    );
}
