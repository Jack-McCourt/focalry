import Modal from '@/Components/Modal';
import StoreNav from '@/Components/StoreNav';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { CURRENCIES } from '@/lib/currencies';
import { centsToInput, formatMoney, toCents } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { confirmDialog } from '@/Components/ConfirmDialog';

interface Option {
    id?: number;
    name: string;
    price_cents: number;
    cogs_cents: number | null;
    active?: boolean;
    lab_sku?: string | null;
}
interface Product {
    id: number;
    category_id: number | null;
    type: string;
    name: string;
    description: string | null;
    image_url: string | null;
    digital_resolution: string | null;
    active: boolean;
    position: number;
    is_lab: boolean;
    lab_product_key: string | null;
    fulfilment: string;
    options: Option[];
}
interface Category { id: number; name: string; position: number }
interface Sheet { id: number; name: string; is_default: boolean; fulfilment: string; currency: string }
interface CatalogueSize { sku: string; label: string; cogs_cents: number; suggested_price_cents: number }
interface CatalogueProduct { key: string; name: string; category: string; description: string; sizes: CatalogueSize[] }

const TYPE_LABELS: Record<string, string> = { print: 'Print', digital: 'Digital download', package: 'Package', self: 'Self-fulfilled' };
const FULFILMENT_BADGE: Record<string, { label: string; cls: string }> = {
    auto: { label: 'Lab', cls: 'bg-indigo-50 text-indigo-700' },
    self: { label: 'Self', cls: 'bg-neutral-100 text-neutral-600' },
    digital: { label: 'Digital', cls: 'bg-emerald-50 text-emerald-700' },
};

