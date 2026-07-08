<?php

namespace App\Fulfilment;

use App\Mail\ClientMessage;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Mail;

/**
 * Manual print-lab fulfilment: emails the studio the print order so they can
 * place it with their lab. A real lab API (e.g. iPrintfromHome) would implement
 * FulfilmentProvider for the 'auto' mode and replace this binding.
 */
class ManualLabProvider implements FulfilmentProvider
{
    public function mode(): string
    {
        return 'auto';
    }

    /** @param  list<OrderItem>  $items */
    public function fulfil(Order $order, array $items): void
    {
        $this->emailStudio($order, $items, 'New lab print order to place');
    }

    /** @param  list<OrderItem>  $items */
    protected function emailStudio(Order $order, array $items, string $subject): void
    {
        $studio = $order->studio;
        $to = $studio?->email ?: $studio?->users()->first()?->email;
        if (! $to) {
            return;
        }

        $details = [];
        foreach ($items as $item) {
            $photo = $item->photo;
            $details[] = [
                'label' => $item->description.($photo ? " ({$photo->filename})" : ''),
                'value' => 'Qty '.$item->qty,
            ];
        }
        if ($order->shipping_line1) {
            $details[] = [
                'label' => 'Ship to',
                'value' => trim("{$order->shipping_name}, {$order->shipping_line1}, {$order->shipping_city} {$order->shipping_postal_code} {$order->shipping_country}"),
            ];
        }

        try {
            Mail::to($to)->send(new ClientMessage(
                studioName: $studio->name ?? config('app.name'),
                subjectLine: "{$subject} — {$order->number}",
                bodyText: "Order {$order->number} from {$order->customer_name} needs fulfilment. Details below.",
                ctaLabel: 'View order',
                ctaUrl: route('store.orders.show', $order->id),
                details: $details,
                logoUrl: $studio?->logoUrl(),
                logoHeight: $studio?->emailLogoHeight(),
            ));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
