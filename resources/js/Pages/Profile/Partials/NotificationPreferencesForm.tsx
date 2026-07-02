import { useForm } from '@inertiajs/react';

export interface NotificationTypePref {
    key: string;
    label: string;
    email: boolean;
}

export default function NotificationPreferencesForm({
    types,
    className = '',
}: {
    types: NotificationTypePref[];
    className?: string;
}) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm<{ preferences: Record<string, boolean> }>({
        preferences: Object.fromEntries(types.map((t) => [t.key, t.email])),
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('profile.notifications'), { preserveScroll: true });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Choose which events email you. Every event always shows in your in-app notification bell.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {types.map((t) => (
                        <label key={t.key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                            <span className="text-sm text-neutral-800">{t.label}</span>
                            <span className="flex items-center gap-2 text-xs text-neutral-400">
                                Email
                                <input
                                    type="checkbox"
                                    checked={data.preferences[t.key] ?? false}
                                    onChange={(e) => setData('preferences', { ...data.preferences, [t.key]: e.target.checked })}
                                    className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                                />
                            </span>
                        </label>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <button type="submit" disabled={processing} className="btn-primary px-4 py-2 text-sm">
                        Save
                    </button>
                    {recentlySuccessful && <p className="text-sm text-neutral-500">Saved.</p>}
                </div>
            </form>
        </section>
    );
}
