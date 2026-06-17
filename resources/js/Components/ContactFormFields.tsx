export interface ContactFormData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company: string;
    status: 'lead' | 'client' | 'archived';
    notes: string;
    [key: string]: string;
}

export default function ContactFormFields({
    data,
    setData,
    errors,
}: {
    data: ContactFormData;
    setData: (key: keyof ContactFormData, value: string) => void;
    errors: Partial<Record<keyof ContactFormData, string>>;
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="label mb-1.5">First name</label>
                    <input
                        type="text"
                        value={data.first_name}
                        onChange={(e) => setData('first_name', e.target.value)}
                        className="input"
                        autoFocus
                    />
                    {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name}</p>}
                </div>
                <div>
                    <label className="label mb-1.5">Last name</label>
                    <input
                        type="text"
                        value={data.last_name}
                        onChange={(e) => setData('last_name', e.target.value)}
                        className="input"
                    />
                </div>
            </div>

            <div>
                <label className="label mb-1.5">Email</label>
                <input
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="input"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="label mb-1.5">Phone</label>
                    <input
                        type="tel"
                        value={data.phone}
                        onChange={(e) => setData('phone', e.target.value)}
                        className="input"
                    />
                </div>
                <div>
                    <label className="label mb-1.5">Company</label>
                    <input
                        type="text"
                        value={data.company}
                        onChange={(e) => setData('company', e.target.value)}
                        className="input"
                    />
                </div>
            </div>

            <div>
                <label className="label mb-1.5">Status</label>
                <div className="flex gap-2">
                    {(['lead', 'client', 'archived'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setData('status', s)}
                            className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition ${
                                data.status === s
                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="label mb-1.5">Notes</label>
                <textarea
                    value={data.notes}
                    onChange={(e) => setData('notes', e.target.value)}
                    rows={3}
                    className="input"
                />
            </div>
        </div>
    );
}
