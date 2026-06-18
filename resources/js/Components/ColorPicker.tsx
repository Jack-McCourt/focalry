import { COLOR_PALETTE } from '@/lib/projectColors';
import { CSSProperties, useEffect, useRef, useState } from 'react';

// Neutrals (useful for backgrounds) followed by the shared accent palette.
const SITE_PALETTE = ['#ffffff', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#525252', '#262626', '#000000', ...COLOR_PALETTE];

const CHECKERBOARD: CSSProperties = {
    backgroundImage:
        'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)',
    backgroundSize: '8px 8px',
    backgroundPosition: '0 0,0 4px,4px -4px,-4px 0',
};

/** Normalise user-typed hex to `#rrggbb`, or null if not a valid colour. */
function normalizeHex(v: string): string | null {
    let s = v.trim().toLowerCase();
    if (s && !s.startsWith('#')) s = `#${s}`;
    const m3 = /^#([0-9a-f]{3})$/.exec(s);
    if (m3) {
        const [r, g, b] = m3[1].split('');
        s = `#${r}${r}${g}${g}${b}${b}`;
    }
    return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

export default function ColorPicker({
    value,
    onChange,
    allowClear = false,
}: {
    value: string;
    onChange: (hex: string) => void;
    allowClear?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(value || '');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => setText(value || ''), [value]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const hasColor = !!value;
    const swatchStyle = hasColor ? { backgroundColor: value } : CHECKERBOARD;

    const commitText = (v: string) => {
        setText(v);
        const n = normalizeHex(v);
        if (n) onChange(n);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm transition hover:border-neutral-300"
            >
                <span className="h-5 w-5 shrink-0 rounded ring-1 ring-black/10" style={swatchStyle} />
                <span className="text-neutral-600">{hasColor ? value : 'None'}</span>
                <svg className="ml-auto h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>

            {open && (
                <div className="absolute left-0 z-40 mt-1 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
                    <div className="grid grid-cols-8 gap-1.5">
                        {SITE_PALETTE.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onChange(c)}
                                className={`h-5 w-5 rounded ring-1 ring-black/10 transition ${value.toLowerCase() === c.toLowerCase() ? 'outline outline-2 outline-offset-1 outline-blue-500' : 'hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                        <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded ring-1 ring-black/10" style={swatchStyle} title="Custom colour">
                            <input
                                type="color"
                                value={normalizeHex(value) ?? '#000000'}
                                onChange={(e) => onChange(e.target.value)}
                                className="absolute inset-0 h-[150%] w-[150%] cursor-pointer opacity-0"
                            />
                        </label>
                        <input className="input flex-1" value={text} placeholder="#000000" spellCheck={false} onChange={(e) => commitText(e.target.value)} />
                    </div>

                    {allowClear && (
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); }}
                            className="mt-2 w-full rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                        >
                            Clear / none
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
