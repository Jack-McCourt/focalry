import { COLOR_PALETTE, dotStyle } from '@/lib/projectColors';
import { useState } from 'react';

export interface ColorItem {
    id: number;
    label: string;
    color: string;
}

function Swatch({ color, onPick }: { color: string; onPick: (c: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
                style={dotStyle(color)}
                title="Change colour"
            />
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-8 z-20 grid w-44 grid-cols-6 gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                        {COLOR_PALETTE.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => { onPick(c); setOpen(false); }}
                                className="h-5 w-5 rounded-full ring-1 ring-black/10"
                                style={dotStyle(c)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function ColorListEditor({
    items,
    onAdd,
    onUpdate,
    onDelete,
    onReorder,
    addLabel = 'Add',
}: {
    items: ColorItem[];
    onAdd: (label: string, color: string) => void;
    onUpdate: (id: number, label: string, color: string) => void;
    onDelete: (id: number) => void;
    onReorder: (orderedIds: number[]) => void;
    addLabel?: string;
}) {
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);

    const move = (i: number, dir: -1 | 1) => {
        const next = [...items];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        onReorder(next.map((x) => x.id));
    };

    const add = () => {
        if (newLabel.trim() === '') return;
        onAdd(newLabel.trim(), newColor);
        setNewLabel('');
    };

    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2">
                    <div className="flex flex-col">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-neutral-300 hover:text-neutral-600 disabled:opacity-30">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-neutral-300 hover:text-neutral-600 disabled:opacity-30">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                        </button>
                    </div>
                    <Swatch color={item.color} onPick={(c) => onUpdate(item.id, item.label, c)} />
                    <input
                        type="text"
                        defaultValue={item.label}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== item.label && onUpdate(item.id, e.target.value.trim(), item.color)}
                        className="input flex-1"
                    />
                    <button type="button" onClick={() => onDelete(item.id)} className="text-neutral-300 transition hover:text-red-500" title="Delete">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}

            {/* Add row */}
            <div className="flex items-center gap-2 pt-1">
                <div className="w-[18px]" />
                <Swatch color={newColor} onPick={setNewColor} />
                <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
                    placeholder={`${addLabel}…`}
                    className="input flex-1"
                />
                <button type="button" onClick={add} disabled={!newLabel.trim()} className="btn-secondary disabled:opacity-40">Add</button>
            </div>
        </div>
    );
}
