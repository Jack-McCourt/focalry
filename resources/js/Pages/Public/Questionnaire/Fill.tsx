import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface Question {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'select' | 'checkbox';
    options: string[];
    required: boolean;
}
interface Questionnaire {
    public_id: string;
    title: string;
    status: string;
    questions: Question[];
    answers: Record<string, string | boolean>;
    completed: boolean;
}

export default function Fill({
    questionnaire,
    studio_name,
    studio_logo,
    flash,
}: PageProps<{ questionnaire: Questionnaire; studio_name: string | null; studio_logo: string | null }>) {
    const initial: Record<string, string | boolean> = {};
    questionnaire.questions.forEach((q) => {
        initial[q.key] = q.type === 'checkbox' ? !!questionnaire.answers[q.key] : (questionnaire.answers[q.key] as string) ?? '';
    });

    const form = useForm<{ answers: Record<string, string | boolean> }>({ answers: initial });
    const setAnswer = (key: string, v: string | boolean) => form.setData('answers', { ...form.data.answers, [key]: v });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('questionnaires.public.submit', questionnaire.public_id), { preserveScroll: true });
    };

    return (
        <div className="min-h-screen bg-neutral-100 py-8 sm:py-12">
            <Head title={questionnaire.title} />
            <div className="mx-auto max-w-2xl px-4">
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

                <p className="mt-6 text-center text-xs text-neutral-400">Powered by {studio_name}</p>
            </div>
        </div>
    );
}
