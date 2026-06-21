<?php

namespace App\Fulfilment;

use App\Mail\ClientMessage;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Digital downloads — always platform-fulfilled. Mints a per-item download token
 * and emails the buyer a link to their order page (where the files are served via
 * short-lived signed URLs).
 */
class DigitalProvider implements FulfilmentProvider
{
    public function mode(): string
    {
        return 'digital';
    }

    /** @param  list<OrderItem>  $items */
    public function fulfil(Order $order, array $items): void
    {
        foreach ($items as $item) {
            if (empty($item->download_token)) {
                $item->update(['download_token' => Str::random(48)]);
            }
        }

        if ($order->digital_delivered_at) {
            return; // already emailed
        }

        $details = array_map(fn (OrderItem $i) => [
            'label' => $i->description,
            'value' => 'Qty '.$i->qty,
        ], $items);

        try {
            Mail::to($order->customer_email)->send(new ClientMessage(
                studioName: $order->studio->name ?? config('app.name'),
                subjectLine: 'Your downloads are ready',
                bodyText: "Thanks for your order, {$order->customer_name}! Your digital files are ready to download from the link below.",
                ctaLabel: 'Download your files',
                ctaUrl: route('store.public.confirmation', $order->public_id),
                details: $details,
            ));
            $order->update(['digital_delivered_at' => now()]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
