import PublicShell, { PublicCard } from '@/Components/PublicShell';
import { formatMoney } from '@/lib/money';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

interface Gallery {
    title: string;
    event_date: string | null;
    url: string;
}
interface InvoiceItem {
    number: string | null;
    status: string;
    currency: string;
    total_cents: number;
    balance_cents: number;
    due_date: string | null;
    url: string;
}
interface ContractItem {
    title: string;
    status: string;
    signed: boolean;
    url: string;
}
interface QuestionnaireItem {
    title: string;
    status: string;
    completed: boolean;
    url: string;
}
interface ProposalItem {
    title: string;
    status: string;
    url: string;
}
interface MeetingItem {
    title: string;
    status: string;
    starts_at: string | null;
    location: string | null;
    meeting_url: string | null;
}
interface PortalProject {
    id: number | null;
    name: string;
    event_date: string | null;
    status: string | null;
    type: string | null;
    items: {
        galleries: Gallery[];
        invoices: InvoiceItem[];
        contracts: ContractItem[];
        questionnaires: QuestionnaireItem[];
        proposals: ProposalItem[];
        meetings: MeetingItem[];
    };
}

function fmtDate(d: string | null, opts?: Intl.DateTimeFormatOptions) {
    if (!d) return null;
    return new Date(d).toLocaleDateString(undefined, opts ?? { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** A coloured status chip — emerald for "done", amber for "needs action". */
function Chip({ tone, children }: { tone: 'done' | 'action' | 'muted'; children: React.ReactNode }) {
    const cls =
        tone === 'done'
            ? 'bg-emerald-50 text-emerald-700'
            : tone === 'action'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-neutral-100 text-neutral-500';
    return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${cls}`}>{children}</span>;
}

function Row({
    title,
    subtitle,
    chip,
    cta,
}: {
    title: string;
    subtitle?: string | null;
    chip?: React.ReactNode;
    cta?: { label: string; url: string; primary?: boolean };
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3.5 first:border-t-0">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900">{title}</span>
                    {chip}
                </div>
                {subtitle && <p className="mt-0.5 truncate text-xs text-neutral-400">{subtitle}</p>}
            </div>
            {cta && (
                <a
                    href={cta.url}
                    target="_blank"
                    rel="noreferrer"
                    className={
                        cta.primary
                            ? 'shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700'
                            : 'shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50'
                    }
                >
                    {cta.label}
                </a>
            )}
        </div>
    );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</h3>
            <PublicCard>{children}</PublicCard>
        </div>
    );
}

export default function ClientPortal({
    client_name,
    studio_name,
    studio_logo,
    projects,
}: PageProps<{
    client_name: string;
    studio_name: string | null;
    studio_logo: string | null;
    projects: PortalProject[];
}>) {
    return (
        <PublicShell brand={{ name: studio_name, logo: studio_logo }} maxWidth="xl">
            <Head title="Your portal" />

            <div className="mb-8 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Hello, {client_name}</h1>
                <p className="mt-2 text-sm text-neutral-500">Everything for your work with {studio_name ?? 'us'}, in one place.</p>
            </div>

            {projects.length === 0 ? (
                <PublicCard className="px-6 py-12 text-center text-sm text-neutral-500">
                    Nothing has been shared with you yet. You'll see your galleries, invoices and documents here as they're ready.
                </PublicCard>
            ) : (
                <div className="space-y-12">
                    {projects.map((project, pi) => {
                        const { items } = project;
                        const eventDate = fmtDate(project.event_date);
                        return (
                            <section key={project.id ?? `loose-${pi}`}>
                                <header className="mb-4 border-b border-neutral-200/70 pb-3">
                                    <h2 className="text-lg font-semibold text-neutral-900">{project.name}</h2>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
                                        {project.type && <span>{project.type}</span>}
                                        {eventDate && <span>{eventDate}</span>}
                                    </div>
                                </header>

                                <div className="space-y-6">
                                    {items.meetings.length > 0 && (
                                        <Section label="Sessions">
                                            {items.meetings.map((m, i) => (
                                                <Row
                                                    key={i}
                                                    title={m.title}
                                                    subtitle={
                                                        [fmtDateTime(m.starts_at), m.location].filter(Boolean).join(' · ') || null
                                                    }
                                                    chip={<Chip tone={m.status === 'confirmed' ? 'done' : 'action'}>{m.status}</Chip>}
                                                    cta={m.meeting_url ? { label: 'Join', url: m.meeting_url } : undefined}
                                                />
                                            ))}
                                        </Section>
                                    )}

                                    {items.galleries.length > 0 && (
                                        <Section label="Galleries">
                                            {items.galleries.map((g, i) => (
                                                <Row
                                                    key={i}
                                                    title={g.title}
                                                    subtitle={fmtDate(g.event_date)}
                                                    cta={{ label: 'View', url: g.url, primary: true }}
                                                />
                                            ))}
                                        </Section>
                                    )}

                                    {items.invoices.length > 0 && (
                                        <Section label="Invoices">
                                            {items.invoices.map((inv, i) => {
                                                const paid = inv.status === 'paid' || inv.balance_cents === 0;
                                                return (
                                                    <Row
                                                        key={i}
                                                        title={`Invoice ${inv.number ?? ''}`.trim()}
                                                        subtitle={
                                                            paid
                                                                ? `${formatMoney(inv.total_cents, inv.currency)} · Paid in full`
                                                                : `${formatMoney(inv.balance_cents, inv.currency)} due` +
                                                                  (inv.due_date ? ` by ${fmtDate(inv.due_date)}` : '')
                                                        }
                                                        chip={<Chip tone={paid ? 'done' : 'action'}>{inv.status}</Chip>}
                                                        cta={{
                                                            label: paid ? 'View' : 'Pay now',
                                                            url: inv.url,
                                                            primary: !paid,
                                                        }}
                                                    />
                                                );
                                            })}
                                        </Section>
                                    )}

                                    {items.proposals.length > 0 && (
                                        <Section label="Proposals">
                                            {items.proposals.map((p, i) => {
                                                const accepted = p.status === 'accepted';
                                                return (
                                                    <Row
                                                        key={i}
                                                        title={p.title}
                                                        chip={<Chip tone={accepted ? 'done' : 'action'}>{p.status}</Chip>}
                                                        cta={{ label: accepted ? 'View' : 'Review', url: p.url, primary: !accepted }}
                                                    />
                                                );
                                            })}
                                        </Section>
                                    )}

                                    {items.contracts.length > 0 && (
                                        <Section label="Contracts">
                                            {items.contracts.map((c, i) => (
                                                <Row
                                                    key={i}
                                                    title={c.title}
                                                    chip={<Chip tone={c.signed ? 'done' : 'action'}>{c.signed ? 'Signed' : 'Awaiting signature'}</Chip>}
                                                    cta={{ label: c.signed ? 'View' : 'Review & sign', url: c.url, primary: !c.signed }}
                                                />
                                            ))}
                                        </Section>
                                    )}

                                    {items.questionnaires.length > 0 && (
                                        <Section label="Questionnaires">
                                            {items.questionnaires.map((q, i) => (
                                                <Row
                                                    key={i}
                                                    title={q.title}
                                                    chip={<Chip tone={q.completed ? 'done' : 'action'}>{q.completed ? 'Completed' : 'To complete'}</Chip>}
                                                    cta={{ label: q.completed ? 'View' : 'Complete', url: q.url, primary: !q.completed }}
                                                />
                                            ))}
                                        </Section>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </PublicShell>
    );
}
