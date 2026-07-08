import { useState } from 'react';

/**
 * Breadcrumb-style invoice number: shows the number as plain text with a pencil
 * to reveal an input for overriding it (Pixieset-style).
 */
export default function InvoiceNumberField({
    value,
    onChange,
    error,
}: {
    value: string;
    onChange: (v: string) => void;
    error?: string;
}) {
    const [editing, setEditing] = useState(false);

    if (editing) {
        return (
            <input
                autoFocus
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(false);
                    }
                }}
                className="w-40 rounded-md border border-neutral-300 px-2 py-0.5 font-mono text-sm font-semibold text-neutral-900 focus:border-brand-500 focus:ring-brand-500"
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit invoice number"
            className="group inline-flex items-center gap-1.5"
        >
            <span className={`font-mono font-semibold ${error ? 'text-red-600' : 'text-neutral-900'}`}>
                {value || 'Invoice'}
            </span>
            <svg className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
        </button>
    );
}
