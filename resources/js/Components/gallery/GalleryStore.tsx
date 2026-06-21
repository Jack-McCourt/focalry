import { formatMoney } from '@/lib/money';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { ShoppingBag } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';

interface Option { id: number; name: string; price_cents: number }
interface Product {
    id: number;
    name: string;
    type: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    is_digital: boolean;
    photo_specific: boolean;
    options: Option[];
}
interface ShippingMethod { id: number; name: string; price_cents: number; is_pickup: boolean }
export interface StoreData {
    enabled: boolean;
    currency: string;
    can_pay: boolean;
    products: Product[];
    shipping_methods: ShippingMethod[];
    coupon_banner: string | null;
}
interface GalleryPhoto { id: number; filename: string; thumb_url: string | null }

interface CartItem {
    key: string;
    product_id: number;
    option_id: number;
    product_name: string;
    option_name: string;
    photo_id: number | null;
    photo_thumb: string | null;
    qty: number;
    unit_price_cents: number;
    is_digital: boolean;
}

interface Quote {
    subtotal_cents: number;
    discount_cents: number;
    shipping_cents: number;
    tax_cents: number;
    gift_card_cents: number;
    total_cents: number;
    digital_only: boolean;
    coupon_code: string | null;
}

export interface GalleryStoreHandle {
    /** Open the shop with a specific photo pre-selected (e.g. from the lightbox). */
    shopFor: (photoId: number) => void;
    /** Open the shop to add one product to many photos at once (bulk selection). */
    shopForMany: (photoIds: number[]) => void;
}

const GalleryStore = forwardRef<GalleryStoreHandle, { slug: string; store: StoreData; photos: GalleryPhoto[] }>(
function GalleryStore({ slug, store, photos }, ref) {
    const storageKey = `cart_${slug}`;
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(`cart_${slug}`) || '[]');
        } catch {
            return [];
        }
    });
    const [shopOpen, setShopOpen] = useState(false);
    const [lockedPhotoIds, setLockedPhotoIds] = useState<number[] | null>(null);
    const [cartOpen, setCartOpen] = useState(false);

    useImperativeHandle(ref, () => ({
        shopFor: (photoId: number) => {
            setLockedPhotoIds([photoId]);
            setShopOpen(true);
        },
        shopForMany: (photoIds: number[]) => {
            setLockedPhotoIds(photoIds);
            setShopOpen(true);
        },
    }), []);
    const [couponCode, setCouponCode] = useState('');
    const [giftCardCode, setGiftCardCode] = useState('');
    const [shippingId, setShippingId] = useState<number | null>(store.shipping_methods[0]?.id ?? null);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [checkingOut, setCheckingOut] = useState(false);

    const currency = store.currency;
    const count = cart.reduce((n, i) => n + i.qty, 0);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(cart));
    }, [cart, storageKey]);

    const apiItems = useMemo(
        () => cart.map((i) => ({ option_id: i.option_id, photo_id: i.photo_id, qty: i.qty })),
        [cart],
    );

    const refreshQuote = useCallback(() => {
        if (cart.length === 0) {
            setQuote(null);
            return;
        }
        axios
            .post(route('store.public.quote', slug), {
                items: apiItems,
                coupon_code: couponCode,
                gift_card_code: giftCardCode,
                shipping_method_id: shippingId,
            })
            .then((r) => setQuote(r.data))
            .catch(() => setQuote(null));
    }, [slug, apiItems, couponCode, giftCardCode, shippingId, cart.length]);

    useEffect(() => {
        if (cartOpen) refreshQuote();
    }, [cartOpen, refreshQuote]);

    const addToCart = (product: Product, option: Option, photo: GalleryPhoto | null) => {
        const key = `${option.id}:${photo?.id ?? 'none'}`;
        setCart((c) => {
            const existing = c.find((i) => i.key === key);
            if (existing) {
                return c.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
            }
            return [
                ...c,
                {
                    key,
                    product_id: product.id,
                    option_id: option.id,
                    product_name: product.name,
                    option_name: option.name,
                    photo_id: photo?.id ?? null,
                    photo_thumb: photo?.thumb_url ?? null,
                    qty: 1,
                    unit_price_cents: option.price_cents,
                    is_digital: product.is_digital,
                },
            ];
        });
        setShopOpen(false);
        setCartOpen(true);
    };

    const setQty = (key: string, qty: number) =>
        setCart((c) => (qty <= 0 ? c.filter((i) => i.key !== key) : c.map((i) => (i.key === key ? { ...i, qty } : i))));

    const subtotalLocal = cart.reduce((n, i) => n + i.unit_price_cents * i.qty, 0);

    return (
        <>
            {store.coupon_banner && (
                <div className="bg-neutral-900 px-4 py-2 text-center text-xs font-medium text-white">{store.coupon_banner}</div>
            )}

            {/* Floating cart — appears once items are added; shopping happens per-photo */}
            {count > 0 && (
                <div className="fixed bottom-5 right-5 z-30">
                    <button
                        onClick={() => setCartOpen(true)}
                        className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        {count} · {formatMoney(subtotalLocal, currency)}
                    </button>
                </div>
            )}

            {shopOpen && (
                <ShopModal
                    store={store}
                    photos={photos}
                    lockedPhotos={lockedPhotoIds ? photos.filter((p) => lockedPhotoIds.includes(p.id)) : []}
                    onClose={() => { setShopOpen(false); setLockedPhotoIds(null); }}
                    onAdd={addToCart}
                />
            )}

            {cartOpen && (
                <CartDrawer
                    cart={cart}
                    currency={currency}
                    quote={quote}
                    store={store}
                    couponCode={couponCode}
                    giftCardCode={giftCardCode}
                    shippingId={shippingId}
                    checkingOut={checkingOut}
                    onClose={() => setCartOpen(false)}
                    onQty={setQty}
                    onCoupon={setCouponCode}
                    onGiftCard={setGiftCardCode}
                    onShipping={setShippingId}
                    onApply={refreshQuote}
                    onCheckout={(customer, shipping) => {
                        setCheckingOut(true);
                        router.post(
                            route('store.public.checkout', slug),
                            {
                                items: apiItems,
                                coupon_code: couponCode,
                                gift_card_code: giftCardCode,
                                shipping_method_id: shippingId,
                                ...customer,
                                ...shipping,
                            },
                            {
                                onSuccess: () => localStorage.removeItem(storageKey),
                                onError: () => setCheckingOut(false),
                                onFinish: () => setCheckingOut(false),
                            },
                        );
                    }}
                />
            )}
        </>
    );
});

