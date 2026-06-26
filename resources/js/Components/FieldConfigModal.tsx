import Modal from '@/Components/Modal';
import { COLOR_PALETTE, dotStyle } from '@/lib/projectColors';
import { ProjectFieldType } from '@/types';
import { useForm } from '@inertiajs/react';

const TYPE_OPTIONS: { value: ProjectFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'long_text', label: 'Long text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Single select' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'url', label: 'URL' },
    { value: 'image', label: 'Images' },
    { value: 'file', label: 'Files' },
];

interface Choice {
    label: string;
    color: string;
}

export default function FieldConfigModal({ show, onClose }: { show: boolean; onClose: () => void }) {
    const { data, setData, post, transform, processing, errors, reset } = useForm<{
        label: string;
        type: ProjectFieldType;
        options: Choice[];
    }>({ label: '', type: 'text', options: [] });

    const addChoice = () =>
        setData('options', [...data.options, { label: '', color: COLOR_PALETTE[data.options.length % COLOR_PALETTE.length] }]);
    const setChoice = (i: number, label: string) =>
        setData('options', data.options.map((c, idx) => (idx === i ? { ...c, label } : c)));
    const removeChoice = (i: number) => setData('options', data.options.filter((_, idx) => idx !== i));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        // Only send non-empty choices, and only for select fields.
        transform((d) => ({
            ...d,
            options: d.type === 'select' ? d.options.filter((c) => c.label.trim() !== '') : [],
        }));
        post(route('project-fields.store'), {
            preserveScroll: true,
            onSuccess: () => { reset(); onClose(); },
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="mb-5 text-base font-semibold text-neutral-900">Add field</h2>
                <div className="space-y-4">
                    <div>
                        <label className="label mb-1.5">Field name</label>
                        <input type="text" value={data.label} onChange={(e) => setData('label', e.target.value)} className="input" autoFocus />
                        {errors.label && <p className="mt-1 text-xs text-red-600">{errors.label}</p>}
                    </div>
                    <div>
                        <label className="label mb-1.5">Type</label>
                        <select value={data.type} onChange={(e) => setData('type', e.target.value as ProjectFieldType)} className="input">
                            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>

                    {data.type === 'select' && (
                        <div>
                            <label className="label mb-1.5">Choices</label>
                            <div className="space-y-2">
                                {data.options.map((c, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="h-3 w-3 shrink-0 rounded-full" style={dotStyle(c.color)} />
                                        <input type="text" value={c.label} onChange={(e) => setChoice(i, e.target.value)} placeholder="Option label" className="input flex-1" />
                                        <button type="button" onClick={() => removeChoice(i)} className="text-neutral-300 hover:text-red-500">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addChoice} className="mt-2 text-sm font-medium text-neutral-700 hover:text-neutral-900">+ Add choice</button>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Add field'}</button>
                </div>
            </form>
        </Modal>
    );
}
