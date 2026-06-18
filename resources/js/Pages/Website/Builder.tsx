import ColorPicker from '@/Components/ColorPicker';
import SiteShell from '@/Components/site/SiteShell';
import { addChildToGrid, BLOCK_LIBRARY, blockLabel, findBlock, makeBlock, moveBlockInTree, removeBlockFromTree, updateBlockInTree } from '@/Components/site/blocks';
import { BlockEditor, ImageField, NavEditor } from '@/Components/site/editors';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BlockSettings, BlogPostCard, PackageCard, PageProps, SiteBlock, SiteBlockType, SiteData, SiteNavItem, SitePageData, SiteTemplateMeta, SiteTheme } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

// Placeholder posts so the blog block shows something in the builder preview.
const SAMPLE_POSTS: BlogPostCard[] = [
    { title: 'A spring wedding at the coast', slug: 'sample-1', excerpt: 'A radiant day by the sea full of colour and joy.', cover_image: null, published_at: new Date().toISOString(), url: '#' },
    { title: 'Golden hour portraits', slug: 'sample-2', excerpt: 'Why the last hour of light is my favourite.', cover_image: null, published_at: new Date().toISOString(), url: '#' },
    { title: 'Behind the scenes', slug: 'sample-3', excerpt: 'A peek at how a shoot really comes together.', cover_image: null, published_at: new Date().toISOString(), url: '#' },
];

// Placeholder packages so the packages block shows something in the preview.
const SAMPLE_PACKAGES: PackageCard[] = [
    { slug: 'sample-1', name: 'Half-day shoot', description: 'Up to 4 hours of coverage and edited gallery.', image_url: null, price_cents: 80000, deposit_cents: 20000, currency: 'usd', url: '#' },
    { slug: 'sample-2', name: 'Full-day wedding', description: 'Full coverage from prep to first dance.', image_url: null, price_cents: 250000, deposit_cents: 50000, currency: 'usd', url: '#' },
    { slug: 'sample-3', name: 'Mini session', description: '30-minute portrait session.', image_url: null, price_cents: 15000, deposit_cents: null, currency: 'usd', url: '#' },
];

