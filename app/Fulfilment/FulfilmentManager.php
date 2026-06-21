<?php

namespace App\Fulfilment;

use App\Models\Order;

/**
 * Routes each order item to the right FulfilmentProvider based on its fulfilment
 * mode (auto → lab, self → studio, digital → downloads). Because the mode is
 * decided per product, a single order can fan out across all three providers.
 *
 * The "auto" (lab) provider is Prodigi — the only lab partner for now.
 */
class FulfilmentManager
{
    /** @var array<string, FulfilmentProvider> */
    private array $providers;

    public function __construct(DigitalProvider $digital, ProdigiProvider $lab, SelfFulfilmentProvider $self)
    {
        $this->providers = [
            $digital->mode() => $digital,  // 'digital'
            $lab->mode() => $lab,          // 'auto' → Prodigi
            $self->mode() => $self,        // 'self'
        ];
    }

    public function fulfil(Order $order): void
    {
        $order->loadMissing('items.photo', 'items.product', 'items.option', 'studio');

        $groups = $order->items->groupBy('fulfilment');

        foreach ($groups as $mode => $items) {
            $provider = $this->providers[$mode] ?? $this->providers['self'];
            $provider->fulfil($order, $items->values()->all());
        }
    }
}
