<?php

namespace App\Fulfilment;

use App\Models\Order;
use App\Models\OrderItem;

/**
 * Strategy for fulfilling a group of order items of one fulfilment mode.
 *
 * v1 ships a ManualLabProvider (emails the studio), a SelfFulfilmentProvider,
 * and a DigitalProvider. Real lab APIs (e.g. iPrintfromHome) plug in later by
 * implementing this interface and binding it for the 'auto' mode.
 */
interface FulfilmentProvider
{
    /** The fulfilment mode this provider handles: auto | self | digital. */
    public function mode(): string;

    /**
     * Fulfil the given items belonging to the order. Must be idempotent — it can
     * be re-invoked from a replayed Stripe webhook.
     *
     * @param  list<OrderItem>  $items
     */
    public function fulfil(Order $order, array $items): void;
}