export default GalleryStore;

// ── Shop: pick a product, (photo,) option ──────────────────────────────────────

function ShopModal({
    store, photos, lockedPhotos, onClose, onAdd,
}: {
    store: StoreData;
    photos: GalleryPhoto[];
    lockedPhotos: GalleryPhoto[];
    onClose: () => void;
    onAdd: (p: Product, o: Option, photo: GalleryPhoto | null) => void;
}) {
    const lockedOne = lockedPhotos.length === 1 ? lockedPhotos[0] : null;
    const bulk = lockedPhotos.length > 1;
    const [product, setProduct] = useState<Product | null>(null);
    const [photo, setPhoto] = useState<GalleryPhoto | null>(lockedOne);
    const [optionId, setOptionId] = useState<number | null>(null);

    const begin = (p: Product) => {
        setProduct(p);
        setOptionId(p.options[0]?.id ?? null);
        setPhoto(lockedOne);
    };

    const canAdd = !!optionId && (!product?.photo_specific || lockedPhotos.length > 0 || !!photo);

    const submit = () => {
        if (!product || !optionId) return;
        const opt = product.options.find((o) => o.id === optionId)!;
        if (product.photo_specific && lockedPhotos.length > 0) {
            lockedPhotos.forEach((ph) => onAdd(product, opt, ph)); // bulk / single locked
        } else {
            onAdd(product, opt, product.photo_specific ? photo : null);
        }
    };

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-neutral-900">{product ? product.name : 'Shop'}</h2>
                <button onClick={product ? () => setProduct(null) : onClose} className="text-neutral-400 hover:text-neutral-700">
                    {product ? '← Back' : '✕'}
                </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
                {!product ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {store.products.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => begin(p)}
                                className="overflow-hidden rounded-xl border border-neutral-200 text-left transition hover:border-neutral-400"
                            >
                                {p.image_url ? (
                                    <img src={p.image_url} alt="" className="h-24 w-full object-cover" />
                                ) : (
                                    <div className="flex h-24 w-full items-center justify-center bg-neutral-100 text-[11px] text-neutral-400">{p.name}</div>
                                )}
                                <div className="p-2.5">
                                    <p className="truncate text-sm font-medium text-neutral-900">{p.name}</p>
                                    <p className="text-[11px] text-neutral-400">
                                        from {formatMoney(Math.min(...p.options.map((o) => o.price_cents)), store.currency)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {product.description && <p className="text-sm text-neutral-500">{product.description}</p>}

                        {product.photo_specific && bulk && (
                            <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-neutral-50 p-2">
                                {lockedPhotos.slice(0, 8).map((ph) => (
                                    ph.thumb_url && <img key={ph.id} src={ph.thumb_url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                                ))}
                                <span className="shrink-0 px-1 text-xs font-medium text-neutral-600">Adding to {lockedPhotos.length} photos</span>
                            </div>
                        )}

                        {product.photo_specific && lockedOne && (
                            <div className="flex items-center gap-3">
                                {lockedOne.thumb_url && <img src={lockedOne.thumb_url} alt="" className="h-16 w-16 rounded object-cover" />}
                                <p className="text-xs text-neutral-500">Printing <span className="font-medium text-neutral-700">{lockedOne.filename}</span></p>
                            </div>
                        )}

                        {product.photo_specific && lockedPhotos.length === 0 && (
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-neutral-500">Choose a photo</p>
                                <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                                    {photos.map((ph) => (
                                        <button
                                            key={ph.id}
                                            onClick={() => setPhoto(ph)}
                                            className={`overflow-hidden rounded-md ring-2 ${photo?.id === ph.id ? 'ring-neutral-900' : 'ring-transparent'}`}
                                        >
                                            {ph.thumb_url && <img src={ph.thumb_url} alt={ph.filename} className="aspect-square w-full object-cover" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="mb-1.5 text-xs font-medium text-neutral-500">Option</p>
                            <select
                                value={optionId ?? ''}
                                onChange={(e) => setOptionId(Number(e.target.value))}
                                className="block w-full rounded-md border-neutral-300 text-sm"
                            >
                                {product.options.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name} — {formatMoney(o.price_cents, store.currency)}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            disabled={!canAdd}
                            onClick={submit}
                            className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                        >
                            {bulk ? `Add ${lockedPhotos.length} to cart` : 'Add to cart'}
                        </button>
                    </div>
                )}
            </div>
        </Overlay>
    );
}

// ── Cart drawer + checkout form ────────────────────────────────────────────────

function CartDrawer({
    cart, currency, quote, store, couponCode, giftCardCode, shippingId, checkingOut,
    onClose, onQty, onCoupon, onGiftCard, onShipping, onApply, onCheckout,
}: {
    cart: CartItem[];
    currency: string;
    quote: Quote | null;
    store: StoreData;
    couponCode: string;
    giftCardCode: string;
    shippingId: number | null;
    checkingOut: boolean;
    onClose: () => void;
    onQty: (key: string, qty: number) => void;
    onCoupon: (v: string) => void;
    onGiftCard: (v: string) => void;
    onShipping: (id: number) => void;
    onApply: () => void;
    onCheckout: (customer: Record<string, string>, shipping: Record<string, string>) => void;
}) {
    const [stage, setStage] = useState<'cart' | 'details'>('cart');
    const [customer, setCustomer] = useState({ customer_name: '', customer_email: '', customer_phone: '' });
    const [ship, setShip] = useState({
        shipping_name: '', shipping_line1: '', shipping_line2: '',
        shipping_city: '', shipping_region: '', shipping_postal_code: '', shipping_country: '',
    });

    const digitalOnly = quote?.digital_only ?? cart.every((i) => i.is_digital);
    const selectedShipping = store.shipping_methods.find((m) => m.id === shippingId);
    const needsAddress = !digitalOnly && !selectedShipping?.is_pickup;
    const field = 'mt-1 block w-full rounded-md border-neutral-300 text-sm shadow-sm focus:border-neutral-900 focus:ring-neutral-900';

    const canCheckout = customer.customer_name && customer.customer_email && (!needsAddress || (ship.shipping_line1 && ship.shipping_city && ship.shipping_postal_code && ship.shipping_country));

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                    <h2 className="text-sm font-semibold text-neutral-900">{stage === 'cart' ? 'Your cart' : 'Checkout'}</h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {cart.length === 0 ? (
                        <p className="py-10 text-center text-sm text-neutral-400">Your cart is empty.</p>
                    ) : stage === 'cart' ? (
                        <div className="space-y-3">
                            {cart.map((i) => (
                                <div key={i.key} className="flex items-center gap-3">
                                    {i.photo_thumb ? (
                                        <img src={i.photo_thumb} alt="" className="h-12 w-12 rounded object-cover" />
                                    ) : (
                                        <div className="h-12 w-12 rounded bg-neutral-100" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-neutral-900">{i.product_name}</p>
                                        <p className="text-[11px] text-neutral-400">{i.option_name} · {formatMoney(i.unit_price_cents, currency)}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => onQty(i.key, i.qty - 1)} className="h-6 w-6 rounded border border-neutral-200 text-neutral-600">−</button>
                                        <span className="w-5 text-center text-sm">{i.qty}</span>
                                        <button onClick={() => onQty(i.key, i.qty + 1)} className="h-6 w-6 rounded border border-neutral-200 text-neutral-600">+</button>
                                    </div>
                                </div>
                            ))}

                            <div className="space-y-2 border-t border-neutral-100 pt-3">
                                <div className="flex gap-2">
                                    <input value={couponCode} onChange={(e) => onCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="flex-1 rounded-md border-neutral-300 text-sm" />
                                    <button onClick={onApply} className="btn-secondary text-xs">Apply</button>
                                </div>
                                <div className="flex gap-2">
                                    <input value={giftCardCode} onChange={(e) => onGiftCard(e.target.value.toUpperCase())} placeholder="Gift card" className="flex-1 rounded-md border-neutral-300 text-sm" />
                                    <button onClick={onApply} className="btn-secondary text-xs">Apply</button>
                                </div>
                                {!digitalOnly && store.shipping_methods.length > 0 && (
                                    <select value={shippingId ?? ''} onChange={(e) => onShipping(Number(e.target.value))} className="block w-full rounded-md border-neutral-300 text-sm">
                                        {store.shipping_methods.map((m) => (
                                            <option key={m.id} value={m.id}>{m.name} — {m.is_pickup ? 'Free pickup' : formatMoney(m.price_cents, currency)}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Field label="Name" value={customer.customer_name} onChange={(v) => setCustomer((c) => ({ ...c, customer_name: v }))} className={field} />
                            <Field label="Email" value={customer.customer_email} onChange={(v) => setCustomer((c) => ({ ...c, customer_email: v }))} className={field} />
                            <Field label="Phone (optional)" value={customer.customer_phone} onChange={(v) => setCustomer((c) => ({ ...c, customer_phone: v }))} className={field} />
                            {needsAddress && (
                                <>
                                    <div className="border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-500">Shipping address</div>
                                    <Field label="Recipient" value={ship.shipping_name} onChange={(v) => setShip((s) => ({ ...s, shipping_name: v }))} className={field} />
                                    <Field label="Address" value={ship.shipping_line1} onChange={(v) => setShip((s) => ({ ...s, shipping_line1: v }))} className={field} />
                                    <Field label="Address line 2 (optional)" value={ship.shipping_line2} onChange={(v) => setShip((s) => ({ ...s, shipping_line2: v }))} className={field} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Field label="City" value={ship.shipping_city} onChange={(v) => setShip((s) => ({ ...s, shipping_city: v }))} className={field} />
                                        <Field label="State/Region" value={ship.shipping_region} onChange={(v) => setShip((s) => ({ ...s, shipping_region: v }))} className={field} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Field label="Postal code" value={ship.shipping_postal_code} onChange={(v) => setShip((s) => ({ ...s, shipping_postal_code: v }))} className={field} />
                                        <Field label="Country (2-letter)" value={ship.shipping_country} onChange={(v) => setShip((s) => ({ ...s, shipping_country: v.toUpperCase().slice(0, 2) }))} className={field} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="border-t border-neutral-100 p-5">
                        {quote && (
                            <div className="mb-3 space-y-0.5 text-sm">
                                <Row label="Subtotal" value={formatMoney(quote.subtotal_cents, currency)} />
                                {quote.discount_cents > 0 && <Row label={`Discount${quote.coupon_code ? ` (${quote.coupon_code})` : ''}`} value={`−${formatMoney(quote.discount_cents, currency)}`} />}
                                {quote.shipping_cents > 0 && <Row label="Shipping" value={formatMoney(quote.shipping_cents, currency)} />}
                                {quote.tax_cents > 0 && <Row label="Tax" value={formatMoney(quote.tax_cents, currency)} />}
                                {quote.gift_card_cents > 0 && <Row label="Gift card" value={`−${formatMoney(quote.gift_card_cents, currency)}`} />}
                                <Row label="Total" value={formatMoney(quote.total_cents, currency)} bold />
                            </div>
                        )}

                        {!store.can_pay ? (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">Online payment isn’t available yet.</p>
                        ) : stage === 'cart' ? (
                            <button onClick={() => setStage('details')} className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white">Checkout</button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setStage('cart')} className="btn-secondary">Back</button>
                                <button
                                    disabled={!canCheckout || checkingOut}
                                    onClick={() => onCheckout(customer, ship)}
                                    className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                                >
                                    {checkingOut ? 'Redirecting…' : 'Pay now'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className: string }) {
    return (
        <div>
            <span className="text-xs font-medium text-neutral-500">{label}</span>
            <input className={className} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className={bold ? 'font-semibold text-neutral-900' : 'text-neutral-500'}>{label}</span>
            <span className={bold ? 'font-semibold text-neutral-900' : 'text-neutral-700'}>{value}</span>
        </div>
    );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">{children}</div>
        </div>
    );
}

