import { Auth, Flash } from '@/types';
import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Toast {
    id: number;
    type: 'success' | 'error';
    message: string;
}

/**
 * Renders session flash messages as auto-dismissing toasts (top-right).
 * Mount once per authenticated layout — replaces the old static FlashBanner.
 */
export default function Toaster() {
    const { flash } = usePage<{ auth: Auth; flash: Flash }>().props;
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((t) => t.filter((x) => x.id !== id));
    }, []);

    const push = useCallback(
        (type: Toast['type'], message: string) => {
            const id = ++idRef.current;
            setToasts((t) => [...t, { id, type, message }]);
            window.setTimeout(() => dismiss(id), type === 'success' ? 4500 : 8000);
        },
        [dismiss],
    );

    useEffect(() => {
        if (flash?.success) push('success', flash.success);
        if (flash?.error) push('error', flash.error);
    }, [flash, push]);

    if (toasts.length === 0) return null;

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role="status"
                    className="toast-in pointer-events-auto flex items-start gap-3 rounded-xl bg-white p-4 shadow-lg ring-1 ring-neutral-950/10"
                >
                    {t.type === 'success' ? (
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        </span>
                    ) : (
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </span>
                    )}
                    <p className="flex-1 text-sm text-neutral-800">{t.message}</p>
                    <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        aria-label="Dismiss"
                        className="shrink-0 rounded-md p-0.5 text-neutral-400 transition hover:text-neutral-700"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
