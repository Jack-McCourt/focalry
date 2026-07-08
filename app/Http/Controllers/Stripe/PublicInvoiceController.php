<?php

namespace App\Http\Controllers\Stripe;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Stripe\StripeClient;

class PublicInvoiceController extends Controller
{
    public function show(string $publicId): Response
    {
        $invoice = $this->resolve($publicId);
        $studio = $invoice->studio;

        $methods = $invoice->payment_methods ?? $studio?->invoiceSettings()['payment_methods'] ?? ['card'];

        $canPayOnline = in_array('card', $methods, true)
            && $studio?->stripe_connect_status === 'active'
            && $invoice->status !== 'void'
            && $invoice->balanceCents() > 0;

        $showBankDetails = in_array('bank_transfer', $methods, true)
            && $invoice->status !== 'void'
            && $invoice->balanceCents() > 0
            && filled($studio?->invoiceSettings()['bank_details'] ?? null);

        // Remaining (unpaid) instalments — allocate payments in order so the client
        // can pick one or more outstanding payments to settle at once.
        $allocated = (int) $invoice->amount_paid_cents;
        $outstandingSchedules = [];
        foreach ($invoice->schedules as $s) {
            $covered = min($allocated, (int) $s->amount_cents);
            $allocated -= $covered;
            $remaining = (int) $s->amount_cents - $covered;
            if ($remaining > 0) {
                $outstandingSchedules[] = [
                    'amount_cents' => $remaining,
                    'due_date' => $s->due_date?->toDateString(),
                ];
            }
        }

        return Inertia::render('Invoices/Public', [
            'invoice' => [
                'number' => $invoice->number,
                'public_id' => $invoice->public_id,
                'status' => $invoice->status,
                'currency' => $invoice->currency,
                'issue_date' => $invoice->issue_date?->toDateString(),
                'due_date' => $invoice->due_date?->toDateString(),
                'subtotal_cents' => $invoice->subtotal_cents,
                'discount_cents' => $invoice->discount_cents,
                'tax_rate' => $invoice->tax_rate,
                'tax_cents' => $invoice->tax_cents,
                'total_cents' => $invoice->total_cents,
                'amount_paid_cents' => $invoice->amount_paid_cents,
                'balance_cents' => $invoice->balanceCents(),
                'payable_cents' => $invoice->payableCents(),
                'notes' => $invoice->notes,
                'items' => $invoice->items->map(fn ($i) => [
                    'description' => $i->description,
                    'quantity' => $i->quantity,
                    'unit_amount_cents' => $i->unit_amount_cents,
                ]),
                'schedules' => $invoice->schedules->map(fn ($s) => [
                    'amount_cents' => $s->amount_cents,
                    'due_date' => $s->due_date?->toDateString(),
                ]),
                'outstanding_schedules' => $outstandingSchedules,
            ],
            'studio_name' => $studio?->name,
            'studio_logo' => $studio?->logoUrl(),
            'studio_logo_size' => $studio?->logoSize(),
            'bill_to' => $invoice->contact ? [
                'name' => $invoice->contact->name,
                'email' => $invoice->contact->email,
            ] : null,
            'can_pay_online' => $canPayOnline,
            'bank_details' => $showBankDetails ? $studio->invoiceSettings()['bank_details'] : null,
        ]);
    }

    public function pdf(string $publicId): RedirectResponse|\Symfony\Component\HttpFoundation\Response
    {
        $invoice = $this->resolve($publicId);
        $studio = $invoice->studio;

        try {
            $pdf = Pdf::loadView('invoices.pdf', [
                'invoice' => $invoice,
                'studio' => $studio,
                'logoPath' => $studio?->logoPath(),
            ]);

            return $pdf->download("Invoice-{$invoice->number}.pdf");
        } catch (\Throwable $e) {
            report($e);

            return redirect()
                ->route('invoices.public.show', $invoice->public_id)
                ->with('error', 'Sorry, the PDF could not be generated right now. Please try again.');
        }
    }

    public function checkout(Request $request, string $publicId): RedirectResponse|\Symfony\Component\HttpFoundation\Response
    {
        $invoice = $this->resolve($publicId);
        $studio = $invoice->studio;

        $methods = $invoice->payment_methods ?? $studio?->invoiceSettings()['payment_methods'] ?? ['card'];

        abort_unless(
            in_array('card', $methods, true)
                && $studio?->stripe_connect_status === 'active'
                && $invoice->status !== 'void'
                && $invoice->balanceCents() > 0,
            403,
            'This invoice cannot be paid online.',
        );

        $request->validate(['amount_cents' => 'nullable|integer|min:1']);

        // Custom amount if supplied (clamped to the outstanding balance), else the
        // next instalment / full balance.
        $requested = (int) $request->input('amount_cents', 0);
        $amount = $requested > 0
            ? min($requested, $invoice->balanceCents())
            : $invoice->payableCents();
        $fee = (int) round($amount * $studio->effectiveCommissionRate() / 100);

        // Direct charge: the charge is created ON the photographer's connected
        // account (merchant of record), so dispute/refund liability sits with
        // them. We take our cut via application_fee_amount.
        $paymentIntentData = [
            'metadata' => ['invoice_id' => $invoice->id],
        ];
        if ($fee > 0) {
            $paymentIntentData['application_fee_amount'] = $fee;
        }

        $stripe = new StripeClient(config('services.stripe.secret'));

        try {
            $session = $stripe->checkout->sessions->create([
                'mode' => 'payment',
                'line_items' => [[
                    'price_data' => [
                        'currency' => $invoice->currency,
                        'product_data' => ['name' => "Invoice {$invoice->number}".($studio->name ? " — {$studio->name}" : '')],
                        'unit_amount' => $amount,
                    ],
                    'quantity' => 1,
                ]],
                'payment_intent_data' => $paymentIntentData,
                'metadata' => ['invoice_id' => $invoice->id],
                'success_url' => route('invoices.public.show', $invoice->public_id).'?paid=1',
                'cancel_url' => route('invoices.public.show', $invoice->public_id),
            ], ['stripe_account' => $studio->stripe_connect_id]);
        } catch (\Throwable $e) {
            report($e);

            return redirect()
                ->route('invoices.public.show', $invoice->public_id)
                ->with('error', 'Sorry, we couldn’t start the payment. Please try again or contact the studio.');
        }

        return Inertia::location($session->url);
    }

    private function resolve(string $publicId): Invoice
    {
        return Invoice::withoutGlobalScopes()
            ->with(['items', 'schedules', 'studio', 'contact'])
            ->where('public_id', $publicId)
            ->firstOrFail();
    }
}