export default function Products({
    price_sheets,
    selected_sheet_id,
    categories,
    products,
    default_currency,
    lab_catalogue,
}: PageProps<{
    price_sheets: Sheet[];
    selected_sheet_id: number | null;
    categories: Category[];
    products: Product[];
    default_currency: string;
    lab_catalogue: CatalogueProduct[];
}>) {
    const sheet = price_sheets.find((s) => s.id === selected_sheet_id) ?? null;
    const currency = sheet?.currency ?? default_currency;
    const isLabSheet = sheet?.fulfilment === 'lab';

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [creatingProduct, setCreatingProduct] = useState(false);
    const [editingSheet, setEditingSheet] = useState(false);
    const [creatingSheet, setCreatingSheet] = useState(false);
    const [pickingLab, setPickingLab] = useState(false);

    const select = (id: number) => router.get(route('store.products.index'), { sheet: id }, { preserveState: false });

    const addCategory = () => {
        const name = prompt('Category name');
        if (name && sheet) router.post(route('store.product-categories.store'), { price_sheet_id: sheet.id, name }, { preserveScroll: true });
    };

    const priceRange = (p: Product) => {
        const prices = p.options.map((o) => o.price_cents);
        if (prices.length === 0) return '—';
        const min = Math.min(...prices), max = Math.max(...prices);
        return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)}–${formatMoney(max, currency)}`;
    };

    const grouped = [
        ...categories.map((cat) => ({ cat, items: products.filter((p) => p.category_id === cat.id) })),
        { cat: null as Category | null, items: products.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)) },
    ].filter((g) => g.cat || g.items.length > 0);

    return (
        <AuthenticatedLayout header={<h1 className="text-sm font-semibold text-neutral-900">Store</h1>}>
            <Head title="Store · Products" />
            <StoreNav active="products" />

            <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[240px_1fr]">
                {/* Price sheets */}
                <aside>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Price sheets</h2>
                        <button onClick={() => setCreatingSheet(true)} className="text-xs font-medium text-brand hover:underline">+ New</button>
                    </div>
                    <div className="space-y-1">
                        {price_sheets.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => select(s.id)}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                                    s.id === selected_sheet_id ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                            >
                                <span className="truncate">{s.name}</span>
                                {s.is_default && <span className={`ml-2 rounded px-1 text-[10px] ${s.id === selected_sheet_id ? 'bg-white/20' : 'bg-neutral-200 text-neutral-600'}`}>Default</span>}
                            </button>
                        ))}
                        {price_sheets.length === 0 && <p className="px-3 py-2 text-xs text-neutral-400">No price sheets yet.</p>}
                    </div>
                </aside>

                {/* Products in selected sheet */}
                <section>
                    {!sheet ? (
                        <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                            <p className="text-sm font-medium text-neutral-700">Create your first price sheet</p>
                            <p className="mt-1 text-sm text-neutral-400">A price sheet is the catalogue of products you sell in a gallery.</p>
                            <button onClick={() => setCreatingSheet(true)} className="btn-primary mt-4">New price sheet</button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-sm font-semibold text-neutral-900">{sheet.name}</h2>
                                    <p className="text-xs text-neutral-400">
                                        {isLabSheet ? 'Lab-fulfilled (Prodigi) + your own products' : 'Self-fulfilled'} · {sheet.currency.toUpperCase()}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setEditingSheet(true)} className="btn-secondary text-xs">Edit sheet</button>
                                    <button onClick={addCategory} className="btn-secondary text-xs">Add category</button>
                                    {isLabSheet && (
                                        <button onClick={() => setPickingLab(true)} className="btn-secondary text-xs">Add lab product</button>
                                    )}
                                    <button onClick={() => setCreatingProduct(true)} className="btn-primary text-xs">
                                        {isLabSheet ? 'Add custom product' : 'Add product'}
                                    </button>
                                </div>
                            </div>

                            {products.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
                                    <p className="text-sm font-medium text-neutral-700">No products yet</p>
                                    <p className="mt-1 text-sm text-neutral-400">Add prints, digital downloads, packages, or self-fulfilled items.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {grouped.map((g, gi) => (
                                        <div key={gi}>
                                            <CategoryHeader cat={g.cat} />
                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                {g.items.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => setEditingProduct(p)}
                                                        className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-neutral-300 hover:shadow-sm"
                                                    >
                                                        {p.image_url && <img src={p.image_url} alt="" className="h-28 w-full object-cover" />}
                                                        <div className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="truncate text-sm font-semibold text-neutral-900">{p.name}</span>
                                                                <span className={`rounded px-1 text-[10px] ${FULFILMENT_BADGE[p.fulfilment]?.cls ?? 'bg-neutral-100 text-neutral-600'}`}>
                                                                    {FULFILMENT_BADGE[p.fulfilment]?.label ?? p.fulfilment}
                                                                </span>
                                                                {!p.active && <span className="rounded bg-neutral-100 px-1 text-[10px] text-neutral-500">Hidden</span>}
                                                            </div>
                                                            <p className="text-[11px] text-neutral-400">
                                                                {p.is_lab ? 'Prodigi' : TYPE_LABELS[p.type]} · {p.options.filter((o) => o.active !== false).length}/{p.options.length} size{p.options.length === 1 ? '' : 's'}
                                                            </p>
                                                            <p className="mt-1 text-sm text-neutral-700">{priceRange(p)}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>

            {creatingSheet && <SheetModal onClose={() => setCreatingSheet(false)} defaultCurrency={default_currency} />}
            {editingSheet && sheet && <SheetModal onClose={() => setEditingSheet(false)} sheet={sheet} defaultCurrency={default_currency} />}
            {creatingProduct && sheet && <ProductModal onClose={() => setCreatingProduct(false)} sheetId={sheet.id} categories={categories} currency={currency} />}
            {pickingLab && sheet && <CataloguePicker onClose={() => setPickingLab(false)} sheetId={sheet.id} catalogue={lab_catalogue} currency={currency} />}
            {editingProduct && sheet && (
                editingProduct.is_lab
                    ? <LabProductModal onClose={() => setEditingProduct(null)} categories={categories} currency={currency} product={editingProduct} />
                    : <ProductModal onClose={() => setEditingProduct(null)} sheetId={sheet.id} categories={categories} currency={currency} product={editingProduct} />
            )}
        </AuthenticatedLayout>
    );
}

// ── Lab catalogue picker (Prodigi) ──────────────────────────────────────────────

function CataloguePicker({ onClose, sheetId, catalogue, currency }: { onClose: () => void; sheetId: number; catalogue: CatalogueProduct[]; currency: string }) {
    const groups = catalogue.reduce<Record<string, CatalogueProduct[]>>((acc, p) => {
        (acc[p.category] ??= []).push(p);
        return acc;
    }, {});

    const add = (key: string) =>
        router.post(route('store.products.lab.store'), { price_sheet_id: sheetId, lab_product_key: key }, { preserveScroll: true, onSuccess: onClose });

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-neutral-900">Add a Prodigi lab product</h2>
                        <p className="text-xs text-neutral-400">Sizes, SKUs and lab costs are set by Prodigi. You set the retail price after adding.</p>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>
                {Object.entries(groups).map(([cat, items]) => (
                    <div key={cat}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{cat}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {items.map((p) => (
                                <div key={p.key} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-neutral-900">{p.name}</p>
                                        <p className="text-[11px] text-neutral-400">{p.sizes.length} sizes · from {formatMoney(Math.min(...p.sizes.map((s) => s.suggested_price_cents)), currency)}</p>
                                    </div>
                                    <button onClick={() => add(p.key)} className="btn-secondary shrink-0 text-xs">Add</button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}

// ── Lab product editor: fixed sizes, price + enable/disable only ─────────────────

function LabProductModal({ onClose, categories, currency, product }: { onClose: () => void; categories: Category[]; currency: string; product: Product }) {
    const [active, setActive] = useState(product.active);
    const [categoryId, setCategoryId] = useState(product.category_id ? String(product.category_id) : '');
    const [options, setOptions] = useState(product.options.map((o) => ({ id: o.id!, name: o.name, sku: o.lab_sku ?? '', cogs: o.cogs_cents ?? 0, price: centsToInput(o.price_cents), active: o.active !== false })));
    const [processing, setProcessing] = useState(false);

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';
    const setOpt = (i: number, key: 'price' | 'active', val: string | boolean) =>
        setOptions((opts) => opts.map((o, idx) => (idx === i ? { ...o, [key]: val } : o)));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.patch(route('store.products.lab.update', product.id), {
            active: active ? 1 : 0,
            category_id: categoryId || null,
            options: options.map((o) => ({ id: o.id, price_cents: toCents(o.price), active: o.active ? 1 : 0 })),
        }, { preserveScroll: true, onSuccess: onClose, onFinish: () => setProcessing(false) });
    };
    const del = async () => {
        if (await confirmDialog('Remove this lab product from the price sheet?')) router.delete(route('store.products.destroy', product.id), { onSuccess: onClose });
    };

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <div>
                    <h2 className="text-sm font-semibold text-neutral-900">{product.name}</h2>
                    <p className="text-xs text-neutral-400">Prodigi lab product. Toggle sizes on/off and set your retail price; lab cost is fixed.</p>
                </div>

                <div className="max-w-xs">
                    <span className="label">Category</span>
                    <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="">Uncategorised</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <div className="grid grid-cols-[1fr_90px_90px_70px] gap-2 text-[11px] text-neutral-400">
                        <span>Size</span><span>Lab cost</span><span>Your price</span><span>Enabled</span>
                    </div>
                    <div className="mt-1 space-y-2">
                        {options.map((o, i) => (
                            <div key={o.id} className="grid grid-cols-[1fr_90px_90px_70px] items-center gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-neutral-800">{o.name}</p>
                                    <p className="truncate font-mono text-[10px] text-neutral-400">{o.sku}</p>
                                </div>
                                <span className="text-sm text-neutral-500">{formatMoney(o.cogs, currency)}</span>
                                <input className="rounded-md border-neutral-300 text-sm" value={o.price} onChange={(e) => setOpt(i, 'price', e.target.value)} />
                                <label className="flex items-center justify-center">
                                    <input type="checkbox" checked={o.active} onChange={(e) => setOpt(i, 'active', e.target.checked)} className="rounded border-neutral-300" />
                                </label>
                            </div>
                        ))}
                    </div>
                    <p className="mt-1 text-[11px] text-amber-600">Lab costs are estimates — confirm against your Prodigi dashboard.</p>
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-neutral-300" />
                    Product active (visible to clients)
                </label>

                <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={del} className="text-xs font-medium text-red-600 hover:text-red-800">Remove</button>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save'}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

function CategoryHeader({ cat }: { cat: Category | null }) {
    if (!cat) return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Uncategorised</h3>;
    const rename = () => {
        const name = prompt('Rename category', cat.name);
        if (name) router.patch(route('store.product-categories.update', cat.id), { name }, { preserveScroll: true });
    };
    const del = async () => {
        if (await confirmDialog('Delete this category? Its products become uncategorised.')) {
            router.delete(route('store.product-categories.destroy', cat.id), { preserveScroll: true });
        }
    };
    return (
        <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{cat.name}</h3>
            <button onClick={rename} className="text-[11px] text-neutral-400 hover:text-neutral-700">rename</button>
            <button onClick={del} className="text-[11px] text-neutral-400 hover:text-red-600">delete</button>
        </div>
    );
}

function SheetModal({ onClose, sheet, defaultCurrency }: { onClose: () => void; sheet?: Sheet; defaultCurrency: string }) {
    const isEdit = !!sheet;
    const { data, setData, processing, errors } = useForm({
        name: sheet?.name ?? '',
        fulfilment: sheet?.fulfilment ?? 'self',
        currency: sheet?.currency ?? defaultCurrency,
        is_default: sheet?.is_default ?? false,
    });
    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...data, is_default: data.is_default ? 1 : 0 };
        if (isEdit) router.patch(route('store.price-sheets.update', sheet!.id), payload, { onSuccess: onClose });
        else router.post(route('store.price-sheets.store'), payload, { onSuccess: onClose });
    };
    const del = async () => {
        if (await confirmDialog('Delete this price sheet and all its products?')) {
            router.delete(route('store.price-sheets.destroy', sheet!.id), { onSuccess: onClose });
        }
    };

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="space-y-4 p-6">
                <h2 className="text-sm font-semibold text-neutral-900">{isEdit ? 'Edit price sheet' : 'New price sheet'}</h2>
                <div>
                    <span className="label">Name</span>
                    <input className={field} value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Wedding prints" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Fulfilment</span>
                        <select className={field} value={data.fulfilment} onChange={(e) => setData('fulfilment', e.target.value)}>
                            <option value="self">Self-fulfilled only</option>
                            <option value="lab">Lab (Prodigi) + custom</option>
                        </select>
                    </div>
                    <div>
                        <span className="label">Currency</span>
                        <select className={field} value={data.currency} onChange={(e) => setData('currency', e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={data.is_default} onChange={(e) => setData('is_default', e.target.checked)} className="rounded border-neutral-300" />
                    Use as the default for new galleries
                </label>
                <div className="flex items-center justify-between pt-2">
                    {isEdit ? <button type="button" onClick={del} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button> : <span />}
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={processing} className="btn-primary">Save</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

function ProductModal({
    onClose, sheetId, categories, currency, product,
}: {
    onClose: () => void; sheetId: number; categories: Category[]; currency: string; product?: Product;
}) {
    const isEdit = !!product;
    const [name, setName] = useState(product?.name ?? '');
    const [type, setType] = useState(product?.type ?? 'print');
    const [categoryId, setCategoryId] = useState<string>(product?.category_id ? String(product.category_id) : '');
    const [description, setDescription] = useState(product?.description ?? '');
    const [resolution, setResolution] = useState(product?.digital_resolution ?? 'high');
    const [active, setActive] = useState(product?.active ?? true);
    const [image, setImage] = useState<File | null>(null);
    const [options, setOptions] = useState<{ id?: number; name: string; price: string; cogs: string }[]>(
        product?.options.map((o) => ({ id: o.id, name: o.name, price: centsToInput(o.price_cents), cogs: o.cogs_cents != null ? centsToInput(o.cogs_cents) : '' }))
            ?? [{ name: 'Standard', price: '0.00', cogs: '' }],
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500';

    const setOpt = (i: number, key: 'name' | 'price' | 'cogs', val: string) =>
        setOptions((opts) => opts.map((o, idx) => (idx === i ? { ...o, [key]: val } : o)));
    const addOpt = () => setOptions((o) => [...o, { name: '', price: '0.00', cogs: '' }]);
    const removeOpt = (i: number) => setOptions((o) => (o.length > 1 ? o.filter((_, idx) => idx !== i) : o));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData();
        if (isEdit) fd.append('_method', 'patch');
        fd.append('price_sheet_id', String(sheetId));
        if (categoryId) fd.append('category_id', categoryId);
        fd.append('type', type);
        fd.append('name', name);
        fd.append('description', description);
        if (type === 'digital') fd.append('digital_resolution', resolution);
        fd.append('active', active ? '1' : '0');
        options.forEach((o, i) => {
            if (o.id) fd.append(`options[${i}][id]`, String(o.id));
            fd.append(`options[${i}][name]`, o.name);
            fd.append(`options[${i}][price_cents]`, String(toCents(o.price)));
            if (o.cogs.trim() !== '') fd.append(`options[${i}][cogs_cents]`, String(toCents(o.cogs)));
            fd.append(`options[${i}][active]`, '1');
        });
        if (image) fd.append('image', image);

        setProcessing(true);
        router.post(isEdit ? route('store.products.update', product!.id) : route('store.products.store'), fd, {
            forceFormData: true,
            onSuccess: onClose,
            onError: setErrors,
            onFinish: () => setProcessing(false),
        });
    };

    const del = async () => {
        if (await confirmDialog('Delete this product?')) router.delete(route('store.products.destroy', product!.id), { onSuccess: onClose });
    };

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="space-y-4 p-6">
                <h2 className="text-sm font-semibold text-neutral-900">{isEdit ? 'Edit product' : 'New product'}</h2>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Name</span>
                        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fine-art print" />
                        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                    </div>
                    <div>
                        <span className="label">Type</span>
                        <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <span className="label">Category</span>
                        <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                            <option value="">Uncategorised</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    {type === 'digital' && (
                        <div>
                            <span className="label">Download resolution</span>
                            <select className={field} value={resolution} onChange={(e) => setResolution(e.target.value)}>
                                <option value="web">Web</option>
                                <option value="high">High-res</option>
                                <option value="original">Original</option>
                            </select>
                        </div>
                    )}
                </div>

                <div>
                    <span className="label">Description</span>
                    <textarea className={field} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <span className="label">Options &amp; pricing</span>
                        <button type="button" onClick={addOpt} className="text-xs font-medium text-brand hover:underline">+ Add option</button>
                    </div>
                    <div className="mt-1 space-y-2">
                        <div className="grid grid-cols-[1fr_90px_90px_24px] gap-2 text-[11px] text-neutral-400">
                            <span>Name</span><span>Price</span><span>Lab cost</span><span />
                        </div>
                        {options.map((o, i) => (
                            <div key={i} className="grid grid-cols-[1fr_90px_90px_24px] items-center gap-2">
                                <input className="rounded-md border-neutral-300 text-sm" value={o.name} onChange={(e) => setOpt(i, 'name', e.target.value)} placeholder='e.g. 8×10' />
                                <input className="rounded-md border-neutral-300 text-sm" value={o.price} onChange={(e) => setOpt(i, 'price', e.target.value)} placeholder="0.00" />
                                <input className="rounded-md border-neutral-300 text-sm" value={o.cogs} onChange={(e) => setOpt(i, 'cogs', e.target.value)} placeholder="—" />
                                <button type="button" onClick={() => removeOpt(i)} className="text-neutral-300 hover:text-red-600">✕</button>
                            </div>
                        ))}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-400">Lab cost is your cost of goods (used for the order ledger). Currency: {currency.toUpperCase()}.</p>
                </div>

                <div>
                    <span className="label">Image (optional)</span>
                    {product?.image_url && !image && <img src={product.image_url} alt="" className="mt-1 h-20 rounded-md object-cover" />}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm" />
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-neutral-300" />
                    Active (visible to clients)
                </label>

                <div className="flex items-center justify-between pt-2">
                    {isEdit ? <button type="button" onClick={del} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button> : <span />}
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={processing} className="btn-primary">{processing ? 'Saving…' : 'Save'}</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
