import SignaturePad, { SignatureValue } from '@/Components/SignaturePad';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface Proposal {
    public_id: string;
    title: string;
    intro: string | null;
    status: 'draft' | 'sent' | 'accepted' | 'declined';
    require_signature: boolean;
    require_deposit: boolean;
    accepted_at: string | null;
}
interface Package { name: string; description: string | null; details: string | null; price: string }
interface Contract { title: string; body: string; signed: boolean }
interface Invoice { number: string; total: string; payable: string; paid: boolean; pay_url: string }

export default function View({
    proposal,
    package: pkg,
    contract,
    invoice,
    studio_name,
    studio_logo,
    flash,
}: PageProps<{
    proposal: Proposal;
    package: Package | null;
    contract: Contract | null;
    invoice: Invoice | null;
    studio_name: string | null;
    studio_logo: string | null;
}>) {
    const form = useForm<SignatureValue>({ signer_name: '', signature_type: 'typed', signature_data: '' });

    const sign = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('proposals.public.sign', proposal.public_id), { preserveScroll: true });
    };

    const accepted = proposal.status === 'accepted';
    const needsSignature = proposal.require_signature && contract && !contract.signed;
    const needsDeposit = proposal.require_deposit && invoice && !invoice.paid;

    return (
        <div className="min-h-screen bg-neutral-100 py-8 sm:py-12">
            <Head title={proposal.title} />
            <div className="mx-auto max-w-3xl px-4">
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
                    <h1 className="text-2xl font-semibold text-neutral-900">{proposal.title}</h1>

                    {accepted && (
                        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                            🎉 This proposal has been accepted{proposal.accepted_at ? ` on ${new Date(proposal.accepted_at).toLocaleDateString()}` : ''}. Thank you!
                        </p>
                    )}

                    {proposal.intro && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{proposal.intro}</p>}

                    {/* Package */}
                    {pkg && (
                        <div className="mt-8 rounded-xl border border-neutral-200 p-5">
                            <div className="flex items-baseline justify-between">
                                <h2 className="text-lg font-semibold text-neutral-900">{pkg.name}</h2>
                                <span className="text-lg font-semibold text-neutral-900">{pkg.price}</span>
                            </div>
                            {pkg.description && <p className="mt-1 text-sm text-neutral-600">{pkg.description}</p>}
                            {pkg.details && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-500">{pkg.details}</p>}
                        </div>
                    )}

                    {/* Contract */}
                    {contract && (
                        <div className="mt-8">
                            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Agreement</h2>
                            <div
                                className="rounded-xl border border-neutral-200 p-5 text-sm leading-relaxed text-neutral-700 [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                                dangerouslySetInnerHTML={{ __html: contract.body }}
                            />
                            {contract.signed && <p className="mt-3 text-sm font-medium text-emerald-700">✓ Signed</p>}
                        </div>
                    )}

                    {!accepted && (
                        <div className="mt-8 space-y-6 border-t border-neutral-100 pt-8">
                            {/* Signature */}
                            {needsSignature && (
                                <form onSubmit={sign}>
                                    <h2 className="mb-2 text-sm font-semibold text-neutral-800">1. Sign the agreement</h2>
                                    <SignaturePad value={form.data} onChange={(v) => form.setData({ ...form.data, ...v })} />
                                    {form.errors.signer_name && <p className="mt-2 text-xs text-red-600">{form.errors.signer_name}</p>}
                                    {form.errors.signature_data && <p className="mt-2 text-xs text-red-600">A signature is required.</p>}
                                    <button type="submit" disabled={form.processing || !form.data.signer_name || !form.data.signature_data} className="btn-primary mt-4 disabled:opacity-40">
                                        {form.processing ? 'Submitting…' : 'Agree & sign'}
                                    </button>
                                </form>
                            )}

                            {/* Deposit */}
                            {invoice && (
                                <div>
                                    <h2 className="mb-2 text-sm font-semibold text-neutral-800">{proposal.require_signature && contract ? '2. ' : ''}Pay the deposit</h2>
                                    {invoice.paid ? (
                                        <p className="text-sm font-medium text-emerald-700">✓ Deposit received</p>
                                    ) : (
                                        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
                                            <div>
                                                <p className="text-sm text-neutral-600">Amount due now</p>
                                                <p className="text-lg font-semibold text-neutral-900">{invoice.payable}</p>
                                            </div>
                                            <a href={invoice.pay_url} className="btn-primary">Pay securely</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!needsSignature && !needsDeposit && (
                                <p className="rounded-lg bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">Everything's done — this will be confirmed shortly.</p>
                            )}
                        </div>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-neutral-400">Powered by {studio_name}</p>
            </div>
        </div>
    );
}
