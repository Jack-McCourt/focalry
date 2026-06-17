import { dotStyle, pillStyle } from '@/lib/projectColors';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';

export interface PillOption {
    id: number;
    label: string;
    color: string;
}

/** Shows the selected value as a coloured pill; click it to pick another from a dropdown. */
export default function PillSelect({
    options,
    value,
    onChange,
    placeholder = 'Set',
}: {
    options: PillOption[];
    value: number | null;
    onChange: (id: number) => void;
    placeholder?: string;
}) {
    const selected = options.find((o) => o.id === value) ?? null;

    return (
        <Listbox value={value ?? undefined} onChange={(v) => v != null && onChange(v)}>
            <div className="relative">
                <ListboxButton className="rounded focus:outline-none focus:ring-1 focus:ring-neutral-300">
                    {selected ? (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium" style={pillStyle(selected.color)}>
                            {selected.label}
                        </span>
                    ) : (
                        <span className="text-xs text-neutral-400 hover:text-neutral-600">{placeholder}</span>
                    )}
                </ListboxButton>
                <ListboxOptions
                    anchor="bottom start"
                    className="z-50 max-h-56 min-w-[10rem] overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg [--anchor-gap:4px] focus:outline-none"
                >
                    {options.map((o) => (
                        <ListboxOption
                            key={o.id}
                            value={o.id}
                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 data-[focus]:bg-neutral-100 data-[selected]:font-medium"
                        >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle(o.color)} />
                            {o.label}
                        </ListboxOption>
                    ))}
                </ListboxOptions>
            </div>
        </Listbox>
    );
}
