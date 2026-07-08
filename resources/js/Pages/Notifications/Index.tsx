import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import Paginator from '@/Components/Paginator';

interface NotificationRow {
    id: string;
    type: string;
    title: string;
    preview: string | null;
    url: string | null;
    read: boolean;
    created_at: string | null;
}
interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}
interface Props {
    notifications: Paginated<NotificationRow>;
    filter: 'all' | 'unread';
    unread_total: number;
}

const TYPE_STYLES: Record<string, { dot: string; label: string }> = {
    invoice_paid: { dot: 'bg-emerald-500', label: 'Payment' },
    payment_overdue: { dot: 'bg-red-500', label: 'Overdue' },
    contract_signed: { dot: 'bg-indigo-500', label: 'Contract' },
    questionnaire_submitted: { dot: 'bg-sky-500', label: 'Questionnaire' },
    proposal_accepted: { dot: 'bg-violet-500', label: 'Proposal' },
    meeting_booked: { dot: 'bg-amber-500', label: 'Meeting' },
    package_booked: { dot: 'bg-fuchsia-500', label: 'Booking' },
    store_order: { dot: 'bg-cyan-500', label: 'Store' },
    lead: { dot: 'bg-brand-500', label: 'Lead' },
    message: { dot: 'bg-neutral-400', label: 'Message' },
};

function relativeTime(iso: string | null): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Notifications({ notifications, filter, unread_total }: Props) {
    const open = (n: NotificationRow) => {
        router.post(
            route('notifications.read', n.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    if (n.url) router.visit(n.url);
                },
            },
        );
    };

    const markAll = () => router.post(route('notifications.read-all'), {}, { preserveScroll: true });

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Notifications</h1>}>
            <Head title="Notifications" />

            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-light text-neutral-900">Notifications</h2>
                        <p className="mt-1 text-sm text-neutral-500">{unread_total} unread</p>
                    </div>
                    {unread_total > 0 && (
                        <button onClick={markAll} className="btn-secondary px-3 py-2 text-xs">
                            Mark all read
                        </button>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="mb-4 flex gap-1.5">
                    {(['all', 'unread'] as const).map((f) => (
                        <Link
                            key={f}
                            href={route('notifications.index', f === 'unread' ? { unread: 1 } : {})}
                            preserveScroll
                            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                                filter === f ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            {f}
                        </Link>
                    ))}
                </div>

                <div className="card divide-y divide-neutral-100 overflow-hidden">
                    {notifications.data.length === 0 ? (
                        <p className="py-16 text-center text-sm text-neutral-400">
                            {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
                        </p>
                    ) : (
                        notifications.data.map((n) => {
                            const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.message;
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => open(n)}
                                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-neutral-50 ${n.read ? '' : 'bg-brand-50/40'}`}
                                >
                                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-neutral-200' : style.dot}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-medium text-neutral-900">{n.title}</p>
                                            <span className="shrink-0 text-xs text-neutral-400">{relativeTime(n.created_at)}</span>
                                        </div>
                                        {n.preview && <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{n.preview}</p>}
                                        <span className="mt-1 inline-block text-[11px] font-medium uppercase tracking-wide text-neutral-300">{style.label}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                <Paginator paginator={notifications} />
            </div>
        </AuthenticatedLayout>
    );
}
