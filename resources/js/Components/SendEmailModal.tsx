import Modal from '@/Components/Modal';
import { EmailDefaults } from '@/types';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';

interface SendForm {
    type: string;
    id: number;
    to: string;
    subject: string;
    body: string;
    options: string[];
    [key: string]: string | number | string[];
}

export default function SendEmailModal({
    open,
    onClose,
    defaults,
}: {
    open: boolean;
    onClose: () => void;
    defaults: EmailDefaults;
}) {
    const form = useForm<SendForm>({
        type: defaults.type,
        id: defaults.id,
        to: defaults.to ?? '',
        subject: defaults.subject,
        body: defaults.body,
        options: defaults.options.filter((o) => o.default).map((o) => o.key),
    });
    const { setData, reset, clearErrors } = form;

    // Reset to the defaults each time the modal is opened.
    useEffect(() => {
        if (open) {
            clearErrors();
            setData({
                type: defaults.type,
                id: defaults.id,
                to: defaults.to ?? '',
                subject: defaults.subject,
                body: defaults.body,
                options: defaults.options.filter((o) => o.default).map((o) => o.key),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const toggle = (key: string) => {
        const has = form.data.options.includes(key);
        setData('options', has ? form.data.options.filter((k) => k !== key) : [...form.data.options, key]);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('client-emails.send'), {
            preserveScroll: true,
            onSuccess: () => {
                onClose();
                reset();
            },
        });
    };

    return (
        <Modal show={open} onClose={onClose} maxWidth="xl">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-1 text-lg font-semibold text-neutral-900">Email to client</h2>
                <p className="mb-4 text-sm text-neutral-500">
                    A “{defaults.cta_label}” button linking to it is added automatically. Replies come back to you.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="label mb-1.5">To</label>
                        <input type="email" value={form.data.to} onChange={(e) => setData('to', e.target.value)} className="input" placeholder="client@example.com" />
                        {form.errors.to && <p className="mt-1 text-xs text-red-600">{form.errors.to}</p>}
                    </div>

                    <div>
                        <label className="label mb-1.5">Subject</label>
                        <input type="text" value={form.data.subject} onChange={(e) => setData('subject', e.target.value)} className="input" />
                        {form.errors.subject && <p className="mt-1 text-xs text-red-600">{form.errors.subject}</p>}
                    </div>

                    <div>
                        <label className="label mb-1.5">Message</label>
                        <textarea value={form.data.body} onChange={(e) => setData('body', e.target.value)} rows={9} className="input" />
                        {form.errors.body && <p className="mt-1 text-xs text-red-600">{form.errors.body}</p>}
                    </div>

                    {defaults.options.length > 0 && (
                        <div>
                            <label className="label mb-2">Include in the email</label>
                            <div className="space-y-2">
                                {defaults.options.map((o) => (
                                    <label key={o.key} className="flex items-center gap-2 text-sm text-neutral-700">
                                        <input type="checkbox" checked={form.data.options.includes(o.key)} onChange={() => toggle(o.key)} className="rounded border-neutral-300" />
                                        {o.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={form.processing || !form.data.to} className="btn-primary disabled:opacity-40">
                        {form.processing ? 'Sending…' : 'Send email'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
