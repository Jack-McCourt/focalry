import BookingsSubNav from '@/Components/BookingsSubNav';
import StudioManagerNav from '@/Components/StudioManagerNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface Rule {
    day_of_week: number;
    start_time: string;
    end_time: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Availability({
    rules,
    timezone,
}: PageProps<{ rules: Rule[]; timezone: string }>) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm<{ rules: Rule[] }>({ rules });

    const dayRules = (dow: number) => data.rules.filter((r) => r.day_of_week === dow);

    const addWindow = (dow: number) =>
        setData('rules', [...data.rules, { day_of_week: dow, start_time: '09:00', end_time: '17:00' }]);

    const updateWindow = (index: number, patchObj: Partial<Rule>) => {
        const next = [...data.rules];
        next[index] = { ...next[index], ...patchObj };
        setData('rules', next);
    };

    const removeWindow = (index: number) => setData('rules', data.rules.filter((_, i) => i !== index));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('availability.update'), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Bookings</h1>}>
            <Head title="Availability" />
            <StudioManagerNav active="bookings" />
            <BookingsSubNav active="availability" />

            <div className="px-4 py-6 sm:px-8">
                <form onSubmit={submit} className="max-w-2xl">
                    <p className="mb-4 text-sm text-neutral-500">
                        Set the hours you accept bookings each week. Open time slots are generated from these hours
                        minus existing bookings. Times are in <span className="font-medium text-neutral-700">{timezone}</span>.
                    </p>

                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                        {DAYS.map((label, dow) => {
                            const windows = data.rules
                                .map((r, i) => ({ r, i }))
                                .filter(({ r }) => r.day_of_week === dow);
                            return (
                                <div key={dow} className="flex items-start gap-4 p-4">
                                    <div className="w-28 shrink-0 pt-1.5 text-sm font-medium text-neutral-800">{label}</div>
                                    <div className="flex-1 space-y-2">
                                        {windows.length === 0 && <p className="py-1.5 text-sm text-neutral-400">Unavailable</p>}
                                        {windows.map(({ r, i }) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={r.start_time}
                                                    onChange={(e) => updateWindow(i, { start_time: e.target.value })}
                                                    className="rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
                                                />
                                                <span className="text-neutral-400">–</span>
                                                <input
                                                    type="time"
                                                    value={r.end_time}
                                                    onChange={(e) => updateWindow(i, { end_time: e.target.value })}
                                                    className="rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900"
                                                />
                                                <button type="button" onClick={() => removeWindow(i)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Remove">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => addWindow(dow)} className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800">
                                        + Add hours
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save availability'}</button>
                        {recentlySuccessful && <span className="text-sm text-neutral-500">Saved.</span>}
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
