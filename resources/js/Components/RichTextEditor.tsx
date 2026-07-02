import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';

interface Token {
    label: string;
    token: string;
}

function Btn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            title={title}
            className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm transition ${active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
        >
            {children}
        </button>
    );
}

export default function RichTextEditor({
    value,
    onChange,
    tokens = [],
    minHeightClass = 'min-h-[18rem]',
}: {
    value: string;
    onChange: (html: string) => void;
    tokens?: Token[];
    minHeightClass?: string;
}) {
    const [tokOpen, setTokOpen] = useState(false);
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || '',
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: { attributes: { class: `${minHeightClass} focus:outline-none` } },
    });

    // Sync external value changes (e.g. loading a template) without clobbering typing.
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '', { emitUpdate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    if (!editor) return null;

    const insert = (token: string) => {
        editor.chain().focus().insertContent(`{{${token}}}`).run();
        setTokOpen(false);
    };

    return (
        <div className="rounded-lg border border-neutral-300">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 p-1.5">
                <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><span className="font-bold">B</span></Btn>
                <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><span className="italic">I</span></Btn>
                <span className="mx-1 h-5 w-px bg-neutral-200" />
                <Btn title="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
                <Btn title="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
                <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
                <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
                <span className="mx-1 h-5 w-px bg-neutral-200" />
                <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
                <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}>↷</Btn>

                {tokens.length > 0 && (
                    <div className="relative ml-auto">
                        <button type="button" onClick={() => setTokOpen((v) => !v)} className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-300">
                            Insert field ▾
                        </button>
                        {tokOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setTokOpen(false)} />
                                <div className="absolute right-0 top-8 z-20 max-h-56 w-56 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                                    {tokens.map((t) => (
                                        <button key={t.token} type="button" onClick={() => insert(t.token)} className="block w-full px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100">
                                            {t.label} <span className="text-neutral-400">{`{{${t.token}}}`}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            <EditorContent
                editor={editor}
                className="px-3 py-2 text-sm leading-relaxed [&_h1]:my-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-1.5 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
            />
        </div>
    );
}
