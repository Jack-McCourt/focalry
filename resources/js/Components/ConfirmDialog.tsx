import Modal from '@/Components/Modal';
import { useEffect, useState } from 'react';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Destructive styling (red confirm button). Defaults to true — most confirms guard deletes. */
    danger?: boolean;
}

type Opener = (opts: ConfirmOptions) => Promise<boolean>;

let opener: Opener | null = null;

/**
 * Promise-based replacement for window.confirm(), styled like the rest of the
 * app. Usage: `if (!(await confirmDialog('Delete this gallery?'))) return;`
 * Falls back to the native dialog if the host isn't mounted (SSR, tests).
 */
export function confirmDialog(opts: string | ConfirmOptions): Promise<boolean> {
    const options = typeof opts === 'string' ? { message: opts } : opts;
    if (!opener) {
        return Promise.resolve(typeof window !== 'undefined' && window.confirm(options.message));
    }

    return opener(options);
}

/** Mounted once in app.tsx; renders whatever confirmDialog() is currently asking. */
export default function ConfirmDialogHost() {
    const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        opener = (opts) =>
            new Promise<boolean>((resolve) => {
                setPending({ opts, resolve });
                setShow(true);
            });
        return () => {
            opener = null;
        };
    }, []);

    const finish = (ok: boolean) => {
        setShow(false);
        pending?.resolve(ok);
        // Keep the content mounted while the modal transitions out.
        window.setTimeout(() => setPending(null), 250);
    };

    const opts = pending?.opts;
    const danger = opts?.danger ?? true;

    return (
        <Modal show={show} maxWidth="sm" onClose={() => finish(false)}>
            {opts && (
                <div className="p-6">
                    <h2 className="text-base font-semibold text-neutral-900">{opts.title ?? 'Are you sure?'}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm text-neutral-600">{opts.message}</p>
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" className="btn-secondary" onClick={() => finish(false)}>
                            {opts.cancelLabel ?? 'Cancel'}
                        </button>
                        <button
                            type="button"
                            autoFocus
                            className={
                                danger
                                    ? 'inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
                                    : 'btn-primary'
                            }
                            onClick={() => finish(true)}
                        >
                            {opts.confirmLabel ?? 'Confirm'}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
