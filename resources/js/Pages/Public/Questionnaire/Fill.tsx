import FileField, { FileRef } from '@/Components/FileField';
import ImageField, { ImageRef } from '@/Components/ImageField';
import PublicShell from '@/Components/PublicShell';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface Question {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'select' | 'checkbox' | 'image' | 'file';
    options: string[];
    required: boolean;
}
type AnswerValue = string | boolean | ImageRef[] | FileRef[];
interface Questionnaire {
    public_id: string;
    title: string;
    status: string;
    questions: Question[];
    answers: Record<string, AnswerValue>;
    completed: boolean;
}

export default function Fill({
    questionnaire,
    studio_name,
    studio_logo,
    flash,
}: PageProps<{ questionnaire: Questionnaire; studio_name: string | null; studio_logo: string | null }>) {
    const initial: Record<string, AnswerValue> = {};
    questionnaire.questions.forEach((q) => {
        if (q.type === 'checkbox') initial[q.key] = !!questionnaire.answers[q.key];
        else if (q.type === 'image' || q.type === 'file') initial[q.key] = Array.isArray(questionnaire.answers[q.key]) ? questionnaire.answers[q.key] : [];
        else initial[q.key] = (questionnaire.answers[q.key] as string) ?? '';
    });

    const form = useForm<{ answers: Record<string, AnswerValue> }>({ answers: initial });
    const setAnswer = (key: string, v: AnswerValue) => form.setData('answers', { ...form.data.answers, [key]: v });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('questionnaires.public.submit', questionnaire.public_id), { preserveScroll: true });
    };

    return (
        <>
            <Head title={questionnaire.title} />
            <PublicShell brand={{ name: studio_name, logo: studio_logo }} maxWidth="md">
                {flash?.success && (
                    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>
                )}

                <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-10">
                    <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{questionnaire.title}</h1>

                    {questionnaire.completed ? (
                        <p className="rounded-lg bg-emerald-50 px-4 py-6 text-center text-sm font-medium text-emerald-800">
                            Thank you — your answers have been submitted.
                        </p>
                    ) : (
                        <form onSubmit={submit} className="space-y-5">
                            {questionnaire.questions.map((q) => {
                                const err = form.errors[`answers.${q.key}` as keyof typeof form.errors];
                                return (
                                    <div key={q.key}>
                                        {q.type === 'checkbox' ? (
                                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                                <input type="checkbox" checked={!!form.data.answers[q.key]} onChange={(e) => setAnswer(q.key, e.target.checked)} className="rounded border-neutral-300" />
                                                {q.label}
                                            </label>
                                        ) : (
                                            <>
                                                <label className="label mb-1.5">
                                                    {q.label}{q.required && <span className="text-red-500"> *</span>}
                                                </label>
                                                {q.type === 'textarea' ? (
                                                    <textarea value={String(form.data.answers[q.key] ?? '')} onChange={(e) => setAnswer(q.key, e.target.value)} rows={3} className="input" />
                                                ) : q.type === 'select' ? (
                                                    <select value={String(form.data.answers[q.key] ?? '')} onChange={(e) => setAnswer(q.key, e.target.value)} className="input">
                                                        <option value="">Choose…</option>
                                                        {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : q.type === 'image' ? (
                                                    <ImageField
                                                        images={(form.data.answers[q.key] as ImageRef[]) ?? []}
                                                        label={q.label}
                                                        uploadUrl={route('questionnaires.public.upload-image', questionnaire.public_id)}
                                                        onChange={(v) => setAnswer(q.key, v)}
                                                    />
                                                ) : q.type === 'file' ? (
                                                    <FileField
                                                        files={(form.data.answers[q.key] as FileRef[]) ?? []}
                                                        label={q.label}
                                                        uploadUrl={route('questionnaires.public.upload-file', questionnaire.public_id)}
                                                        onChange={(v) => setAnswer(q.key, v)}
                                                    />
                                                ) : (
                                                    <input type={q.type === 'date' ? 'date' : 'text'} value={String(form.data.answers[q.key] ?? '')} onChange={(e) => setAnswer(q.key, e.target.value)} className="input" />
                                                )}
                                            </>
                                        )}
                                        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                                    </div>
                                );
                            })}

                            <button type="submit" disabled={form.processing} className="btn-primary mt-2 w-full justify-center disabled:opacity-40">
                                {form.processing ? 'Submitting…' : 'Submit answers'}
                            </button>
                        </form>
                    )}
                </div>

            </PublicShell>
        </>
    );
}
