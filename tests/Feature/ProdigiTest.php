<?php

use App\Fulfilment\Prodigi\Catalogue;
use App\Fulfilment\Prodigi\StoreDefaults;
use App\Fulfilment\ProdigiProvider;
use App\Mail\ClientMessage;
use App\Models\Collection;
use App\Models\Order;
use App\Models\Photo;
use App\Models\PriceSheet;
use App\Models\Product;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

function prodigiStudio(): array
{
    $studio = Studio::factory()->onPaidPlan()->create(['slug' => 'lab', 'email' => 'studio@lab.test']);
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    return [$studio, $user];
}

function labSheet(Studio $studio): PriceSheet
{
    return PriceSheet::create(['studio_id' => $studio->id, 'name' => 'Prints', 'fulfilment' => 'lab', 'currency' => 'gbp']);
}

function labOrderWithItem(Studio $studio): Order
{
    $order = Order::create([
        'studio_id' => $studio->id,
        'customer_name' => 'Dana Lee', 'customer_email' => 'dana@example.com',
        'status' => 'paid', 'fulfilment' => 'auto', 'currency' => 'gbp',
        'total_cents' => 1800, 'paid_at' => now(),
        'shipping_name' => 'Dana Lee', 'shipping_line1' => '1 High St',
        'shipping_city' => 'London', 'shipping_postal_code' => 'E1 6AN', 'shipping_country' => 'GB',
    ]);
    $product = Product::create([
        'studio_id' => $studio->id, 'price_sheet_id' => labSheet($studio)->id, 'type' => 'print',
        'lab_product_key' => 'photo-print-lustre', 'name' => 'Photo Print', 'active' => true,
    ]);
    $option = $product->options()->create([
        'studio_id' => $studio->id, 'lab_sku' => 'GLOBAL-PHO-10X8', 'name' => '10×8',
        'price_cents' => 1800, 'cogs_cents' => 150, 'active' => true,
    ]);
    $order->items()->create([
        'studio_id' => $studio->id, 'product_id' => $product->id, 'option_id' => $option->id,
        'type' => 'print', 'description' => 'Photo Print — 10×8', 'qty' => 2,
        'unit_price_cents' => 1800, 'cogs_cents' => 150, 'line_total_cents' => 3600, 'fulfilment' => 'auto',
    ]);

    return $order->load('items.product', 'items.option', 'studio');
}

it('decides fulfilment per product so a sheet can mix lab, self and digital', function () {
    [$studio] = prodigiStudio();
    $sid = labSheet($studio)->id;

    $lab = Product::create(['studio_id' => $studio->id, 'price_sheet_id' => $sid, 'type' => 'print', 'lab_product_key' => 'canvas', 'name' => 'Canvas']);
    $self = Product::create(['studio_id' => $studio->id, 'price_sheet_id' => $sid, 'type' => 'print', 'name' => 'My own framed print']);
    $digital = Product::create(['studio_id' => $studio->id, 'price_sheet_id' => $sid, 'type' => 'digital', 'name' => 'Download']);

    expect($lab->fulfilmentMode())->toBe('auto')
        ->and($self->fulfilmentMode())->toBe('self')   // print, but not a lab product
        ->and($digital->fulfilmentMode())->toBe('digital');
});

it('submits a lab order to Prodigi and stores the reference', function () {
    config(['services.prodigi.key' => 'test-key', 'services.prodigi.sandbox' => true, 'services.prodigi.callback_secret' => 'cb']);
    Http::fake([
        'api.sandbox.prodigi.com/*' => Http::response([
            'outcome' => 'Created',
            'order' => ['id' => 'ord_abc123', 'status' => ['stage' => 'InProgress']],
        ], 200),
    ]);

    [$studio] = prodigiStudio();
    $order = labOrderWithItem($studio);

    app(ProdigiProvider::class)->fulfil($order, $order->items->all());

    expect($order->refresh()->lab_order_ref)->toBe('ord_abc123');

    Http::assertSent(function ($request) use ($order) {
        $body = $request->data();

        return str_contains($request->url(), '/v4.0/Orders')
            && $request->hasHeader('X-API-Key', 'test-key')
            && $body['items'][0]['sku'] === 'GLOBAL-PHO-10X8'
            && $body['items'][0]['copies'] === 2
            && $body['recipient']['address']['countryCode'] === 'GB'
            && $body['idempotencyKey'] === $order->public_id;
    });
});

it('does not resubmit an order already sent to the lab', function () {
    config(['services.prodigi.key' => 'test-key']);
    Http::fake();
    [$studio] = prodigiStudio();
    $order = labOrderWithItem($studio);
    $order->update(['lab_order_ref' => 'ord_existing']);

    app(ProdigiProvider::class)->fulfil($order, $order->items->all());

    Http::assertNothingSent();
});

it('falls back to emailing the studio when Prodigi is not configured', function () {
    config(['services.prodigi.key' => null]);
    Http::fake();
    Mail::fake();
    [$studio] = prodigiStudio();
    $order = labOrderWithItem($studio);

    app(ProdigiProvider::class)->fulfil($order, $order->items->all());

    Http::assertNothingSent();
    Mail::assertSent(ClientMessage::class);
    expect($order->refresh()->lab_order_ref)->toBeNull();
});

