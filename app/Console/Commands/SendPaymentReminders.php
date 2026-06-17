<?php

namespace App\Console\Commands;

use App\Mail\PaymentReminder;
use App\Models\Invoice;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendPaymentReminders extends Command
{
    protected $signature = 'invoices:send-payment-reminders';

    protected $description = 'Email payment reminders for outstanding invoice instalments based on each invoice\'s reminder offsets.';

    public function handle(): int
    {
        $today = Carbon::today();
        $sentCount = 0;

        // Cross-tenant: reminders run for every studio, so skip the studio scope.
        $invoices = Invoice::withoutGlobalScopes()
            ->whereIn('status', ['sent', 'partial'])
            ->whereNotNull('reminder_offsets')
            ->with(['schedules', 'contact', 'studio'])
            ->get();

        foreach ($invoices as $invoice) {
            $offsets = $invoice->reminder_offsets ?: [];
            $email = $invoice->contact?->email;

            if (empty($offsets) || ! $email) {
                continue;
            }

            $alreadySent = $invoice->reminders_sent ?? [];
            $changed = false;

            foreach ($invoice->reminderTargets() as $target) {
                foreach ($offsets as $offset) {
                    $remindOn = $target['due_date']->copy()->addDays($offset);

                    if (! $remindOn->isSameDay($today)) {
                        continue;
                    }

                    $key = "{$target['key']}:{$offset}";
                    if (in_array($key, $alreadySent, true)) {
                        continue;
                    }

                    try {
                        Mail::to($email)->send(new PaymentReminder(
                            invoice: $invoice,
                            amountCents: $target['amount_cents'],
                            dueDate: $target['due_date'],
                            offsetDays: $offset,
                        ));

                        $alreadySent[] = $key;
                        $changed = true;
                        $sentCount++;
                    } catch (\Throwable $e) {
                        Log::error("Payment reminder failed for invoice {$invoice->id}: {$e->getMessage()}");
                    }
                }
            }

            if ($changed) {
                $invoice->reminders_sent = $alreadySent;
                $invoice->saveQuietly();
            }
        }

        $this->info("Sent {$sentCount} payment reminder(s).");

        return self::SUCCESS;
    }
}
