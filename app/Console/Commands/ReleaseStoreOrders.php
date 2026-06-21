<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\Store\OrderFulfillment;
use Illuminate\Console\Command;

class ReleaseStoreOrders extends Command
{
    protected $signature = 'store:release-orders';

    protected $description = 'Fulfil paid store orders whose review/delay window has elapsed.';

    public function handle(OrderFulfillment $fulfillment): int
    {
        // Cross-tenant: runs for every studio, so skip the studio scope.
        $orders = Order::withoutGlobalScopes()
            ->where('status', 'paid')
            ->whereNull('fulfilled_at')
            ->whereNotNull('fulfil_after')
            ->where('fulfil_after', '<=', now())
            ->with(['items.photo', 'studio'])
            ->get();

        foreach ($orders as $order) {
            $fulfillment->fulfilPhysical($order);
            $this->info("Released order {$order->number}.");
        }

        $this->info("Released {$orders->count()} order(s).");

        return self::SUCCESS;
    }
}
