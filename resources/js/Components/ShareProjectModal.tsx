import Modal from '@/Components/Modal';
import axios from 'axios';
import { useState } from 'react';

export interface ProjectShareItem {
    id: number;
    email: string;
    code: string;
    last_viewed_at: string | null;
    url: string;
}

function csrf(): string {
    const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}
const xsrf = () => ({ headers: { 'X-XSRF-TOKEN': csrf() } });

/** Google-Drive-style restricted sharing: invite people by email; each gets
 *  their own revocable link. Nobody else can open the read-only page. */
export default function ShareProjectModal({
    show,
    onClose,
    projectId,
    shares,
    onChange,
}: {
    show: boolean;
    onClose: () => void;
    projectId: number;
    shares: ProjectShareItem[];
    onChange: (shares: ProjectShareItem[]) => void;
}) {
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const invite = (e: React.FormEvent) => {
        e.preventDefault();
        const value = email.trim();
        if (!value) return;
        setBusy(true);
        setError(null);
        axios
            .post(route('projects.shares.store', projectId), { email: value }, xsrf())
            .then((r) => {
                const share: ProjectShareItem = r.data.share;
                onChange([share, ...shares.filter((s) => s.id !== share.id)]);
                setEmail('');
            })
            .catch((err) => setError(err.response?.data?.errors?.email?.[0] ?? 'Could not send the invitation.'))
            .finally(() => setBusy(false));
    };

    const revoke = (id: number) => {
        axios.delete(route('project-shares.destroy', id), xsrf()).then(() => onChange(shares.filter((s) => s.id !== id)));
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-neutral-900">Share project</h2>
                    <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
                        ✕
                    </button>
                </div>
                <p className="mb-4 text-sm text-neutral-500">
                    Invite people by email to view a read-only, printable copy of these details. Only invited people can open the link.
                </p>

                <form onSubmit={invite} className="flex items-start gap-2">
                    <div className="flex-1">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="input w-full"
                        />
                        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                    </div>
                    <button type="submit" disabled={busy} className="btn-primary whitespace-nowrap">
                        {busy ? 'Sending…' : 'Invite'}
                    </button>
                </form>

                <div className="mt-5">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">People with access</h3>
                    {shares.length === 0 ? (
                        <p className="text-sm text-neutral-400">No one yet. Invite someone above.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {shares.map((s) => (
                                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-neutral-800">{s.email}</span>
                                        <span className="text-xs text-neutral-400">
                                            Code <span className="font-mono text-neutral-600">{s.code}</span>
                                            {' · '}
                                            {s.last_viewed_at ? `Viewed ${new Date(s.last_viewed_at).toLocaleDateString()}` : 'Not viewed yet'}
                                        </span>
                                    </span>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigator.clipboard?.writeText(s.url)}
                                            className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                                            title="Copy link"
                                        >
                                            Copy link
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => revoke(s.id)}
                                            className="text-xs text-neutral-400 hover:text-red-600"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Modal>
    );
}
