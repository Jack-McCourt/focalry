import ColorPicker from '@/Components/ColorPicker';
import Modal from '@/Components/Modal';
import SiteShell from '@/Components/site/SiteShell';
import { addChildToGrid, blockLabel, cloneBlock, findBlock, makeBlock, moveBlockInTree, removeBlockFromTree, reorderTopLevel, updateBlockInTree } from '@/Components/site/blocks';
import { BlockEditor, HeroDesignFields, ImageField, NavEditor } from '@/Components/site/editors';
import BlockPicker from '@/Components/site/BlockPicker';
import PostHeader from '@/Components/site/PostHeader';
import GoogleReviewsModal from '@/Components/site/GoogleReviewsModal';
import PreviewFrame from '@/Components/site/PreviewFrame';
import { SITE_FONTS } from '@/lib/siteFonts';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BlockSettings, BlogPostCard, PackageCard, PageProps, SiteBlock, SiteBlockType, SiteCategory, SiteData, SiteNavItem, SitePageData, SiteTemplateMeta, SiteTheme } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Placeholder posts so the blog block shows something in the builder preview.
const SAMPLE_POSTS: BlogPostCard[] = [
    { title: 'A spring wedding at the coast', slug: 'sample-1', excerpt: 'A radiant day by the sea full of colour and joy.', categories: [{ id: -1, name: 'Weddings', slug: 'weddings', parent_id: null }], cover_image: null, published_at: new Date().toISOString(), url: '#' },
    { title: 'Golden hour portraits', slug: 'sample-2', excerpt: 'Why the last hour of light is my favourite.', categories: [{ id: -2, name: 'Portraits', slug: 'portraits', parent_id: null }], cover_image: null, published_at: new Date().toISOString(), url: '#' },
    { title: 'Behind the scenes', slug: 'sample-3', excerpt: 'A peek at how a shoot really comes together.', categories: [{ id: -3, name: 'Tips', slug: 'tips', parent_id: null }], cover_image: null, published_at: new Date().toISOString(), url: '#' },
];

