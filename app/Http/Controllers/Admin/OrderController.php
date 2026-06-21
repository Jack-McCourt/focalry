<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    private const STATUSES = ['pending', 'paid', 'in_production', 'shipped', 'completed', 'cancelled', 'refunded'];

    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();
        $search = $request->string('search')->toString();

        $orders = Order::withoutGlobalScopes()
            ->with('studio:id,name')
            ->when(in_array($status, self::STATUSES, true), fn ($q) => $q->where('status', $status))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('number', 'ilike', "%{$search}%")
                ->orWhere('customer_name', 'ilike', "%{$search}%")
                ->orWhere('customer_email', 'ilike', "%{$search}%")))
            ->latest()
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Order $o) => [
                'id' => $o->id,
                'number' => $o->number,
                'customer_name' => $o->customer_name,
                'status' => $o->status,
                'total_cents' => (int) $o->total_cents,
                'payout_cents' => (int) $o->payout_cents,
                'currency' => $o->currency,
                'studio' => $o->studio ? ['id' => $o->studio->id, 'name' => $o->studio->name] : null,
                'created_at' => $o->created_at?->toIso8601String(),
            ]);

        $paid = Order::withoutGlobalScopes()->whereNotIn('status', ['pending', 'cancelled']);

        return Inertia::render('Admin/Orders', [
            'orders' => $orders,
            'filters' => ['status' => $status ?: null, 'search' => $search],
            'statuses' => self::STATUSES,
            'currency' => config('plans.currency', 'gbp'),
            'totals' => [
                'gmv_cents' => (int) (clone $paid)->sum('total_cents'),
                'payout_cents' => (int) (clone $paid)->sum('payout_cents'),
                'count' => (clone $paid)->count(),
            ],
        ]);
    }
}
