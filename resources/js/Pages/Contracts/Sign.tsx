import SignaturePad, { SignatureValue } from '@/Components/SignaturePad';
import { ContractFieldType, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface ClientField {
    key: string;
    label: string;
    type: ContractFieldType;
    value: string | boolean | null;
}

interface SignatureInfo {
    signer_name: string;
    signature_type: 'typed' | 'drawn';
    signature_data: string | null;
    signed_at: string | null;
}

interface PublicContract {
    public_id: string;
    title: string;
    status: 'draft' | 'sent' | 'signed' | 'declined' | 'void';
    body: string;
    client_fields: ClientField[];
    signed: boolean;
    signed_at: string | null;
}

type SignFormData = SignatureValue & { values: Record<string, string | boolean> };

function SignatureView({ sig, label }: { sig: SignatureInfo | null; label: string }) {
    return (
        <div className="rounded-lg border border-neutral-100 p-3">
            <p className="text-xs text-neutral-400">{label}</p>
            {sig ? (
                <>
                    {sig.signature_type === 'drawn' && sig.signature_data ? (
                        <img src={sig.signature_data} alt="Signature" className="my-1 h-14" />
                    ) : (
                        <p className="my-1 font-[cursive] text-2xl text-neutral-800">{sig.signer_name}</p>
                    )}
                    <p className="text-xs text-neutral-500">{sig.signer_name}</p>
                </>
            ) : (
                <p className="my-3 text-sm text-neutral-300">Not yet signed</p>
            )}
        </div>
    );
}

export default function Sign({
    contract,
    studio_name,
    studio_logo,
    studio_signature,
    client_signature,
    flash,
}: PageProps<{
    contract: PublicContract;
    studio_name: string | null;
    studio_logo: string | null;
    studio_signature: SignatureInfo | null;
    client_signature: SignatureInfo | null;
}>) {
    const initialValues: Record<string, string | boolean> = {};
    contract.client_fields.forEach((f) => {
        initialValues[f.key] = f.type === 'checkbox' ? !!f.value : (f.value as string) ?? '';
    });

    const form = useForm<SignFormData>({
        signer_name: '',
        signature_type: 'typed',
        signature_data: '',
        values: initialValues,
    });

    const alreadySigned = contract.signed || contract.status === 'signed';
    const notAvailable = contract.status === 'void' || contract.status === 'declined' || contract.status === 'draft';

    const setValue = (key: string, v: string | boolean) => form.setData('values', { ...form.data.values, [key]: v });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('contracts.public.sign', contract.public_id), { preserveScroll: true });
    };

    return (
        <div className="min-h-screen bg-neutral-100 py-8 sm:py-12">
            <Head title={contract.title} />
            <div className="mx-auto max-w-3xl px-4">
                {/* Studio header */}
                <div className="mb-6 text-center">
                    {studio_logo ? (
                        <img src={studio_logo} alt={studio_name ?? ''} className="mx-auto mb-2 h-12 object-contain" />
                    ) : (
                        <p className="text-lg font-semibold text-neutral-800">{studio_name}</p>
                    )}
                </div>

                {flash?.success && (
                    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>
                )}

                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
                    <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{contract.title}</h1>

                    <div
                        className="text-sm leading-relaxed text-neutral-700 [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: contract.body }}
                    />

                    <div className="my-8 border-t border-neutral-100" />

                    {notAvailable ? (
                        <p className="rounded-lg bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">This contract is not currently available for signing.</p>
                    ) : alreadySigned ? (
                        <div>
                            <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                                This contract has been signed{contract.signed_at ? ` on ${new Date(contract.signed_at).toLocaleDateString()}` : ''}. Thank you!
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <SignatureView sig={studio_signature} label="Photographer" />
                                <SignatureView sig={client_signature} label="You" />
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={submit}>
                            {contract.client_fields.length > 0 && (
                                <div className="mb-8 space-y-4">
                                    <h2 className="text-sm font-semibold text-neutral-800">Please complete the following</h2>
                                    {contract.client_fields.map((f) => (
                                        <div key={f.key}>
                                            {f.type === 'checkbox' ? (
                                                <label className="flex items-center gap-2 text-sm text-neutral-700">
                                                    <input type="checkbox" checked={!!form.data.values[f.key]} onChange={(e) => setValue(f.key, e.target.checked)} className="rounded border-neutral-300" />
                                                    {f.label}
                                                </label>
                                            ) : (
                                                <>
                                                    <label className="label mb-1.5">{f.label}</label>
                                                    {f.type === 'multiline' ? (
                                                        <textarea value={String(form.data.values[f.key] ?? '')} onChange={(e) => setValue(f.key, e.target.value)} rows={3} className="input" />
                                                    ) : (
                                                        <input type={f.type === 'date' ? 'date' : 'text'} value={String(form.data.values[f.key] ?? '')} onChange={(e) => setValue(f.key, e.target.value)} className="input" />
                                                    )}
                                                </>
                                            )}
                                            {form.errors[`values.${f.key}` as keyof typeof form.errors] && (
                                                <p className="mt-1 text-xs text-red-600">{form.errors[`values.${f.key}` as keyof typeof form.errors]}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h2 className="mb-2 text-sm font-semibold text-neutral-800">Your signature</h2>
                            <SignaturePad value={{ signer_name: form.data.signer_name, signature_type: form.data.signature_type, signature_data: form.data.signature_data }} onChange={(v) => form.setData({ ...form.data, ...v })} />
                            {form.errors.signature_data && <p className="mt-2 text-xs text-red-600">A signature is required.</p>}
                            {form.errors.signer_name && <p className="mt-2 text-xs text-red-600">{form.errors.signer_name}</p>}

                            <p className="mt-4 text-xs text-neutral-400">
                                By signing, you agree to the terms above. Your signature, the date, and your IP address are recorded.
                            </p>

                            <button type="submit" disabled={form.processing || !form.data.signer_name || !form.data.signature_data} className="btn-primary mt-6 w-full justify-center sm:w-auto disabled:opacity-40">
                                {form.processing ? 'Submitting…' : 'Agree & sign'}
                            </button>
                        </form>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-neutral-400">Powered by {studio_name}</p>
            </div>
        </div>
    );
}
