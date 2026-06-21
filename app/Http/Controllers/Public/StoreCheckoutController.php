<?php

namespace App\Http\Controllers\Public;

use App\Fulfilment\Prodigi\QuoteService;
use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Coupon;
use App\Models\GalleryVisitor;
use App\Models\GiftCard;
use App\Models\Order;
use App\Models\ShippingMethod;
use App\Models\Studio;
use App\Models\TaxRate;
use App\Services\Store\CartResolver;
use App\Services\Store\LineItem;
use App\Services\Store\OrderFulfillment;
use App\Services\Store\OrderService;
use App\Services\Store\PriceQuote;
use App\Services\Store\PricingEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Stripe\StripeClient;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class StoreCheckoutController extends Controller
{
    public function __construct(
        private CartResolver $carts,
        private PricingEngine $pricing,
        private OrderService $orders,
    ) {}

    /** Live totals for the cart (recomputed server-side on every change). */
    public function quote(Request $request, string $slug): JsonResponse
    {
        $collection = $this->resolveCollection($slug);

        try {
            $quote = $this->buildQuote($collection, $request);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        return response()->json($quote->toArray());
    }

    public function checkout(Request $request, string $slug): RedirectResponse|SymfonyResponse
    {
        $collection = $this->resolveCollection($slug);
        $studio = Studio::findOrFail($collection->studio_id);

        $customer = $request->validate([
            'customer_name' => 'required|string|max:255',
            'customer_email' => 'required|email|max:255',
            'customer_phone' => 'nullable|string|max:50',
        ]);

        $cart = $this->resolveCart($collection, $request, $studio);

        // Physical orders need a shipping address (unless the chosen method is pickup).
        $digitalOnly = $cart['lines'] !== [] && collect($cart['lines'])->every(fn ($l) => $l->fulfilment() === 'digital');
        $needsAddress = ! $digitalOnly && ! ($cart['shippingMethod']?->is_pickup);
        $shipping = $request->validate([
            'shipping_name' => ($needsAddress ? 'required' : 'nullable').'|string|max:255',
            'shipping_line1' => ($needsAddress ? 'required' : 'nullable').'|string|max:255',
            'shipping_line2' => 'nullable|string|max:255',
            'shipping_city' => ($needsAddress ? 'required' : 'nullable').'|string|max:255',
            'shipping_region' => 'nullable|string|max:255',
            'shipping_postal_code' => ($needsAddress ? 'required' : 'nullable').'|string|max:32',
            'shipping_country' => ($needsAddress ? 'required' : 'nullable').'|string|max:2',
        ]);

        // Replace catalogue COGS estimates with live Prodigi costs now the destination is known.
        $labShipping = $this->reconcileLabCosts($cart['lines'], $shipping['shipping_country'] ?? null, $studio->default_currency ?? 'gbp');

        $quote = $this->pricing->quote(
            $cart['lines'], $studio, $cart['coupon'], $cart['giftCard'], $cart['shippingMethod'], $cart['taxRate'], $labShipping,
        );

        $order = $this->orders->create(
            studio: $studio,
            collection: $collection,
            quote: $quote,
            customer: [
                'name' => $customer['customer_name'],
                'email' => $customer['customer_email'],
                'phone' => $customer['customer_phone'] ?? null,
            ],
            shipping: [
                'name' => $shipping['shipping_name'] ?? null,
                'line1' => $shipping['shipping_line1'] ?? null,
                'line2' => $shipping['shipping_line2'] ?? null,
                'city' => $shipping['shipping_city'] ?? null,
                'region' => $shipping['shipping_region'] ?? null,
                'postal_code' => $shipping['shipping_postal_code'] ?? null,
                'country' => $shipping['shipping_country'] ?? null,
                'visitor_id' => $this->visitorId($request, $collection),
            ],
        );

        // Fully covered by a gift card / free — no Stripe needed.
        if ($order->total_cents <= 0) {
            app(OrderFulfillment::class)->markPaid($order, null, 0, 'gift_card');

            return redirect()->route('store.public.confirmation', $order->public_id);
        }

        abort_unless($studio->stripe_connect_status === 'active', 403, 'Online payment isn’t available yet.');

        $paymentIntentData = ['metadata' => ['order_id' => $order->id]];
        if ($order->platform_fee_cents > 0) {
            $paymentIntentData['application_fee_amount'] = $order->platform_fee_cents;
        }

        $stripe = new StripeClient(config('services.stripe.secret'));

        try {
            $session = $stripe->checkout->sessions->create([
                'mode' => 'payment',
                'customer_email' => $order->customer_email,
                'line_items' => $this->stripeLineItems($order, $quote),
                'payment_intent_data' => $paymentIntentData,
                'metadata' => ['order_id' => $order->id],
                'success_url' => route('store.public.confirmation', $order->public_id).'?paid=1',
                'cancel_url' => route('gallery.show', $collection->slug),
            ], ['stripe_account' => $studio->stripe_connect_id]);
        } catch (\Throwable $e) {
            report($e);

            return redirect()->route('gallery.show', $collection->slug)
                ->with('error', 'Sorry, we couldn’t start the payment. Please try again.');
        }

        $order->update(['stripe_session_id' => $session->id]);

        return Inertia::location($session->url);
    }

    public function confirmation(string $publicId): Response
    {
        $order = Order::withoutGlobalScopes()->with('items')->where('public_id', $publicId)->firstOrFail();
        $studio = Studio::findOrFail($order->studio_id);

        return Inertia::render('Public/Store/Confirmation', [
            'studio' => ['name' => $studio->name, 'logo_url' => $studio->logoUrl()],
            'order' => [
                'number' => $order->number,
                'status' => $order->status,
                'customer_name' => $order->customer_name,
                'currency' => $order->currency,
                'subtotal_cents' => $order->subtotal_cents,
                'discount_cents' => $order->discount_cents,
                'gift_card_cents' => $order->gift_card_cents,
                'tax_cents' => $order->tax_cents,
                'shipping_cents' => $order->shipping_cents,
                'total_cents' => $order->total_cents,
                'items' => $order->items->map(fn ($i) => [
                    'description' => $i->description,
                    'qty' => $i->qty,
                    'line_total_cents' => $i->line_total_cents,
                    'is_digital' => $i->fulfilment === 'digital',
                    // Only expose a download link once the order is paid.
                    'download_url' => ($order->isPaid() && $i->fulfilment === 'digital' && $i->download_token)
                        ? route('store.public.download', $i->download_token)
                        : null,
                ]),
            ],
        ]);
    }

    /**
     * Resolve the cart lines + promotion/shipping/tax modifiers from the request.
     *
     * @return array{lines: list<LineItem>, coupon: ?Coupon, giftCard: ?GiftCard, shippingMethod: ?ShippingMethod, taxRate: ?TaxRate}
     */
    private function resolveCart(Collection $collection, Request $request, Studio $studio): array
    {
        $coupon = null;
        if ($code = trim((string) $request->input('coupon_code'))) {
            $coupon = Coupon::withoutGlobalScopes()
                ->where('studio_id', $studio->id)->where('code', $code)->first();
        }

        $giftCard = null;
        if ($code = trim((string) $request->input('gift_card_code'))) {
            $giftCard = GiftCard::withoutGlobalScopes()
                ->where('studio_id', $studio->id)->where('code', $code)->first();
        }

        $shippingMethod = null;
        if ($methodId = (int) $request->input('shipping_method_id')) {
            $shippingMethod = ShippingMethod::withoutGlobalScopes()
                ->where('studio_id', $studio->id)->where('active', true)->find($methodId);
        }

        $taxRate = TaxRate::withoutGlobalScopes()
            ->where('studio_id', $studio->id)->where('active', true)
            ->orderByDesc('is_default')->first();

        return [
            'lines' => $this->carts->resolve($collection, $request->input('items', [])),
            'coupon' => $coupon,
            'giftCard' => $giftCard,
            'shippingMethod' => $shippingMethod,
            'taxRate' => $taxRate,
        ];
    }

    /** Build the (estimate) price quote for the live cart preview. */
    private function buildQuote(Collection $collection, Request $request): PriceQuote
    {
        $studio = Studio::findOrFail($collection->studio_id);
        $c = $this->resolveCart($collection, $request, $studio);

        return $this->pricing->quote($c['lines'], $studio, $c['coupon'], $c['giftCard'], $c['shippingMethod'], $c['taxRate']);
    }

    /**
     * Overwrite each lab line's COGS with the live Prodigi cost (in the order
     * currency) and return the lab shipping cost to fold into the order COGS.
     * No-op (returns 0, keeping catalogue estimates) if there are no lab items,
     * no destination, or Prodigi is unavailable.
     *
     * @param  list<LineItem>  $lines
     */
    private function reconcileLabCosts(array $lines, ?string $country, string $currency): int
    {
        if (! $country) {
            return 0;
        }

        $labLines = array_filter($lines, fn ($l) => $l->fulfilment() === 'auto' && $l->option->lab_sku);
        if ($labLines === []) {
            return 0;
        }

        $copies = [];
        foreach ($labLines as $l) {
            $copies[$l->option->lab_sku] = ($copies[$l->option->lab_sku] ?? 0) + $l->qty;
        }
        $items = array_map(fn ($sku, $n) => ['sku' => $sku, 'copies' => $n], array_keys($copies), $copies);

        $quote = app(QuoteService::class)->quote($items, $country, $currency);
        if (! $quote) {
            return 0; // keep catalogue estimates already on the options
        }

        foreach ($labLines as $l) {
            if (isset($quote['skus'][$l->option->lab_sku])) {
                $l->option->cogs_cents = $quote['skus'][$l->option->lab_sku]; // in-memory; not persisted to the catalogue
            }
        }

        return $quote['shipping_cents'] ?? 0;
    }

    /** @return array<int, array<string, mixed>> */
    private function stripeLineItems(Order $order, PriceQuote $quote): array
    {
        // Charge a single consolidated line so the Stripe total always matches our
        // computed total (after discounts, tax, shipping, and gift-card credit).
        return [[
            'price_data' => [
                'currency' => $order->currency,
                'product_data' => ['name' => "Order {$order->number}"],
                'unit_amount' => $order->total_cents,
            ],
            'quantity' => 1,
        ]];
    }

    private function resolveCollection(string $slug): Collection
    {
        $collection = Collection::withoutGlobalScopes()->where('slug', $slug)->firstOrFail();
        abort_unless($collection->isPublished(), 404);
        abort_unless($collection->effectivePriceSheetId(), 404, 'This gallery is not set up for sales.');

        return $collection;
    }

    private function visitorId(Request $request, Collection $collection): ?int
    {
        $token = session("gallery_visitor_{$collection->id}") ?? $request->cookie("gv_{$collection->id}");
        if (! $token) {
            return null;
        }

        return GalleryVisitor::where('collection_id', $collection->id)
            ->where('token', $token)->value('id');
    }
}
