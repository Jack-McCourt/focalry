<?php

use App\Mail\ClientMessage;
use App\Models\Collection;
use App\Models\CreditLedgerEntry;
use App\Models\GiftCard;
use App\Models\Order;
use App\Models\Photo;
use App\Models\PriceSheet;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\Studio;
use App\Models\User;
use App\Services\Store\OrderFulfillment;
use Illuminate\Support\Facades\Mail;

function storeStudio(array $attrs = []): array
{
    $studio = Studio::factory()->create(array_merge(['slug' => 'lens', 'email' => 'studio@lens.test'], $attrs));
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function sellingGallery(Studio $studio, string $fulfilment = 'self'): array
{
    $sheet = PriceSheet::create([
        'studio_id' => $studio->id, 'name' => 'Prints', 'is_default' => true,
        'fulfilment' => $fulfilment, 'currency' => 'usd',
    ]);
    $collection = Collection::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'title' => 'Wedding', 'slug' => 'wedding',
        'status' => 'published', 'published_at' => now()->subDay(), 'price_sheet_id' => $sheet->id,
    ]);
    $photo = Photo::create([
        'studio_id' => $studio->id, 'collection_id' => $collection->id, 'filename' => 'a.jpg',
        'wasabi_key_original' => 'k/orig.jpg', 'derivative_keys' => ['web' => 'k/web.jpg', 'print' => 'k/print.jpg'],
        'status' => 'ready', 'position' => 1,
    ]);

    return [$sheet, $collection, $photo];
}

function makeProduct(Studio $studio, PriceSheet $sheet, string $type, int $price, ?int $cogs = null): ProductOption
{
    $product = Product::create([
        'studio_id' => $studio->id, 'price_sheet_id' => $sheet->id, 'type' => $type,
        'name' => ucfirst($type), 'active' => true,
        'digital_resolution' => $type === 'digital' ? 'high' : null,
    ]);

    return ProductOption::create([
        'studio_id' => $studio->id, 'product_id' => $product->id, 'name' => 'Standard',
        'price_cents' => $price, 'cogs_cents' => $cogs, 'active' => true,
    ]);
}

it('returns a live quote for an in-gallery cart', function () {
    [$studio] = storeStudio();
    [$sheet, $collection, $photo] = sellingGallery($studio);
    $option = makeProduct($studio, $sheet, 'print', 4000, 1000);

    $this->postJson(route('store.public.quote', 'wedding'), [
        'items' => [['option_id' => $option->id, 'photo_id' => $photo->id, 'qty' => 2]],
    ])->assertOk()->assertJson([
        'subtotal_cents' => 8000,
        'total_cents' => 8000,
        'platform_fee_cents' => 1200, // 15% of 8000
        'cogs_cents' => 2000,
        'payout_cents' => 4800,
    ]);
});

it('rejects a cart item from another studio price sheet', function () {
    [$studioA] = storeStudio(['slug' => 'lens']);
    [, $collectionA] = sellingGallery($studioA);

    // A product on a different studio's sheet.
    $other = Studio::factory()->create(['slug' => 'other']);
    app()->instance('current.studio.id', $other->id);
    $otherSheet = PriceSheet::create(['studio_id' => $other->id, 'name' => 'X', 'fulfilment' => 'self', 'currency' => 'usd']);
    $foreignOption = makeProduct($other, $otherSheet, 'print', 4000);

    app()->instance('current.studio.id', $studioA->id);
    $this->postJson(route('store.public.quote', 'wedding'), [
        'items' => [['option_id' => $foreignOption->id, 'photo_id' => 1, 'qty' => 1]],
    ])->assertStatus(422);
});

