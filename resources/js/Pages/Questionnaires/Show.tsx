import SendEmailModal from '@/Components/SendEmailModal';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { EmailDefaults, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface UploadRef {
    url: string;
    name?: string;
    size?: number;
}
type AnswerValue = string | boolean | UploadRef[];
interface Question {
    key: string;
    label: string;
    type: string;
    options: string[];
    required: boolean;
}
interface Questionnaire {
    id: number;
    title: string;
    status: 'draft' | 'sent' | 'completed';
    questions: Question[];
    answers: Record<string, AnswerValue>;
    project: { id: number; name: string } | null;
    contact: { name: string } | null;
    completed_at: string | null;
}

function UploadAnswer({ type, value }: { type: string; value: UploadRef[] }) {
    if (!value.length) return <span className="text-neutral-400">—</span>;
    if (type === 'image') {
        return (
            <div className="mt-2 flex flex-wrap gap-2">
                {value.map((img, i) => (
                    <a key={i} href={img.url} target="_blank" rel="noreferrer" title={img.name}>
                        <img src={img.url} alt={img.name ?? ''} className="h-20 w-20 rounded-md border border-neutral-200 object-cover" />
                    </a>
                ))}
            </div>
        );
    }
    return (
        <ul className="mt-2 space-y-1">
            {value.map((f, i) => (
                <li key={i}>
                    <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:text-brand-800">
                        {f.name ?? 'File'}
                    </a>
                </li>
            ))}
        </ul>
    );
}

export default function Show({
    questionnaire,
    public_url,
    email_defaults,
}: PageProps<{ questionnaire: Questionnaire; public_url: string; email_defaults: EmailDefaults }>) {
    const [emailOpen, setEmailOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(public_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const markSent = () => router.post(route('questionnaires.send', questionnaire.id), {}, { preserveScroll: true });
    const del = async () => {
        if (await confirmDialog('Delete this questionnaire?')) router.delete(route('questionnaires.destroy', questionnaire.id));
    };

    const completed = questionnaire.status === 'completed';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="truncate text-sm font-semibold text-neutral-900">{questionnaire.title}</h1>
                    <div className="flex items-center gap-2">
                        {!completed && <button onClick={() => setEmailOpen(true)} className="btn-secondary">Email to client</button>}
                        {!completed && <button onClick={markSent} className="btn-primary">Mark as sent</button>}
                    </div>
                </div>
            }
        >
            <Head title={questionnaire.title} />
            <StudioManagerNav active="questionnaires" />

            <div className="mx-auto max-w-3xl px-4 sm:px-8 py-8">
                <div className="mb-4 flex items-center gap-3 text-sm text-neutral-500">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${completed ? 'bg-emerald-50 text-emerald-700' : questionnaire.status === 'sent' ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-500'}`}>{questionnaire.status}</span>
                    {questionnaire.project && <span>{questionnaire.project.name}</span>}
                    {questionnaire.contact && <span>· {questionnaire.contact.name}</span>}
                </div>

                {/* Share link */}
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                    <input readOnly value={public_url} className="input flex-1 bg-neutral-50 text-neutral-500" />
                    <button onClick={copy} className="btn-secondary shrink-0">{copied ? 'Copied!' : 'Copy link'}</button>
                </div>

                {/* Questions / answers */}
                <div className="space-y-3">
                    {questionnaire.questions.map((q) => (
                        <div key={q.key} className="rounded-xl border border-neutral-200 bg-white p-4">
                            <p className="text-sm font-medium text-neutral-900">{q.label}</p>
                            {completed ? (
                                q.type === 'image' || q.type === 'file' ? (
                                    <UploadAnswer type={q.type} value={Array.isArray(questionnaire.answers[q.key]) ? (questionnaire.answers[q.key] as UploadRef[]) : []} />
                                ) : (
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
                                        {q.type === 'checkbox'
                                            ? questionnaire.answers[q.key] ? 'Yes' : 'No'
                                            : questionnaire.answers[q.key] === undefined || questionnaire.answers[q.key] === ''
                                              ? '—'
                                              : String(questionnaire.answers[q.key])}
                                    </p>
                                )
                            ) : (
                                <p className="mt-1 text-xs italic text-neutral-400">Awaiting answer</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8">
                    <button onClick={del} className="text-sm font-medium text-red-500 hover:text-red-700">Delete questionnaire</button>
                </div>
            </div>

            <SendEmailModal open={emailOpen} onClose={() => setEmailOpen(false)} defaults={email_defaults} />
        </AuthenticatedLayout>
    );
}
