import { lazy, Suspense } from 'react';

// tiptap is ~420 KiB (raw). Load it only when an editor actually renders, so it
// never bloats the initial bundle of pages that merely *contain* a rich-text
// field (website builder, contracts, templates).
const Editor = lazy(() => import('./RichTextEditor'));

interface Props {
    value: string;
    onChange: (html: string) => void;
    tokens?: { label: string; token: string }[];
    minHeightClass?: string;
}

export default function LazyRichTextEditor(props: Props) {
    return (
        <Suspense
            fallback={
                <div className={`animate-pulse rounded-lg border border-neutral-300 bg-neutral-50 ${props.minHeightClass ?? 'min-h-[18rem]'}`} />
            }
        >
            <Editor {...props} />
        </Suspense>
    );
}
