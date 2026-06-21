<?php

namespace App\Fulfilment;

use App\Models\Order;
use App\Models\OrderItem;

/**
 * Self-fulfilled items: the studio fulfils manually with their own lab/shipping.
 * We just notify them (reusing the lab email template) — the platform does no
 * automatic fulfilment for these.
 */
class SelfFulfilmentProvider extends ManualLabProvider
{
    public function mode(): string
    {
        return 'self';
    }

    /** @param  list<OrderItem>  $items */
    public function fulfil(Order $order, array $items): void
    {
        $this->emailStudio($order, $items, 'New order to fulfil');
    }
}
