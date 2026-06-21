<?php

namespace App\Http\Controllers\Prodigi;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Receives Prodigi order status callbacks (CloudEvents v1.0) and reflects the
 * lab's progress onto the order: shipment tracking + final status. The route
 * carries an unguessable secret matching config('services.prodigi.callback_secret').
 */
class CallbackController extends Controller
{
    public function __invoke(Request $request, string $secret): JsonResponse
    {
        $expected = config('services.prodigi.callback_secret');
        abort_unless($expected && hash_equals((string) $expected, $secret), 404);

        $orderData = $request->input('data', []);
        $ref = $request->input('subject') ?? ($orderData['id'] ?? null);

        $order = $ref
            ? Order::withoutGlobalScopes()->where('lab_order_ref', $ref)->first()
            : null;

        // Fall back to our own id we set in metadata when creating the Prodigi order.
        if (! $order && ($id = $orderData['metadata']['order_id'] ?? null)) {
            $order = Order::withoutGlobalScopes()->find($id);
        }

        if (! $order) {
            return response()->json(['ok' => true]); // ack unknown orders so Prodigi stops retrying
        }

        $this->applyShipment($order, $orderData['shipments'] ?? []);
        $this->applyStage($order, $orderData['status']['stage'] ?? null);

        return response()->json(['ok' => true]);
    }

    /** @param array<int, array<string, mixed>> $shipments */
    private function applyShipment(Order $order, array $shipments): void
    {
        foreach ($shipments as $shipment) {
            $tracking = $shipment['tracking'] ?? [];
            if (empty($tracking['number']) && empty($tracking['url'])) {
                continue;
            }

            $order->update([
                'shipping_carrier' => $shipment['carrier']['name'] ?? $order->shipping_carrier,
                'tracking_number' => $tracking['number'] ?? $order->tracking_number,
                'tracking_url' => $tracking['url'] ?? $order->tracking_url,
                'status' => $order->status === 'completed' ? 'completed' : 'shipped',
            ]);

            return;
        }
    }

    private function applyStage(Order $order, ?string $stage): void
    {
        match ($stage) {
            'Complete' => $order->update(['status' => 'completed', 'fulfilled_at' => $order->fulfilled_at ?? now()]),
            'Cancelled' => $order->update(['status' => 'cancelled']),
            default => null,
        };
    }
}
