import {
    Combobox,
    ComboboxButton,
    ComboboxInput,
    ComboboxOption,
    ComboboxOptions,
} from '@headlessui/react';
import { useState } from 'react';

export interface SearchOption {
    id: number;
    name: string;
}

/** Generic searchable single-select (typeahead). Options are { id, name }. */
export default function SearchSelect({
    options,
    value,
    onChange,
    placeholder = 'Search…',
    emptyText = 'No results',
}: {
    options: SearchOption[];
    value: number | null;
    onChange: (id: number | null) => void;
    placeholder?: string;
    emptyText?: string;
}) {
    const [query, setQuery] = useState('');
    const selected = options.find((o) => o.id === value) ?? null;

    const filtered =
        query.trim() === ''
            ? options
            : options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

    return (
        <Combobox value={selected} onChange={(o: SearchOption | null) => onChange(o?.id ?? null)} immediate>
            <div className="relative">
                <ComboboxInput
                    className="input w-full pr-9"
                    placeholder={placeholder}
                    autoComplete="off"
                    displayValue={(o: SearchOption | null) => o?.name ?? ''}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-neutral-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                </ComboboxButton>
                <ComboboxOptions
                    anchor="bottom start"
                    className="z-50 max-h-56 w-[var(--input-width)] overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg [--anchor-gap:4px] focus:outline-none"
                >
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-neutral-400">{emptyText}</div>
                    ) : (
                        filtered.map((o) => (
                            <ComboboxOption
                                key={o.id}
                                value={o}
                                className="cursor-pointer px-3 py-2 text-sm text-neutral-700 data-[focus]:bg-neutral-100 data-[selected]:font-medium"
                            >
                                {o.name}
                            </ComboboxOption>
                        ))
                    )}
                </ComboboxOptions>
            </div>
        </Combobox>
    );
}