// Placeholder packages so the packages block shows something in the preview.
const SAMPLE_PACKAGES: PackageCard[] = [
    { slug: 'sample-1', name: 'Half-day shoot', description: 'Up to 4 hours of coverage and edited gallery.', image_url: null, price_cents: 80000, deposit_cents: 20000, currency: 'gbp', url: '#' },
    { slug: 'sample-2', name: 'Full-day wedding', description: 'Full coverage from prep to first dance.', image_url: null, price_cents: 250000, deposit_cents: 50000, currency: 'gbp', url: '#' },
    { slug: 'sample-3', name: 'Mini session', description: '30-minute portrait session.', image_url: null, price_cents: 15000, deposit_cents: null, currency: 'gbp', url: '#' },
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
    const [faviconUrl, setFaviconUrl] = useState(site.favicon_url ?? '');
    const [ogImageUrl, setOgImageUrl] = useState(site.og_image_url ?? '');
    const [redirects, setRedirects] = useState<{ from: string; to: string }[]>(site.redirects ?? []);
    const [savedSections, setSavedSections] = useState<{ id: string; name: string; block: SiteBlock }[]>(site.saved_sections ?? []);
    const [theme, setTheme] = useState<SiteTheme>(site.theme);
    const [headerNav, setHeaderNav] = useState<SiteNavItem[]>(site.header_nav ?? []);
    const [footerNav, setFooterNav] = useState<SiteNavItem[]>(site.footer_nav ?? []);
    const [headCode, setHeadCode] = useState(site.head_code ?? '');
    const [bodyCode, setBodyCode] = useState(site.body_code ?? '');
    const [cookieConsent, setCookieConsent] = useState(!!site.cookie_consent);
    const [cookieMessage, setCookieMessage] = useState(site.cookie_message ?? '');
    const [cookiePolicyUrl, setCookiePolicyUrl] = useState(site.cookie_policy_url ?? '');
    const [pages, setPages] = useState<SitePageData[]>(site.pages);
    // Blog categories are managed over ajax (not part of the page save payload) so
    // adding/renaming/deleting one never clobbers unsaved page edits — like WP.
    const [categories, setCategories] = useState<SiteCategory[]>(site.categories ?? []);
    const [categoryBusy, setCategoryBusy] = useState(false);

    const createCategory = async (name: string, parentId: number | null): Promise<SiteCategory | null> => {
        setCategoryBusy(true);
        try {
            const before = categories.map((c) => c.id);
            const { data } = await (window as any).axios.post(route('website.categories.store'), { name, parent_id: parentId });
            setCategories(data.categories);
            // Return the newly created category so the caller can tick it on the post.
            return (data.categories as SiteCategory[]).find((c) => !before.includes(c.id)) ?? null;
        } finally {
            setCategoryBusy(false);
        }
    };
    const renameCategory = async (id: number, name: string, parentId: number | null) => {
        setCategoryBusy(true);
        try {
            const { data } = await (window as any).axios.patch(route('website.categories.update', id), { name, parent_id: parentId });
            setCategories(data.categories);
        } finally {
            setCategoryBusy(false);
        }
    };
    const deleteCategory = async (id: number) => {
        setCategoryBusy(true);
        try {
            const { data } = await (window as any).axios.delete(route('website.categories.destroy', id));
            setCategories(data.categories);
        } finally {
            setCategoryBusy(false);
        }
    };

    const [activePage, setActivePage] = useState(0);
    const [postListPage, setPostListPage] = useState(1);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isPublished, setIsPublished] = useState(site.is_published);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showAddBlock, setShowAddBlock] = useState(false);
    const [configureBlockId, setConfigureBlockId] = useState<string | null>(null);
    const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    // The contextual editor (block editor / page settings) opens as an overlay over
    // the left sidebar rather than a permanent right-hand column.
    const [showPageSettings, setShowPageSettings] = useState(false);

    const selectBlock = (id: string | null) => { setSelectedBlockId(id); setShowPageSettings(false); };
    const goToPage = (i: number) => { setActivePage(i); setSelectedBlockId(null); setShowPageSettings(false); };
    const openPageSettings = (i: number) => { setActivePage(i); setSelectedBlockId(null); setShowPageSettings(true); };
    const closePanel = () => { setSelectedBlockId(null); setShowPageSettings(false); };

    const page = pages[activePage];
    const selectedBlock = page ? findBlock(page.blocks, selectedBlockId ?? '') : null;
    const configureBlock = page && configureBlockId ? findBlock(page.blocks, configureBlockId) : null;
    const publicUrl = `/site/${slug}`;

    // ── Block mutations (immutable, recursive — blocks may be nested in grids) ──
    const writeBlocks = (blocks: SiteBlock[]) =>
        setPages((prev) => prev.map((p, i) => (i === activePage ? { ...p, blocks } : p)));

    const updateBlock = (id: string, data: Record<string, unknown>) =>
        writeBlocks(updateBlockInTree(page.blocks, id, (b) => ({ ...b, data })));

    const updateSettings = (id: string, settings: BlockSettings) =>
        writeBlocks(updateBlockInTree(page.blocks, id, (b) => ({ ...b, settings })));

    const toggleBlockHidden = (id: string) =>
        writeBlocks(updateBlockInTree(page.blocks, id, (b) => ({ ...b, hidden: !b.hidden })));

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

    const duplicateBlock = (id: string) => {
        const idx = page.blocks.findIndex((b) => b.id === id);
        if (idx === -1) return; // only top-level blocks are duplicatable from the list
        const copy = cloneBlock(page.blocks[idx]);
        const next = [...page.blocks];
        next.splice(idx + 1, 0, copy);
        writeBlocks(next);
        selectBlock(copy.id);
    };

    const saveAsSection = (id: string) => {
        const block = findBlock(page.blocks, id);
        if (!block) return;
        const name = window.prompt('Name this reusable section', blockLabel(block.type));
        if (!name) return;
        const sectionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s_${Date.now()}`;
        setSavedSections((prev) => [...prev, { id: sectionId, name, block: cloneBlock(block) }]);
    };

    const insertSection = (sectionId: string) => {
        const section = savedSections.find((s) => s.id === sectionId);
        if (!section) return;
        const block = cloneBlock(section.block);
        writeBlocks([...page.blocks, block]);
        selectBlock(block.id);
        setShowAddBlock(false);
    };

    const deleteSection = (sectionId: string) => setSavedSections((prev) => prev.filter((s) => s.id !== sectionId));

    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const dropBlock = (to: number) => {
        if (dragIndex === null) return;
        writeBlocks(reorderTopLevel(page.blocks, dragIndex, to));
        setDragIndex(null);
    };

    // ── Page mutations ──
    const blogPageExists = pages.some((p) => p.is_blog && !p.is_post);

    const selectLast = () => { setActivePage(pages.length); setSelectedBlockId(null); };

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
            // Default the post date to today (local), in the Y-m-d the date input expects.
            published_at: new Date().toLocaleDateString('en-CA'),
            excerpt: '',
            cover_image: '',
            // The post hero (cover image + title + date/categories) is rendered
            // automatically by PostHeader, so a new post only needs body content.
            blocks: [makeBlock('text')],
        };
        setPages([...pages, newPost]);
        setPostListPage(1);
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
    };

    const duplicatePage = (index: number) => {
        const src = pages[index];
        const n = pages.filter((p) => !p.is_post).length + 1;
        const copy: SitePageData = {
            ...src,
            id: undefined,
            is_home: false,
            title: `${src.title} copy`,
            slug: src.is_post ? '' : `${src.slug || 'page'}-${n}`,
            status: src.is_post ? 'draft' : src.status,
            blocks: src.blocks.map((b) => cloneBlock(b)),
        };
        setPages((prev) => {
            const next = [...prev];
            next.splice(index + 1, 0, copy);
            return next;
        });
    };

    const setHome = (index: number) =>
        setPages((prev) => prev.map((p, i) => ({ ...p, is_home: !p.is_post && i === index })));

    const set404 = (index: number, value: boolean) =>
        setPages((prev) => prev.map((p, i) => {
            if (i === index) return { ...p, is_404: value };
            return value ? { ...p, is_404: false } : p; // only one 404 page
        }));

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
    // A stable snapshot of everything that gets saved — drives the
    // "saved/unsaved" indicator. Saving is manual (no autosave).
    const snapshot = JSON.stringify({ name, slug, contactEmail, seoTitle, seoDescription, faviconUrl, ogImageUrl, redirects, savedSections, theme, headerNav, footerNav, headCode, bodyCode, cookieConsent, cookieMessage, cookiePolicyUrl, pages });
    const savedSnapshotRef = useRef(snapshot);
    const dirty = snapshot !== savedSnapshotRef.current;

    // Set synchronously when our own save visit is in flight, so the unsaved-changes
    // navigation guard below doesn't prompt on the save request itself.
    const savingRef = useRef(false);

    const save = () => {
        const saving = snapshot;
        savingRef.current = true;
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
                favicon_url: faviconUrl || null,
                og_image_url: ogImageUrl || null,
                redirects,
                saved_sections: savedSections,
                theme,
                header_nav: headerNav,
                footer_nav: footerNav,
                head_code: headCode || null,
                body_code: bodyCode || null,
                cookie_consent: cookieConsent,
                cookie_message: cookieMessage || null,
                cookie_policy_url: cookiePolicyUrl || null,
                pages,
            } as any,
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => { savedSnapshotRef.current = saving; },
                onError: (e) => setErrors(e as Record<string, string>),
                onFinish: () => { setSaving(false); savingRef.current = false; },
            },
        );
    };

    // Saving is manual (the Save button) so edits never go live until the user is
    // ready. Warn before leaving with unsaved changes so work isn't lost.
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        // In-app (Inertia) navigation — e.g. clicking Settings or another pillar —
        // doesn't fire beforeunload, so confirm before discarding edits.
        const off = router.on('before', (event) => {
            // Don't prompt on our own save request (it preserves state, no visit).
            if (savingRef.current) return;
            if (!window.confirm('You have unsaved changes. Leave without saving?')) {
                event.preventDefault();
            }
        });
        return () => { window.removeEventListener('beforeunload', onBeforeUnload); off(); };
    }, [dirty]);

    // ── Undo / redo (history of the page tree) ──
    const undoStack = useRef<SitePageData[][]>([]);
    const redoStack = useRef<SitePageData[][]>([]);
    const lastPages = useRef<SitePageData[]>(pages);
    const restoring = useRef(false);

    useEffect(() => {
        if (restoring.current) { restoring.current = false; lastPages.current = pages; return; }
        if (lastPages.current !== pages) {
            undoStack.current.push(lastPages.current);
            if (undoStack.current.length > 60) undoStack.current.shift();
            redoStack.current = [];
            lastPages.current = pages;
        }
    }, [pages]);

    const restorePages = (next: SitePageData[]) => {
        restoring.current = true;
        setPages(next);
        setSelectedBlockId(null);
        setActivePage((a) => Math.min(a, next.length - 1));
    };
    const undo = () => {
        if (undoStack.current.length === 0) return;
        redoStack.current.push(lastPages.current);
        restorePages(undoStack.current.pop()!);
    };
    const redo = () => {
        if (redoStack.current.length === 0) return;
        undoStack.current.push(lastPages.current);
        restorePages(redoStack.current.pop()!);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
            const el = e.target as HTMLElement;
            if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return; // let fields handle their own undo
            e.preventDefault();
            e.shiftKey ? redo() : undo();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const togglePublish = () => {
        const next = !isPublished;
        router.post(route('website.publish'), { publish: next }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setIsPublished(next),
        });
    };

    const applyTemplate = (key: string, replace = false) => {
        const msg = replace
            ? 'Replace all pages and content with this template’s sample pages? This cannot be undone.'
            : 'Apply this template’s colours & fonts? Your pages and content are kept.';
        if (!window.confirm(msg)) return;
        router.post(route('website.template'), { template: key, replace }, { onSuccess: () => location.reload() });
    };

    const pageRefs = pages.filter((p) => !p.is_post).map((p) => ({ title: p.title, slug: p.slug, is_home: p.is_home }));

    const blogPage = pages.find((p) => p.is_blog && !p.is_post);

    // Real published posts for the blog grid preview (newest first), so the blog
    // page shows the studio's actual posts rather than placeholder samples. Falls
    // back to samples only when there are no published posts yet.
    const realPosts: BlogPostCard[] = pages
        .filter((p) => p.is_post && (p.status ?? 'published') === 'published')
        .sort((a, b) => (b.published_at ? new Date(b.published_at).getTime() : Number.MAX_SAFE_INTEGER) - (a.published_at ? new Date(a.published_at).getTime() : Number.MAX_SAFE_INTEGER))
        .map((p) => ({
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt ?? '',
            categories: (p.category_ids ?? []).map((id) => categories.find((c) => c.id === id)).filter((c): c is SiteCategory => !!c),
            cover_image: p.cover_image ?? null,
            published_at: p.published_at ?? null,
            url: blogPage ? `/site/${slug}/${blogPage.slug}/${p.slug}` : '#',
        }));
    const previewPosts = realPosts.length ? realPosts : SAMPLE_POSTS;

    const previewPath = page?.is_post && blogPage
        ? `/site/${slug}/${blogPage.slug}/${page.slug}`
        : page?.is_home
            ? `/site/${slug}`
            : `/site/${slug}/${page?.slug ?? ''}`;

    // ── The builder's control panel, rendered inside the app's black sidebar
    // (passed via the `sidebar` slot). Pages + blocks list is dark-themed to sit
    // on the sidebar; the contextual editor overlays it on a white surface. ──
    const builderSidebar = (
        <>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="border-b border-white/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pages</span>
                    <button onClick={addPage} className="text-xs font-medium text-zinc-400 hover:text-white">+ Add</button>
                </div>
                <div className="space-y-1">
                    {pages.map((p, i) => p.is_post ? null : (
                        <div key={i}>
                            <div className={`group flex items-center rounded-md transition ${i === activePage ? 'bg-white/15 text-white' : 'text-zinc-300 hover:bg-white/5'}`}>
                                <button onClick={() => goToPage(i)} className="flex min-w-0 flex-1 items-center justify-between px-2.5 py-1.5 text-left text-sm">
                                    <span className="truncate">{p.title}</span>
                                    <span className="ml-2 flex shrink-0 gap-1">
                                        {p.is_home && <span className="text-[10px] uppercase tracking-wider text-zinc-500">Home</span>}
                                        {p.is_blog && <span className="text-[10px] uppercase tracking-wider text-zinc-500">Blog</span>}
                                    </span>
                                </button>
                                <button onClick={() => openPageSettings(i)} title="Page settings" className={`shrink-0 px-2 py-1.5 transition ${i === activePage ? 'text-white/70 hover:text-white' : 'text-zinc-500 opacity-0 hover:text-white group-hover:opacity-100'}`}>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.241.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </button>
                            </div>

                            {/* Blog posts nest under the blog page (paginated) */}
                            {p.is_blog && (() => {
                                const POSTS_PER_PAGE = 10;
                                // Newest first: published posts by date desc, with
                                // drafts / just-created posts (no date) pinned to the top.
                                const sortKey = (post: SitePageData) => (post.published_at ? new Date(post.published_at).getTime() : Number.POSITIVE_INFINITY);
                                const postEntries = pages
                                    .map((post, pi) => ({ post, pi }))
                                    .filter((e) => e.post.is_post)
                                    .sort((a, b) => {
                                        const ka = sortKey(a.post), kb = sortKey(b.post);
                                        return ka !== kb ? kb - ka : b.pi - a.pi;
                                    });
                                const pageCount = Math.max(1, Math.ceil(postEntries.length / POSTS_PER_PAGE));
                                const cur = Math.min(postListPage, pageCount);
                                const slice = postEntries.slice((cur - 1) * POSTS_PER_PAGE, cur * POSTS_PER_PAGE);
                                return (
                                    <div className="mt-1 space-y-1 border-l border-white/10 pl-2">
                                        {slice.map(({ post, pi }) => (
                                            <div key={pi} className={`group flex items-center rounded-md transition ${pi === activePage ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/5'}`}>
                                                <button onClick={() => goToPage(pi)} className="flex min-w-0 flex-1 items-center justify-between px-2.5 py-1.5 text-left text-xs">
                                                    <span className="truncate">{post.title || 'Untitled post'}</span>
                                                    {post.status === 'draft' && <span className={`ml-2 shrink-0 text-[10px] uppercase tracking-wider ${pi === activePage ? 'text-white/60' : 'text-amber-400'}`}>Draft</span>}
                                                </button>
                                                <button onClick={() => openPageSettings(pi)} title="Post settings" className={`shrink-0 px-2 py-1.5 transition ${pi === activePage ? 'text-white/70 hover:text-white' : 'text-zinc-500 opacity-0 hover:text-white group-hover:opacity-100'}`}>
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.241.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                        {pageCount > 1 && (
                                            <div className="flex items-center justify-between px-2.5 py-1 text-[10px] text-zinc-500">
                                                <button type="button" disabled={cur <= 1} onClick={() => setPostListPage(cur - 1)} className="font-medium enabled:hover:text-white disabled:opacity-30">‹ Prev</button>
                                                <span>{cur} / {pageCount}</span>
                                                <button type="button" disabled={cur >= pageCount} onClick={() => setPostListPage(cur + 1)} className="font-medium enabled:hover:text-white disabled:opacity-30">Next ›</button>
                                            </div>
                                        )}
                                        <button onClick={addPost} className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-blue-400 hover:bg-white/5">+ Add post</button>
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Blocks</span>
                    <button onClick={() => setShowAddBlock(true)} className="text-xs font-medium text-zinc-400 hover:text-white">+ Add block</button>
                </div>

                <div className="space-y-1">
                    {page?.blocks.map((b, i) => (
                        <div
                            key={b.id}
                            draggable
                            onDragStart={() => setDragIndex(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => dropBlock(i)}
                            onDragEnd={() => setDragIndex(null)}
                            className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition ${b.id === selectedBlockId ? 'bg-blue-500/20 text-blue-200' : 'text-zinc-300 hover:bg-white/5'} ${dragIndex === i ? 'opacity-40' : ''}`}
                        >
                            <span className="cursor-grab text-zinc-600 group-hover:text-zinc-400" title="Drag to reorder">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a1 1 0 110-2 1 1 0 010 2zM7 11a1 1 0 110-2 1 1 0 010 2zM7 18a1 1 0 110-2 1 1 0 010 2zM13 4a1 1 0 110-2 1 1 0 010 2zM13 11a1 1 0 110-2 1 1 0 010 2zM13 18a1 1 0 110-2 1 1 0 010 2z" /></svg>
                            </span>
                            <button onClick={() => selectBlock(b.id)} className={`flex-1 truncate text-left ${b.hidden ? 'text-zinc-500 line-through' : ''}`}>{blockLabel(b.type)}</button>
                            <button onClick={() => toggleBlockHidden(b.id)} className={b.hidden ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 opacity-0 hover:text-white group-hover:opacity-100'} title={b.hidden ? 'Show block' : 'Hide block'}>
                                {b.hidden ? (
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" /></svg>
                                ) : (
                                    <svg className="h-3.5 w-3.5 text-zinc-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                )}
                            </button>
                            <button onClick={() => duplicateBlock(b.id)} className="opacity-0 group-hover:opacity-100" title="Duplicate">
                                <svg className="h-3.5 w-3.5 text-zinc-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V9.375c0-.621.504-1.125 1.125-1.125H6.75M15.75 17.25h3.375c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125h-9.75A1.125 1.125 0 008.25 5.625v3.375" /></svg>
                            </button>
                            <button onClick={() => moveBlock(b.id, -1)} className="opacity-0 group-hover:opacity-100" title="Move up">
                                <svg className="h-3.5 w-3.5 text-zinc-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                            </button>
                            <button onClick={() => moveBlock(b.id, 1)} className="opacity-0 group-hover:opacity-100" title="Move down">
                                <svg className="h-3.5 w-3.5 text-zinc-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                            </button>
                            <button onClick={() => removeBlock(b.id)} className="opacity-0 group-hover:opacity-100" title="Delete">
                                <svg className="h-3.5 w-3.5 text-zinc-500 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    ))}
                    {page?.blocks.length === 0 && <p className="px-2 py-4 text-xs text-zinc-500">No blocks yet. Add one above.</p>}
                </div>
            </div>
          </div>

          {/* Page/post settings — slides over the sidebar. Block editing opens in a
              modal instead (see below), so this overlay only handles page settings. */}
          {showPageSettings && (
            <div className="absolute inset-0 z-20 flex flex-col bg-white">
                <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-200 px-3 py-2.5">
                    <button onClick={closePanel} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        Back
                    </button>
                    <span className="ml-0.5 truncate text-sm font-semibold text-neutral-900">{page?.is_post ? 'Post settings' : 'Page settings'}</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <PagePanel page={page} activePage={activePage} pages={pages} updatePageMeta={updatePageMeta} setHome={setHome} setBlog={setBlog} set404={set404} removePage={removePage} duplicatePage={duplicatePage} categories={categories} categoryBusy={categoryBusy} createCategory={createCategory} renameCategory={renameCategory} deleteCategory={deleteCategory} />
                </div>
            </div>
          )}
        </>
    );

    return (
        <AuthenticatedLayout
            sidebar={builderSidebar}
            header={
                <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm font-semibold text-neutral-900">Website</h1>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {isPublished ? 'Published' : 'Draft'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="mr-1 flex items-center gap-0.5">
                            <button onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo" className="rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                            </button>
                            <button onClick={redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className="rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>
                            </button>
                        </div>
                        <span className="text-xs text-neutral-400">{saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}</span>
                        <Link href={route('website.settings')} className="btn-secondary">Settings</Link>
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
                {/* ── Center: live preview ── */}
                <div className="flex min-w-0 flex-1 flex-col bg-neutral-100">
                    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2">
                        <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-neutral-200" /><span className="h-2.5 w-2.5 rounded-full bg-neutral-200" /><span className="h-2.5 w-2.5 rounded-full bg-neutral-200" /></div>
                        <div className="mx-auto truncate rounded-md bg-neutral-100 px-3 py-1 text-xs text-neutral-500">{previewPath}</div>
                        <div className="flex items-center gap-0.5 rounded-md bg-neutral-100 p-0.5">
                            {([['desktop', 'M2.25 12.75V6A2.25 2.25 0 014.5 3.75h15A2.25 2.25 0 0121.75 6v6.75m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0h19.5M8.25 20.25h7.5'], ['tablet', 'M10.5 19.5h3M6.75 21.75h10.5a1.5 1.5 0 001.5-1.5V3.75a1.5 1.5 0 00-1.5-1.5H6.75a1.5 1.5 0 00-1.5 1.5v16.5a1.5 1.5 0 001.5 1.5z'], ['mobile', 'M10.5 18.75h3M8.25 21.75h7.5a1.5 1.5 0 001.5-1.5V3.75a1.5 1.5 0 00-1.5-1.5h-7.5a1.5 1.5 0 00-1.5 1.5v16.5a1.5 1.5 0 001.5 1.5z']] as const).map(([d, path]) => (
                                <button key={d} onClick={() => setDevice(d)} title={d} aria-label={d} className={`rounded p-1.5 transition ${device === d ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-700'}`}>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden p-4">
                        <div className={`mx-auto h-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-neutral-950/5 transition-all ${device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[834px]' : 'max-w-none'}`}>
                            <PreviewFrame>
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
                                    posts={previewPosts}
                                    categories={realPosts.length ? categories : undefined}
                                    packages={SAMPLE_PACKAGES}
                                    postHeader={page?.is_post ? (
                                        <PostHeader
                                            theme={theme}
                                            onEdit={() => { const bi = pages.findIndex((p) => p.is_blog && !p.is_post); if (bi >= 0) goToPage(bi); }}
                                            post={{
                                                title: page.title,
                                                cover_image: page.cover_image || null,
                                                cover_focal: page.cover_focal ?? null,
                                                published_at: page.published_at || null,
                                                // Formatting comes from the parent blog page (shared by all posts).
                                                header: blogPage?.header ?? null,
                                                categories: (page.category_ids ?? [])
                                                    .map((id) => categories.find((c) => c.id === id))
                                                    .filter((c): c is SiteCategory => !!c),
                                            }}
                                        />
                                    ) : undefined}
                                    editing={{ selectedId: selectedBlockId, onSelect: selectBlock, onDelete: removeBlock, onAddChild: addChild, onConfigure: setConfigureBlockId, onEditData: updateBlock }}
                                />
                            </PreviewFrame>
                        </div>
                    </div>
                </div>

            </div>

            {/* Block editor — opens as a modal when a block is clicked. */}
            <Modal show={!!selectedBlock} onClose={closePanel} maxWidth="2xl">
                {selectedBlock && (
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3.5">
                            <span className="truncate text-sm font-semibold text-neutral-900">{blockLabel(selectedBlock.type)} block</span>
                            <button onClick={closePanel} aria-label="Close" className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            <BlockEditor block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} onSettings={(s) => updateSettings(selectedBlock.id, s)} onConfigure={() => setConfigureBlockId(selectedBlock.id)} pages={pageRefs} />
                            <button onClick={() => saveAsSection(selectedBlock.id)} className="mt-6 w-full rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Save as reusable section</button>
                            <button onClick={() => toggleBlockHidden(selectedBlock.id)} className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                                {selectedBlock.hidden ? 'Show block on live site' : 'Hide block (keep it)'}
                            </button>
                            <button onClick={() => { const id = selectedBlock.id; closePanel(); removeBlock(id); }} className="mt-2 w-full rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">Delete block</button>
                        </div>
                    </div>
                )}
            </Modal>

            <BlockPicker
                open={showAddBlock}
                onClose={() => setShowAddBlock(false)}
                onAdd={addBlock}
                savedSections={savedSections}
                onInsertSection={insertSection}
                onDeleteSection={deleteSection}
            />

            {configureBlock?.type === 'reviews' && (
                <GoogleReviewsModal
                    open
                    theme={theme}
                    data={configureBlock.data as Record<string, any>}
                    onChange={(data) => updateBlock(configureBlock.id, data)}
                    onClose={() => setConfigureBlockId(null)}
                />
            )}

        </AuthenticatedLayout>
    );
}

// ─── Category metabox (WordPress-style checkbox tree + add-new) ───────────────

/** Order categories as a depth-first tree, carrying each node's depth. */
function orderedTree(categories: SiteCategory[]): { cat: SiteCategory; depth: number }[] {
    const out: { cat: SiteCategory; depth: number }[] = [];
    const walk = (parentId: number | null, depth: number) => {
        for (const cat of categories.filter((c) => c.parent_id === parentId)) {
            out.push({ cat, depth });
            walk(cat.id, depth + 1);
        }
    };
    walk(null, 0);
    return out;
}

function CategoryMetabox({
    categories,
    selected,
    onChange,
    busy,
    createCategory,
    renameCategory,
    deleteCategory,
}: {
    categories: SiteCategory[];
    selected: number[];
    onChange: (ids: number[]) => void;
    busy: boolean;
    createCategory: (name: string, parentId: number | null) => Promise<SiteCategory | null>;
    renameCategory: (id: number, name: string, parentId: number | null) => Promise<void>;
    deleteCategory: (id: number) => Promise<void>;
}) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newParent, setNewParent] = useState<string>('');
    const [manage, setManage] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const tree = orderedTree(categories);
    const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

    const submitNew = async () => {
        const name = newName.trim();
        if (!name) return;
        const created = await createCategory(name, newParent ? Number(newParent) : null);
        if (created) onChange([...selected, created.id]);
        setNewName('');
        setNewParent('');
        setAdding(false);
    };

    const saveEdit = async (cat: SiteCategory) => {
        const name = editName.trim();
        if (name && name !== cat.name) await renameCategory(cat.id, name, cat.parent_id);
        setEditingId(null);
    };

    return (
        <div className="rounded-md border border-neutral-200">
            <div className="max-h-52 overflow-y-auto p-2">
                {tree.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-neutral-400">No categories yet. Add one below.</p>
                ) : (
                    tree.map(({ cat, depth }) => (
                        <div key={cat.id} className="group flex items-center gap-2 rounded py-0.5 pr-1 hover:bg-neutral-50" style={{ paddingLeft: depth * 18 }}>
                            {editingId === cat.id ? (
                                <input
                                    autoFocus
                                    className="input h-7 flex-1 py-0.5 text-sm"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(cat); if (e.key === 'Escape') setEditingId(null); }}
                                    onBlur={() => saveEdit(cat)}
                                />
                            ) : (
                                <>
                                    <label className="flex flex-1 items-center gap-2 text-sm text-neutral-700">
                                        <input type="checkbox" className="rounded border-neutral-300" checked={selected.includes(cat.id)} onChange={() => toggle(cat.id)} />
                                        {cat.name}
                                    </label>
                                    {manage && (
                                        <span className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                                            <button type="button" title="Rename" onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} className="text-neutral-400 hover:text-neutral-700">
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                            </button>
                                            <button type="button" title="Delete" disabled={busy} onClick={() => { if (window.confirm(`Delete category “${cat.name}”? Posts keep their other categories; any sub-categories move up a level.`)) deleteCategory(cat.id); }} className="text-neutral-400 hover:text-red-500">
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-neutral-100 px-2 py-2">
                {adding ? (
                    <div className="space-y-2">
                        <input autoFocus className="input h-8 py-1 text-sm" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); }} />
                        <select className="input h-8 py-1 text-sm" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
                            <option value="">— Parent category: none —</option>
                            {tree.map(({ cat, depth }) => (
                                <option key={cat.id} value={cat.id}>{'— '.repeat(depth)}{cat.name}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <button type="button" disabled={busy || !newName.trim()} onClick={submitNew} className="btn-primary h-7 px-3 py-0 text-xs disabled:opacity-40">Add</button>
                            <button type="button" onClick={() => { setAdding(false); setNewName(''); setNewParent(''); }} className="text-xs text-neutral-500 hover:text-neutral-800">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <button type="button" onClick={() => setAdding(true)} className="text-xs font-medium text-blue-600 hover:text-blue-800">+ Add New Category</button>
                        {categories.length > 0 && (
                            <button type="button" onClick={() => { setManage((m) => !m); setEditingId(null); }} className="text-xs text-neutral-400 hover:text-neutral-700">{manage ? 'Done' : 'Manage'}</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Blog page: which category filter links to show ──────────────────────────

/** Every category is shown by default; unticking one hides its filter link. */
function BlogCategoryVisibility({ categories, hidden, onChange }: { categories: SiteCategory[]; hidden: number[]; onChange: (ids: number[]) => void }) {
    const tree = orderedTree(categories);
    const toggle = (id: number) => onChange(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]);

    return (
        <div className="rounded-md border border-neutral-200 p-2">
            <p className="px-1 pb-1.5 text-xs text-neutral-500">Categories shown in the blog filter</p>
            {tree.length === 0 ? (
                <p className="px-1 py-1 text-xs text-neutral-400">No categories yet. Add them from a post’s settings.</p>
            ) : (
                <div className="max-h-48 overflow-y-auto">
                    {tree.map(({ cat, depth }) => (
                        <label key={cat.id} className="flex items-center gap-2 rounded py-0.5 pr-1 text-sm text-neutral-700 hover:bg-neutral-50" style={{ paddingLeft: depth * 18 + 4 }}>
                            <input type="checkbox" className="rounded border-neutral-300" checked={!hidden.includes(cat.id)} onChange={() => toggle(cat.id)} />
                            {cat.name}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Page panel (right panel when a page is selected) ─────────────────────────

function PagePanel({ page, activePage, pages, updatePageMeta, setHome, setBlog, set404, removePage, duplicatePage, categories, categoryBusy, createCategory, renameCategory, deleteCategory }: any) {
    if (!page) return null;

    const isPost = !!page.is_post;
    const topCount = pages.filter((p: SitePageData) => !p.is_post).length;
    const set = (partial: Partial<SitePageData>) => updatePageMeta(activePage, partial);

    return (
        <div className="p-4">
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
                        <div className="block">
                            <span className="label mb-1.5 block">Categories</span>
                            <CategoryMetabox
                                categories={categories}
                                selected={page.category_ids ?? []}
                                onChange={(ids: number[]) => set({ category_ids: ids })}
                                busy={categoryBusy}
                                createCategory={createCategory}
                                renameCategory={renameCategory}
                                deleteCategory={deleteCategory}
                            />
                        </div>
                        <ImageField
                            label="Cover image"
                            value={page.cover_image ?? ''}
                            onChange={(v) => set({ cover_image: v })}
                            focal={{ x: page.cover_focal?.x ?? 50, y: page.cover_focal?.y ?? 50 }}
                            onFocalChange={(x, y) => set({ cover_focal: { x, y } })}
                        />
                        <p className="text-xs text-neutral-500">The header layout/formatting is shared across all posts — edit it on the <strong>Blog page</strong> settings.</p>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => duplicatePage(activePage)} className="text-xs text-neutral-600 hover:underline">Duplicate post</button>
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
                        {page.is_blog && (
                            <BlogCategoryVisibility
                                categories={categories}
                                hidden={page.hidden_category_ids ?? []}
                                onChange={(ids: number[]) => set({ hidden_category_ids: ids })}
                            />
                        )}
                        {page.is_blog && (
                            <details className="rounded-lg border border-neutral-200 p-3">
                                <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Post header design</summary>
                                <p className="mb-3 mt-1 text-xs text-neutral-500">Formats the header on every post (each post supplies its own cover image &amp; title). Same options as a hero block.</p>
                                <HeroDesignFields data={page.header ?? {}} onChange={(partial) => set({ header: { ...(page.header ?? {}), ...partial } })} />
                            </details>
                        )}
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                            <input type="checkbox" checked={!!page.is_404} onChange={(e) => set404(activePage, e.target.checked)} /> 404 page <span className="text-xs text-neutral-400">(shown for missing URLs)</span>
                        </label>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => duplicatePage(activePage)} className="text-xs text-neutral-600 hover:underline">Duplicate page</button>
                            {topCount > 1 && (
                                <button onClick={() => removePage(activePage)} className="text-xs text-red-600 hover:underline">Delete page</button>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="mt-6 border-t border-neutral-100 pt-4">
                <ImageField label="Social share image (this page)" value={page.og_image ?? ''} onChange={(v) => set({ og_image: v })} />
                <p className="mt-1 text-xs text-neutral-400">Overrides the site default when this page is shared.</p>
            </div>

            <details className="mt-6 border-t border-neutral-100 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Header &amp; Footer ({isPost ? 'this post' : 'this page'})</summary>
                <p className="mt-1 text-xs text-neutral-500">Custom code injected on this {isPost ? 'post' : 'page'} only, in addition to the site-wide code under Site settings.</p>
                <div className="mt-3 space-y-3">
                    <div>
                        <span className="label mb-1.5 block">Header code (&lt;head&gt;)</span>
                        <textarea className="input font-mono text-xs" rows={4} value={page.head_code ?? ''} onChange={(e) => set({ head_code: e.target.value })} placeholder="<!-- e.g. a page-specific conversion pixel -->" />
                    </div>
                    <div>
                        <span className="label mb-1.5 block">Footer code (before &lt;/body&gt;)</span>
                        <textarea className="input font-mono text-xs" rows={4} value={page.body_code ?? ''} onChange={(e) => set({ body_code: e.target.value })} />
                    </div>
                </div>
            </details>

            <div className="mt-6 border-t border-neutral-100 pt-4">
                <Link href={route('website.settings')} className="text-xs font-medium text-blue-700 hover:underline">
                    Site settings (menus, theme, domain) →
                </Link>
            </div>
        </div>
    );
}