it('checks out a fully gift-card-covered order without Stripe and records the ledger', function () {
    Mail::fake();
    [$studio] = storeStudio();
    [$sheet, $collection, $photo] = sellingGallery($studio);
    $option = makeProduct($studio, $sheet, 'digital', 5000);

    $card = GiftCard::create([
        'studio_id' => $studio->id, 'code' => 'GIFT-1234', 'initial_cents' => 5000,
        'balance_cents' => 5000, 'currency' => 'usd', 'active' => true,
    ]);

    $this->post(route('store.public.checkout', 'wedding'), [
        'items' => [['option_id' => $option->id, 'photo_id' => $photo->id, 'qty' => 1]],
        'gift_card_code' => 'GIFT-1234',
        'customer_name' => 'Dana Lee',
        'customer_email' => 'dana@example.com',
    ])->assertRedirect();

    $order = Order::withoutGlobalScopes()->first();
    expect($order->total_cents)->toBe(0)
        ->and($order->gift_card_cents)->toBe(5000)
        ->and($order->status)->toBe('completed'); // digital-only, delivered immediately

    expect($card->refresh()->balance_cents)->toBe(0);
    expect(CreditLedgerEntry::withoutGlobalScopes()->where('order_id', $order->id)->where('delta_cents', -5000)->exists())->toBeTrue();

    // Digital item got a download token minted for delivery.
    expect($order->items()->first()->download_token)->not->toBeNull();
});

it('marks an order paid idempotently from replayed webhooks', function () {
    Mail::fake();
    [$studio] = storeStudio();
    [$sheet, $collection, $photo] = sellingGallery($studio);

    $order = Order::create([
        'studio_id' => $studio->id, 'collection_id' => $collection->id,
        'customer_name' => 'Dana', 'customer_email' => 'dana@example.com',
        'status' => 'pending', 'fulfilment' => 'self', 'currency' => 'usd',
        'subtotal_cents' => 4000, 'total_cents' => 4000, 'platform_fee_cents' => 600,
    ]);
    $order->items()->create([
        'studio_id' => $studio->id, 'type' => 'print', 'description' => 'Print — Standard',
        'qty' => 1, 'unit_price_cents' => 4000, 'line_total_cents' => 4000, 'fulfilment' => 'self',
    ]);

    $service = app(OrderFulfillment::class);
    $service->markPaid($order, 'pi_123', 4000);
    $service->markPaid($order->refresh(), 'pi_123', 4000);

    expect($order->refresh()->status)->toBe('in_production') // paid → fulfilled (self, no review hold)
        ->and($order->paid_at)->not->toBeNull();
    // Single studio notification email despite the replay.
    Mail::assertSent(ClientMessage::class, 2); // 1 confirmation + 1 self-fulfil notice
});

it('scopes orders to the current studio', function () {
    [$studioA] = storeStudio(['slug' => 'lens']);
    Order::create([
        'studio_id' => $studioA->id, 'customer_name' => 'A', 'customer_email' => 'a@x.com',
        'currency' => 'usd', 'total_cents' => 1000,
    ]);

    $other = Studio::factory()->create(['slug' => 'other']);
    app()->instance('current.studio.id', $other->id);
    Order::create([
        'studio_id' => $other->id, 'customer_name' => 'B', 'customer_email' => 'b@x.com',
        'currency' => 'usd', 'total_cents' => 2000,
    ]);

    app()->instance('current.studio.id', $studioA->id);
    expect(Order::count())->toBe(1)
        ->and(Order::first()->customer_name)->toBe('A');
});

it('blocks a digital download until the order is paid', function () {
    [$studio] = storeStudio();
    [$sheet, $collection, $photo] = sellingGallery($studio);

    $order = Order::create([
        'studio_id' => $studio->id, 'customer_name' => 'A', 'customer_email' => 'a@x.com',
        'status' => 'pending', 'currency' => 'usd', 'total_cents' => 5000,
    ]);
    $item = $order->items()->create([
        'studio_id' => $studio->id, 'photo_id' => $photo->id, 'type' => 'digital',
        'description' => 'Digital', 'qty' => 1, 'unit_price_cents' => 5000, 'line_total_cents' => 5000,
        'fulfilment' => 'digital', 'digital_resolution' => 'high', 'download_token' => 'tok_unpaid',
    ]);

    $this->get(route('store.public.download', 'tok_unpaid'))->assertStatus(403);
});