export default function Builder({
    site,
    templates,
    leads_count,
}: PageProps<{ site: SiteData; templates: SiteTemplateMeta[]; public_url: string; leads_count: number }>) {
    const [name, setName] = useState(site.name);
    const [slug, setSlug] = useState(site.slug);
    const [contactEmail, setContactEmail] = useState(site.contact_email ?? '');
    const [seoTitle, setSeoTitle] = useState(site.seo_title ?? '');
    const [seoDescription, setSeoDescription] = useState(site.seo_description ?? '');
    const [theme, setTheme] = useState<SiteTheme>(site.theme);
    const [headerNav, setHeaderNav] = useState<SiteNavItem[]>(site.header_nav ?? []);
    const [footerNav, setFooterNav] = useState<SiteNavItem[]>(site.footer_nav ?? []);
    const [pages, setPages] = useState<SitePageData[]>(site.pages);

    const [activePage, setActivePage] = useState(0);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isPublished, setIsPublished] = useState(site.is_published);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showAddBlock, setShowAddBlock] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'navigation' | 'theme' | 'general' | 'templates'>('navigation');

    const openSettings = () => { setSettingsOpen(true); setSelectedBlockId(null); };
    const selectBlock = (id: string | null) => { setSelectedBlockId(id); setSettingsOpen(false); };
    const goToPage = (i: number) => { setActivePage(i); setSelectedBlockId(null); setSettingsOpen(false); };

    const page = pages[activePage];
    const selectedBlock = page ? findBlock(page.blocks, selectedBlockId ?? '') : null;
    const publicUrl = `/site/${slug}`;

    // ── Block mutations (immutable, recursive — blocks may be nested in grids) ──
    const writeBlocks = (blocks: SiteBlock[]) =>
        setPages((prev) => prev.map((p, i) => (i === activePage ? { ...p, blocks } : p)));

    const updateBlock = (id: string, data: Record<string, unknown>) =>
        writeBlocks(updateBlockInTree(page.blocks, id, (b) => ({ ...b, data })));

    const updateSettings = (id: string, settings: BlockSettings) =>
        writeBlocks(updateBlockInTree(page.blocks, id, (b) => ({ ...b, settings })));

    const addBlock = (type: SiteBlockType) => {
        const block = makeBlock(type);
        writeBlocks([...page.blocks, block]);
        selectBlock(block.id);
        setShowAddBlock(false);
    };

    const addChild = (gridId: string, col: number, type: SiteBlockType) => {
        const block = makeBlock(type);
        writeBlocks(addChildToGrid(page.blocks, gridId, col, block));
        selectBlock(block.id);
    };

    const removeBlock = (id: string) => {
        writeBlocks(removeBlockFromTree(page.blocks, id));
        if (selectedBlockId === id) setSelectedBlockId(null);
    };

    const moveBlock = (id: string, dir: -1 | 1) => writeBlocks(moveBlockInTree(page.blocks, id, dir));

    // ── Page mutations ──
    const blogPageExists = pages.some((p) => p.is_blog && !p.is_post);

    const selectLast = () => { setActivePage(pages.length); setSelectedBlockId(null); setSettingsOpen(false); };

    const addPage = () => {
        const n = pages.filter((p) => !p.is_post).length + 1;
        const newPage: SitePageData = { title: `Page ${n}`, slug: `page-${n}`, is_home: false, is_blog: false, is_post: false, status: 'published', blocks: [] };
        setPages([...pages, newPage]);
        selectLast();
    };

    const addPost = () => {
        if (!blogPageExists) return;
        const newPost: SitePageData = {
            title: 'New post',
            slug: '',
            is_home: false,
            is_blog: false,
            is_post: true,
            status: 'draft',
            published_at: '',
            excerpt: '',
            cover_image: '',
            blocks: [makeBlock('hero'), makeBlock('text')],
        };
        setPages([...pages, newPost]);
        selectLast();
    };

    const updatePageMeta = (index: number, partial: Partial<SitePageData>) =>
        setPages((prev) => prev.map((p, i) => (i === index ? { ...p, ...partial } : p)));

    const removePage = (index: number) => {
        const target = pages[index];
        const topCount = pages.filter((p) => !p.is_post).length;
        if (!target.is_post && topCount === 1) return; // keep at least one page

        setPages((prev) => {
            const next = prev.filter((_, i) => i !== index);
            // Keep exactly one home page among top-level pages.
            if (!next.some((p) => p.is_home && !p.is_post)) {
                const firstTop = next.findIndex((p) => !p.is_post);
                if (firstTop >= 0) next[firstTop] = { ...next[firstTop], is_home: true };
            }
            return next;
        });
        setActivePage(0);
        setSelectedBlockId(null);
        setSettingsOpen(false);
    };

    const setHome = (index: number) =>
        setPages((prev) => prev.map((p, i) => ({ ...p, is_home: !p.is_post && i === index })));

    const setBlog = (index: number, value: boolean) => {
        if (!value && pages.some((p) => p.is_post)) {
            if (!window.confirm('Remove the blog designation? The posts under it will be deleted when you save.')) return;
        }
        setPages((prev) => prev.map((p, i) => {
            if (i === index) return { ...p, is_blog: value };
            return value ? { ...p, is_blog: false } : p;
        }));
    };

    // ── Persistence ──
    const save = () => {
        setSaving(true);
        setErrors({});
        router.put(
            route('website.update'),
            {
                name,
                slug,
                contact_email: contactEmail || null,
                seo_title: seoTitle || null,
                seo_description: seoDescription || null,
                theme,
                header_nav: headerNav,
                footer_nav: footerNav,
                pages,
            } as any,
            {
                preserveScroll: true,
                preserveState: true,
                onError: (e) => setErrors(e as Record<string, string>),
                onFinish: () => setSaving(false),
            },
        );
    };

    const togglePublish = () => {
        const next = !isPublished;
        router.post(route('website.publish'), { publish: next }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setIsPublished(next),
        });
    };

    const applyTemplate = (key: string) => {
        if (!window.confirm('Replace all pages and content with this template? This cannot be undone.')) return;
        router.post(route('website.template'), { template: key }, { onSuccess: () => location.reload() });
    };

    const pageRefs = pages.filter((p) => !p.is_post).map((p) => ({ title: p.title, slug: p.slug, is_home: p.is_home }));

    const blogPage = pages.find((p) => p.is_blog && !p.is_post);
    const previewPath = page?.is_post && blogPage
        ? `/site/${slug}/${blogPage.slug}/${page.slug}`
        : page?.is_home
            ? `/site/${slug}`
            : `/site/${slug}/${page?.slug ?? ''}`;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm font-semibold text-neutral-900">Website</h1>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {isPublished ? 'Published' : 'Draft'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={route('website.leads')} className="btn-secondary">
                            Leads{leads_count > 0 ? ` (${leads_count})` : ''}
                        </Link>
                        <button
                            onClick={openSettings}
                            className={`btn-secondary ${settingsOpen ? 'border-neutral-900 text-neutral-900' : ''}`}
                            title="Site settings"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                        </button>
                        {isPublished ? (
                            <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-secondary">View site</a>
                        ) : (
                            <button className="btn-secondary opacity-50" title="Publish to view the live site" disabled>View site</button>
                        )}
                        <button onClick={togglePublish} className="btn-secondary">{isPublished ? 'Unpublish' : 'Publish'}</button>
                        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </div>
            }
        >
            <Head title="Website builder" />

            <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
                {/* ── Left: pages + blocks ── */}
                <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white">
                    <div className="border-b border-neutral-100 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="label">Pages</span>
                            <button onClick={addPage} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">+ Add</button>
                        </div>
                        <div className="space-y-1">
                            {pages.map((p, i) => p.is_post ? null : (
                                <div key={i}>
                                    <button
                                        onClick={() => goToPage(i)}
                                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${i === activePage && !settingsOpen ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                    >
                                        <span className="truncate">{p.title}</span>
                                        <span className="ml-2 flex shrink-0 gap-1">
                                            {p.is_home && <span className={`text-[10px] uppercase tracking-wider ${i === activePage ? 'text-white/60' : 'text-neutral-400'}`}>Home</span>}
                                            {p.is_blog && <span className={`text-[10px] uppercase tracking-wider ${i === activePage ? 'text-white/60' : 'text-neutral-400'}`}>Blog</span>}
                                        </span>
                                    </button>

                                    {/* Blog posts nest under the blog page */}
                                    {p.is_blog && (
                                        <div className="mt-1 space-y-1 border-l border-neutral-200 pl-2">
                                            {pages.map((post, pi) => post.is_post ? (
                                                <button
                                                    key={pi}
                                                    onClick={() => goToPage(pi)}
                                                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition ${pi === activePage && !settingsOpen ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}
                                                >
                                                    <span className="truncate">{post.title || 'Untitled post'}</span>
                                                    {post.status === 'draft' && <span className={`ml-2 shrink-0 text-[10px] uppercase tracking-wider ${pi === activePage ? 'text-white/60' : 'text-amber-500'}`}>Draft</span>}
                                                </button>
                                            ) : null)}
                                            <button onClick={addPost} className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-blue-700 hover:bg-blue-50">+ Add post</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="label">Blocks</span>
                            <div className="relative">
                                <button onClick={() => setShowAddBlock((s) => !s)} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">+ Add block</button>
                                {showAddBlock && (
                                    <div className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                                        {BLOCK_LIBRARY.map((b) => (
                                            <button key={b.type} onClick={() => addBlock(b.type)} className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-neutral-50">
                                                <span className="block text-sm font-medium text-neutral-800">{b.label}</span>
                                                <span className="block text-xs text-neutral-400">{b.hint}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            {page?.blocks.map((b) => (
                                <div
                                    key={b.id}
                                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition ${b.id === selectedBlockId ? 'bg-blue-50 text-blue-800' : 'text-neutral-700 hover:bg-neutral-100'}`}
                                >
                                    <button onClick={() => selectBlock(b.id)} className="flex-1 truncate text-left">{blockLabel(b.type)}</button>
                                    <button onClick={() => moveBlock(b.id, -1)} className="opacity-0 group-hover:opacity-100" title="Move up">
                                        <svg className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                                    </button>
                                    <button onClick={() => moveBlock(b.id, 1)} className="opacity-0 group-hover:opacity-100" title="Move down">
                                        <svg className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                                    </button>
                                    <button onClick={() => removeBlock(b.id)} className="opacity-0 group-hover:opacity-100" title="Delete">
                                        <svg className="h-3.5 w-3.5 text-neutral-400 hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {page?.blocks.length === 0 && <p className="px-2 py-4 text-xs text-neutral-400">No blocks yet. Add one above.</p>}
                        </div>
                    </div>
                </aside>

                {/* ── Center: live preview ── */}
                <div className="flex min-w-0 flex-1 flex-col bg-neutral-100">
                    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2">
                        <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-neutral-200" /><span className="h-2.5 w-2.5 rounded-full bg-neutral-200" /><span className="h-2.5 w-2.5 rounded-full bg-neutral-200" /></div>
                        <div className="mx-auto truncate rounded-md bg-neutral-100 px-3 py-1 text-xs text-neutral-500">{previewPath}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="mx-auto my-4 max-w-5xl overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-neutral-950/5">
                            <SiteShell
                                siteName={name}
                                siteSlug={slug}
                                theme={theme}
                                pages={pageRefs}
                                headerNav={headerNav}
                                footerNav={footerNav}
                                blocks={page?.blocks ?? []}
                                activeSlug={page?.slug ?? ''}
                                interactive={false}
                                posts={SAMPLE_POSTS}
                                packages={SAMPLE_PACKAGES}
                                editing={{ selectedId: selectedBlockId, onSelect: selectBlock, onDelete: removeBlock, onAddChild: addChild }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Right: contextual panel (site settings / block / page) ── */}
                <aside className="w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
                    {settingsOpen ? (
                        <SiteSettings
                            {...{ name, setName, slug, setSlug, contactEmail, setContactEmail, seoTitle, setSeoTitle, seoDescription, setSeoDescription, theme, setTheme, errors, templates, applyTemplate }}
                            pageRefs={pageRefs}
                            headerNav={headerNav}
                            setHeaderNav={setHeaderNav}
                            footerNav={footerNav}
                            setFooterNav={setFooterNav}
                            tab={settingsTab}
                            setTab={setSettingsTab}
                            onClose={() => setSettingsOpen(false)}
                        />
                    ) : selectedBlock ? (
                        <div className="p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-neutral-900">{blockLabel(selectedBlock.type)} block</h2>
                                <button onClick={() => setSelectedBlockId(null)} className="text-xs text-neutral-400 hover:text-neutral-700">Done</button>
                            </div>
                            <BlockEditor block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} onSettings={(s) => updateSettings(selectedBlock.id, s)} />
                            <button onClick={() => removeBlock(selectedBlock.id)} className="mt-6 w-full rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">Delete block</button>
                        </div>
                    ) : (
                        <PagePanel page={page} activePage={activePage} pages={pages} updatePageMeta={updatePageMeta} setHome={setHome} setBlog={setBlog} removePage={removePage} onOpenSettings={openSettings} />
                    )}
                </aside>
            </div>
        </AuthenticatedLayout>
    );
}

// ─── Page panel (right panel when a page is selected) ─────────────────────────

function PagePanel({ page, activePage, pages, updatePageMeta, setHome, setBlog, removePage, onOpenSettings }: any) {
    if (!page) return null;

    const isPost = !!page.is_post;
    const topCount = pages.filter((p: SitePageData) => !p.is_post).length;
    const set = (partial: Partial<SitePageData>) => updatePageMeta(activePage, partial);

    return (
        <div className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">{isPost ? 'Post settings' : 'Page settings'}</h2>
            <div className="space-y-3">
                <label className="block">
                    <span className="label mb-1.5 block">Title</span>
                    <input className="input" value={page.title} onChange={(e) => set({ title: e.target.value })} />
                </label>
                <label className="block">
                    <span className="label mb-1.5 block">URL slug</span>
                    <input className="input" value={page.slug} placeholder={isPost ? 'auto from title' : ''} onChange={(e) => set({ slug: e.target.value })} />
                </label>

                {isPost ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="label mb-1.5 block">Status</span>
                                <select className="input" value={page.status ?? 'draft'} onChange={(e) => set({ status: e.target.value as SitePageData['status'] })}>
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                </select>
                            </label>
                            <label className="block">
                                <span className="label mb-1.5 block">Publish date</span>
                                <input type="date" className="input" value={page.published_at ?? ''} onChange={(e) => set({ published_at: e.target.value })} />
                            </label>
                        </div>
                        <label className="block">
                            <span className="label mb-1.5 block">Excerpt</span>
                            <textarea className="input" rows={2} value={page.excerpt ?? ''} onChange={(e) => set({ excerpt: e.target.value })} placeholder="Short summary shown in post listings" />
                        </label>
                        <ImageField label="Cover image" value={page.cover_image ?? ''} onChange={(v) => set({ cover_image: v })} />
                        <div className="pt-1">
                            <button onClick={() => removePage(activePage)} className="text-xs text-red-600 hover:underline">Delete post</button>
                        </div>
                    </>
                ) : (
                    <>
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input type="radio" checked={page.is_home} onChange={() => setHome(activePage)} /> Home page
                        </label>
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input type="checkbox" checked={!!page.is_blog} onChange={(e) => setBlog(activePage, e.target.checked)} /> Blog page <span className="text-xs text-neutral-400">(posts live here)</span>
                        </label>
                        {topCount > 1 && (
                            <div className="pt-1">
                                <button onClick={() => removePage(activePage)} className="text-xs text-red-600 hover:underline">Delete page</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="mt-6 border-t border-neutral-100 pt-4">
                <button onClick={onOpenSettings} className="text-xs font-medium text-blue-700 hover:underline">
                    Site settings (menus, theme, domain) →
                </button>
            </div>
        </div>
    );
}

// ─── Site settings (general settings page, opened via the Settings button) ────

const SETTINGS_TABS: { key: 'navigation' | 'theme' | 'general' | 'templates'; label: string }[] = [
    { key: 'navigation', label: 'Menus' },
    { key: 'theme', label: 'Theme' },
    { key: 'general', label: 'General' },
    { key: 'templates', label: 'Templates' },
];

function SiteSettings(props: any) {
    const { name, setName, slug, setSlug, contactEmail, setContactEmail, seoTitle, setSeoTitle, seoDescription, setSeoDescription, theme, setTheme, errors, templates, applyTemplate, pageRefs, headerNav, setHeaderNav, footerNav, setFooterNav, tab, setTab, onClose } = props;

    return (
        <div>
            <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
                <div className="flex items-center justify-between px-4 pt-4">
                    <h2 className="text-sm font-semibold text-neutral-900">Site settings</h2>
                    <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-700">Done</button>
                </div>
                <div className="mt-3 flex gap-1 px-2">
                    {SETTINGS_TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`relative -mb-px border-b-2 px-2.5 py-2 text-xs font-medium transition ${tab === t.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4">
                {tab === 'navigation' && (
                    <div>
                        <h3 className="mb-1 text-sm font-semibold text-neutral-900">Header menu</h3>
                        <p className="mb-3 text-xs text-neutral-500">Links shown in the site header. Leave empty to list all pages automatically.</p>
                        <NavEditor items={headerNav} pages={pageRefs} onChange={setHeaderNav} />
                        <h3 className="mb-3 mt-6 text-sm font-semibold text-neutral-900">Footer menu</h3>
                        <NavEditor items={footerNav} pages={pageRefs} onChange={setFooterNav} />
                    </div>
                )}

                {tab === 'theme' && (
                    <div className="space-y-3">
                        <div>
                            <span className="label mb-1.5 block">Accent colour</span>
                            <ColorPicker value={theme.primary_color} onChange={(c) => setTheme({ ...theme, primary_color: c })} />
                        </div>
                        <label className="block">
                            <span className="label mb-1.5 block">Font</span>
                            <select className="input" value={theme.font} onChange={(e) => setTheme({ ...theme, font: e.target.value })}>
                                <option value="sans">Sans-serif (modern)</option>
                                <option value="serif">Serif (classic)</option>
                            </select>
                        </label>
                    </div>
                )}

                {tab === 'general' && (
                    <div className="space-y-3">
                        <label className="block">
                            <span className="label mb-1.5 block">Site name</span>
                            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Web address</span>
                            <div className="flex items-center gap-1 text-sm">
                                <span className="text-neutral-400">/site/</span>
                                <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
                            </div>
                            {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
                        </label>
                        <label className="block">
                            <span className="label mb-1.5 block">Contact email</span>
                            <input className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@studio.com" />
                        </label>
                        <div className="mt-2 border-t border-neutral-100 pt-3">
                            <span className="label mb-1.5 block">SEO meta title</span>
                            <input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                        </div>
                        <label className="block">
                            <span className="label mb-1.5 block">SEO meta description</span>
                            <textarea className="input" rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
                        </label>
                    </div>
                )}

                {tab === 'templates' && (
                    <div className="space-y-2">
                        {templates.map((t: SiteTemplateMeta) => (
                            <div key={t.key} className="rounded-lg border border-neutral-200 p-3">
                                <p className="text-sm font-medium text-neutral-800">{t.name}</p>
                                <p className="mt-0.5 text-xs text-neutral-500">{t.description}</p>
                                <button onClick={() => applyTemplate(t.key)} className="btn-secondary mt-2 w-full justify-center py-1.5 text-xs">Apply template</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
