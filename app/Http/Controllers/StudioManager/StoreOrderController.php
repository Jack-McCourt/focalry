<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Studio;
use App\Services\Store\OrderFulfillment;
use App\Services\Store\RefundService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StoreOrderController extends Controller
{
    private const STATUSES = ['pending', 'paid', 'in_production', 'shipped', 'completed', 'cancelled', 'refunded'];

    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();

        $orders = Order::withCount('items')
            ->when(in_array($status, self::STATUSES, true), fn ($q) => $q->where('status', $status))
            ->latest()
            ->paginate(30)
            ->through(fn (Order $o) => [
                'id' => $o->id,
                'number' => $o->number,
                'customer_name' => $o->customer_name,
                'status' => $o->status,
                'fulfilment' => $o->fulfilment,
                'total_cents' => $o->total_cents,
                'currency' => $o->currency,
                'items_count' => $o->items_count,
                'created_at' => $o->created_at->toIso8601String(),
            ]);

        return Inertia::render('Store/Orders', [
            'orders' => $orders,
            'filter_status' => $status ?: null,
            'statuses' => self::STATUSES,
            'default_currency' => Studio::find(app('current.studio.id'))?->default_currency ?? 'gbp',
            'totals' => [
                'revenue_cents' => (int) Order::whereNotIn('status', ['pending', 'cancelled'])->sum('total_cents'),
                'payout_cents' => (int) Order::whereNotIn('status', ['pending', 'cancelled'])->sum('payout_cents'),
                'open' => Order::whereIn('status', ['paid', 'in_production'])->count(),
            ],
        ]);
    }

    public function show(Order $order): Response
    {
        $order->load(['items.photo', 'refunds', 'coupon', 'giftCard', 'shippingMethod', 'collection:id,title,slug']);

        return Inertia::render('Store/OrderShow', [
            'order' => [
                ...$order->only([
                    'id', 'number', 'status', 'fulfilment', 'currency',
                    'customer_name', 'customer_email', 'customer_phone',
                    'shipping_name', 'shipping_line1', 'shipping_line2', 'shipping_city',
                    'shipping_region', 'shipping_postal_code', 'shipping_country',
                    'subtotal_cents', 'discount_cents', 'gift_card_cents', 'tax_cents',
                    'shipping_cents', 'total_cents', 'platform_fee_cents', 'cogs_cents',
                    'payout_cents', 'refunded_cents', 'payment_method', 'notes',
                ]),
                'coupon_code' => $order->coupon?->code,
                'shipping_method' => $order->shippingMethod?->name,
                'collection' => $order->collection ? ['title' => $order->collection->title, 'slug' => $order->collection->slug] : null,
                'paid_at' => $order->paid_at?->toIso8601String(),
                'fulfilled_at' => $order->fulfilled_at?->toIso8601String(),
                'fulfil_after' => $order->fulfil_after?->toIso8601String(),
                'created_at' => $order->created_at->toIso8601String(),
                'refundable_cents' => $order->refundableCents(),
                'items' => $order->items->map(fn ($i) => [
                    'id' => $i->id,
                    'description' => $i->description,
                    'type' => $i->type,
                    'fulfilment' => $i->fulfilment,
                    'qty' => $i->qty,
                    'unit_price_cents' => $i->unit_price_cents,
                    'cogs_cents' => $i->cogs_cents,
                    'line_total_cents' => $i->line_total_cents,
                    'photo_thumb' => $i->photo?->signedUrl('thumb', 120),
                    'photo_filename' => $i->photo?->filename,
                ]),
                'refunds' => $order->refunds->map(fn ($r) => [
                    'amount_cents' => $r->amount_cents,
                    'reason' => $r->reason,
                    'created_at' => $r->created_at->toIso8601String(),
                ]),
            ],
            'statuses' => self::STATUSES,
        ]);
    }

    public function updateStatus(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(self::STATUSES)]]);
        $order->update(['status' => $data['status']]);

        return back()->with('success', 'Order status updated.');
    }

    public function fulfil(Order $order, OrderFulfillment $fulfillment): RedirectResponse
    {
        abort_unless($order->isPaid(), 422, 'Only paid orders can be fulfilled.');
        $fulfillment->fulfilPhysical($order);

        return back()->with('success', 'Order fulfilled.');
    }

    public function recordOffline(Order $order, OrderFulfillment $fulfillment): RedirectResponse
    {
        abort_if($order->paid_at !== null, 422, 'This order is already paid.');
        $fulfillment->markPaidOffline($order);

        return back()->with('success', 'Offline payment recorded.');
    }

    public function refund(Request $request, Order $order, RefundService $refunds): RedirectResponse
    {
        $data = $request->validate([
            'amount_cents' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:1000',
        ]);

        try {
            $refunds->refund($order, (int) $data['amount_cents'], $data['reason'] ?? null);
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Refund failed: '.$e->getMessage());
        }

        return back()->with('success', 'Refund issued.');
    }
}