it('updates the order from a Prodigi status callback', function () {
    config(['services.prodigi.callback_secret' => 'sek']);
    [$studio] = prodigiStudio();
    $order = labOrderWithItem($studio);
    $order->update(['lab_order_ref' => 'ord_zzz']);

    $this->postJson(route('prodigi.callback', 'sek'), [
        'type' => 'com.prodigi.order.status.stage.changed#Complete',
        'subject' => 'ord_zzz',
        'data' => [
            'id' => 'ord_zzz',
            'status' => ['stage' => 'Complete'],
            'shipments' => [['carrier' => ['name' => 'DPD'], 'tracking' => ['number' => 'TRK1', 'url' => 'https://track/TRK1']]],
        ],
    ])->assertOk();

    $order->refresh();
    expect($order->status)->toBe('completed')
        ->and($order->tracking_number)->toBe('TRK1')
        ->and($order->shipping_carrier)->toBe('DPD');
});

it('rejects a callback with the wrong secret', function () {
    config(['services.prodigi.callback_secret' => 'sek']);
    $this->postJson(route('prodigi.callback', 'wrong'), ['subject' => 'ord_x'])->assertNotFound();
});

it('seeds a default lab price sheet with catalogue products, idempotently', function () {
    [$studio] = prodigiStudio();

    $sheet = app(StoreDefaults::class)->seedFor($studio);
    expect($sheet)->not->toBeNull()
        ->and($sheet->fulfilment)->toBe('lab')
        ->and($sheet->is_default)->toBeTrue();

    $count = Product::withoutGlobalScopes()->where('price_sheet_id', $sheet->id)->count();
    expect($count)->toBe(count(Catalogue::defaults()));

    // Second run is a no-op.
    expect(app(StoreDefaults::class)->seedFor($studio))->toBeNull();
    expect(PriceSheet::withoutGlobalScopes()->where('studio_id', $studio->id)->count())->toBe(1);
});

it('reconciles lab COGS from a live Prodigi quote at checkout', function () {
    config(['services.prodigi.key' => 'test-key', 'services.prodigi.sandbox' => true]);
    Http::fake([
        'api.sandbox.prodigi.com/v4.0/quotes' => Http::response([
            'quotes' => [[
                'costSummary' => ['items' => ['amount' => '8.00', 'currency' => 'USD'], 'shipping' => ['amount' => '4.95', 'currency' => 'USD']],
                'items' => [['sku' => 'GLOBAL-PHO-10X8', 'copies' => 1, 'unitCost' => ['amount' => '4.00', 'currency' => 'USD']]],
            ]],
        ], 200),
    ]);

    [$studio, $user] = prodigiStudio();
    // Selling gallery with one lab product (catalogue cost estimate is 150).
    $sheet = PriceSheet::create(['studio_id' => $studio->id, 'name' => 'Prints', 'is_default' => true, 'fulfilment' => 'lab', 'currency' => 'usd']);
    $collection = Collection::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'title' => 'W', 'slug' => 'w', 'status' => 'published',
        'published_at' => now()->subDay(), 'price_sheet_id' => $sheet->id,
    ]);
    $photo = Photo::create([
        'studio_id' => $studio->id, 'collection_id' => $collection->id, 'filename' => 'a.jpg',
        'wasabi_key_original' => 'k/o.jpg', 'derivative_keys' => ['print' => 'k/p.jpg'], 'status' => 'ready', 'position' => 1,
    ]);
    $product = Product::create([
        'studio_id' => $studio->id, 'price_sheet_id' => $sheet->id, 'type' => 'print',
        'lab_product_key' => 'photo-print-lustre', 'name' => 'Photo Print', 'active' => true,
    ]);
    $option = $product->options()->create([
        'studio_id' => $studio->id, 'lab_sku' => 'GLOBAL-PHO-10X8', 'name' => '10×8',
        'price_cents' => 2000, 'cogs_cents' => 150, 'active' => true, // 150 = stale estimate
    ]);

    // Order is created (with reconciled COGS) then 403s because Stripe Connect isn't active here.
    $this->post(route('store.public.checkout', 'w'), [
        'items' => [['option_id' => $option->id, 'photo_id' => $photo->id, 'qty' => 2]],
        'customer_name' => 'Dana', 'customer_email' => 'dana@example.com',
        'shipping_name' => 'Dana', 'shipping_line1' => '1 St', 'shipping_city' => 'NYC',
        'shipping_postal_code' => '10001', 'shipping_country' => 'US',
    ])->assertForbidden();

    $order = Order::withoutGlobalScopes()->latest('id')->first();
    // 2 copies × $4.00 live unit cost = 800, + $4.95 lab shipping = 1295 (not the 2×150=300 estimate).
    expect($order->cogs_cents)->toBe(1295);

    Http::assertSent(fn ($r) => str_contains($r->url(), '/v4.0/quotes')
        && $r->data()['destinationCountryCode'] === 'US'
        && $r->data()['currencyCode'] === 'USD');
});

it('adds a lab product from the catalogue with fixed SKUs and costs', function () {
    [$studio, $user] = prodigiStudio();
    $sheet = PriceSheet::create(['studio_id' => $studio->id, 'name' => 'S', 'fulfilment' => 'lab', 'currency' => 'gbp']);

    $this->actingAs($user)->post(route('store.products.lab.store'), [
        'price_sheet_id' => $sheet->id,
        'lab_product_key' => 'canvas',
    ])->assertRedirect()->assertSessionHasNoErrors();

    $product = Product::withoutGlobalScopes()->where('lab_product_key', 'canvas')->first();
    expect($product)->not->toBeNull()
        ->and($product->fulfilmentMode())->toBe('auto');

    $catalogue = Catalogue::find('canvas');
    expect($product->options()->count())->toBe(count($catalogue['sizes']));
    expect($product->options()->first()->lab_sku)->toBe($catalogue['sizes'][0]['sku']);
});
