<?php

namespace Database\Seeders;

use App\Models\Contact;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\PaymentSchedule;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Fills jack@jackonthe.net's studio with realistic CRM + billing demo data so the
 * analytics dashboard has something to chart.
 *
 *   - ~$70,000 collected over the past 12 months (drives "earnings over time")
 *   - ~$40,000 outstanding on future instalments over the next 24 months
 *     (drives "projected earnings")
 *   - a mix of complete, partially-paid (1-2 deposits down, balance upcoming)
 *     and past-due invoices, split across 1-4 payment instalments.
 *
 * Idempotent: every record it creates is tagged, and a re-run deletes the prior
 * demo set first, so real data is never touched.
 *
 *   php artisan db:seed --class=DemoStudioSeeder
 */
class DemoStudioSeeder extends Seeder
{
    /** Instalment kinds. */
    private const PAID = 'paid';      // collected in the past -> earnings

    private const FUTURE = 'future';  // outstanding, due in the future -> projected

    private const OVERDUE = 'overdue'; // outstanding, due in the past -> overdue

    public function run(): void
    {
        $user = User::where('email', 'jack@jackonthe.net')->first();

        if (! $user || ! $user->studio) {
            $this->command->error('jack@jackonthe.net has no studio — aborting.');

            return;
        }

        $studio = $user->studio;

        // Make the tenant "current" so BelongsToStudio auto-scopes + auto-fills studio_id.
        app()->instance('current.studio.id', $studio->id);

        $this->purgePreviousDemoData($studio->id);
        $this->ensureTaxonomies();

        $statuses = ProjectStatus::pluck('id', 'label');
        $types = ProjectType::pluck('id', 'label');

        $now = Carbon::today();
        $currency = $studio->default_currency ?? 'gbp';
        $numberSeq = 1;

        foreach ($this->deals() as $deal) {
            $contact = Contact::create([
                'first_name' => $deal['client'],
                'last_name' => null,
                'email' => $deal['email'],
                'phone' => $this->fakePhone($numberSeq),
                'company' => $deal['company'] ?? null,
                'status' => 'client',
                'tags' => ['demo'],
            ]);

            $project = Project::create([
                'name' => $deal['project'],
                'event_date' => $now->copy()->addMonthsNoOverflow($deal['event']),
                'status_id' => $statuses[$deal['status']] ?? null,
                'type_id' => $types[$deal['type']] ?? null,
                'contact_id' => $contact->id,
                'notes' => 'Demo project.',
                'custom_fields' => ['demo' => true],
            ]);

            $instalments = $deal['instalments'];
            $total = array_sum(array_map(fn ($i) => $i[0], $instalments)) * 100;

            // Invoice due date = the last instalment's due date.
            $lastDue = $now->copy()->addMonthsNoOverflow(end($instalments)[2]);
            $firstDue = $now->copy()->addMonthsNoOverflow($instalments[0][2]);

            $invoice = Invoice::create([
                'contact_id' => $contact->id,
                'project_id' => $project->id,
                'number' => 'DEMO-'.str_pad((string) $numberSeq, 4, '0', STR_PAD_LEFT),
                'status' => 'draft',
                'currency' => $currency,
                'issue_date' => $firstDue->copy()->subDays(14),
                'due_date' => $lastDue,
                'event_date' => $now->copy()->addMonthsNoOverflow($deal['event']),
                'tax_rate' => 0,
                'discount_cents' => 0,
                'notes' => 'Demo invoice.',
                'payment_methods' => ['card', 'bank_transfer'],
                'sent_at' => $firstDue->copy()->subDays(14),
            ]);

            InvoiceItem::create([
                'invoice_id' => $invoice->id,
                'description' => $deal['project'].' — '.$deal['type'].' photography package',
                'quantity' => 1,
                'unit_amount_cents' => $total,
                'position' => 0,
            ]);

            foreach ($instalments as $position => [$dollars, $kind, $dueOffset]) {
                $dueDate = $now->copy()->addMonthsNoOverflow($dueOffset);

                PaymentSchedule::create([
                    'invoice_id' => $invoice->id,
                    'position' => $position,
                    'amount_cents' => $dollars * 100,
                    'due_date' => $dueDate,
                ]);

                if ($kind === self::PAID) {
                    InvoicePayment::create([
                        'invoice_id' => $invoice->id,
                        'amount_cents' => $dollars * 100,
                        'method' => 'manual',
                        'reference' => 'Demo payment',
                        // Paid a few days around the due date.
                        'paid_on' => $dueDate->copy()->addDays(2),
                    ]);
                }
            }

            // Let the model recompute totals + status from items/payments.
            $invoice->load('items', 'payments');
            $invoice->recalculateTotals();
            $invoice->save();
            $invoice->syncPaymentState();

            $numberSeq++;
        }

        $this->report($studio->id, $now);
    }

    /**
     * The demo "deals". Instalment = [dollars, kind, dueMonthOffset].
     * Past-PAID amounts total $70,000; FUTURE amounts total $40,000.
     */
    private function deals(): array
    {
        return [
            // ---- Fully complete (paid in full, in the past) ----
            ['client' => 'Sarah & Tom Whitfield', 'email' => 'sarah.whitfield@example.com', 'type' => 'Wedding', 'status' => 'Completed', 'project' => 'Whitfield Wedding', 'event' => -11,
                'instalments' => [[6500, self::PAID, -11]]],
            ['client' => 'Olivia & James Bennett', 'email' => 'olivia.bennett@example.com', 'type' => 'Wedding', 'status' => 'Completed', 'project' => 'Bennett Wedding', 'event' => -3,
                'instalments' => [[3000, self::PAID, -10], [5800, self::PAID, -3]]],
            ['client' => 'Acme Corp', 'email' => 'people@acme.example.com', 'company' => 'Acme Corp', 'type' => 'Corporate', 'status' => 'Completed', 'project' => 'Acme Team Headshots', 'event' => -2,
                'instalments' => [[3500, self::PAID, -2]]],
            ['client' => 'Emma Hartley', 'email' => 'emma.hartley@example.com', 'type' => 'Portrait', 'status' => 'Completed', 'project' => 'Hartley Portrait Session', 'event' => -8,
                'instalments' => [[1200, self::PAID, -8]]],
            ['client' => 'TechStart', 'email' => 'brand@techstart.example.com', 'company' => 'TechStart', 'type' => 'Corporate', 'status' => 'Completed', 'project' => 'TechStart Brand Shoot', 'event' => -6,
                'instalments' => [[2000, self::PAID, -7], [2000, self::PAID, -5]]],
            ['client' => 'The Hendersons', 'email' => 'henderson.family@example.com', 'type' => 'Event', 'status' => 'Completed', 'project' => 'Henderson 40th Anniversary', 'event' => -9,
                'instalments' => [[2500, self::PAID, -9]]],
            ['client' => 'Sophia Reed', 'email' => 'sophia.reed@example.com', 'type' => 'Portrait', 'status' => 'Completed', 'project' => 'Reed Maternity Shoot', 'event' => -6,
                'instalments' => [[900, self::PAID, -6]]],
            ['client' => 'Ava & Mason Clarke', 'email' => 'ava.clarke@example.com', 'type' => 'Wedding', 'status' => 'Completed', 'project' => 'Clarke Wedding', 'event' => -2,
                'instalments' => [[4000, self::PAID, -10], [4500, self::PAID, -2]]],
            ['client' => 'Bright Media', 'email' => 'studio@brightmedia.example.com', 'company' => 'Bright Media', 'type' => 'Corporate', 'status' => 'Completed', 'project' => 'Bright Media Campaign', 'event' => -3,
                'instalments' => [[4200, self::PAID, -3]]],
            ['client' => 'Lily & Jack Morrow', 'email' => 'lily.morrow@example.com', 'type' => 'Wedding', 'status' => 'Completed', 'project' => 'Morrow Wedding', 'event' => -4,
                'instalments' => [[5500, self::PAID, -11], [1500, self::PAID, -6], [1100, self::PAID, -3]]],

            // ---- Partially paid: deposit(s) down, balance still upcoming ----
            ['client' => 'Priya & Raj Patel', 'email' => 'priya.patel@example.com', 'type' => 'Wedding', 'status' => 'In progress', 'project' => 'Patel Wedding', 'event' => 3,
                'instalments' => [[2500, self::PAID, -2], [5000, self::FUTURE, 3]]],
            ['client' => 'Grace & Noah Sullivan', 'email' => 'grace.sullivan@example.com', 'type' => 'Wedding', 'status' => 'Booked', 'project' => 'Sullivan Wedding', 'event' => 5,
                'instalments' => [[3200, self::PAID, -6], [2200, self::PAID, -2], [4000, self::FUTURE, 5]]],
            ['client' => 'Chloe & Ethan Wright', 'email' => 'chloe.wright@example.com', 'type' => 'Wedding', 'status' => 'Booked', 'project' => 'Wright Wedding', 'event' => 8,
                'instalments' => [[3500, self::PAID, -1], [4500, self::FUTURE, 8]]],
            ['client' => 'Isabella & Lucas Gray', 'email' => 'isabella.gray@example.com', 'type' => 'Wedding', 'status' => 'Booked', 'project' => 'Gray Wedding', 'event' => 4,
                'instalments' => [[5000, self::PAID, -5], [1800, self::PAID, -1], [3500, self::FUTURE, 4]]],

            // ---- Past due / overdue ----
            ['client' => 'Mia & Liam Foster', 'email' => 'mia.foster@example.com', 'type' => 'Wedding', 'status' => 'In progress', 'project' => 'Foster Wedding', 'event' => -1,
                'instalments' => [[2800, self::PAID, -4], [2000, self::OVERDUE, -1]]],
            ['client' => 'GreenLeaf Co', 'email' => 'events@greenleaf.example.com', 'company' => 'GreenLeaf Co', 'type' => 'Event', 'status' => 'In progress', 'project' => 'GreenLeaf Launch Event', 'event' => -2,
                'instalments' => [[1500, self::OVERDUE, -2]]],
            ['client' => 'Zara & Omar Haddad', 'email' => 'zara.haddad@example.com', 'type' => 'Wedding', 'status' => 'In progress', 'project' => 'Haddad Engagement', 'event' => -1,
                'instalments' => [[800, self::PAID, -2], [800, self::OVERDUE, -1]]],

            // ---- Future booked (sent, awaiting first payment) ----
            ['client' => 'Natalie & Sam Brooks', 'email' => 'natalie.brooks@example.com', 'type' => 'Wedding', 'status' => 'Booked', 'project' => 'Brooks Wedding', 'event' => 12,
                'instalments' => [[3500, self::FUTURE, 11], [3000, self::FUTURE, 13]]],
            ['client' => 'Westfield Group', 'email' => 'gala@westfield.example.com', 'company' => 'Westfield Group', 'type' => 'Event', 'status' => 'Booked', 'project' => 'Westfield Annual Gala', 'event' => 2,
                'instalments' => [[2800, self::FUTURE, 2]]],
            ['client' => 'Hannah & Leo Price', 'email' => 'hannah.price@example.com', 'type' => 'Wedding', 'status' => 'Booked', 'project' => 'Price Wedding', 'event' => 21,
                'instalments' => [[2500, self::FUTURE, 20], [2200, self::FUTURE, 22]]],
            ['client' => 'Ruby & Max Turner', 'email' => 'ruby.turner@example.com', 'type' => 'Wedding', 'status' => 'Booked', 'project' => 'Turner Wedding', 'event' => 9,
                'instalments' => [[2000, self::FUTURE, 7], [1800, self::FUTURE, 9]]],
            ['client' => 'Northgate Partners', 'email' => 'marketing@northgate.example.com', 'company' => 'Northgate Partners', 'type' => 'Corporate', 'status' => 'Booked', 'project' => 'Northgate Retainer', 'event' => 4,
                'instalments' => [[1500, self::FUTURE, 4], [1200, self::FUTURE, 6], [1000, self::FUTURE, 15], [900, self::FUTURE, 18]]],
            ['client' => 'Daisy Fields Studio', 'email' => 'hello@daisyfields.example.com', 'company' => 'Daisy Fields Studio', 'type' => 'Portrait', 'status' => 'Booked', 'project' => 'Mini Session Day', 'event' => 24,
                'instalments' => [[600, self::FUTURE, 24]]],
        ];
    }

    private function ensureTaxonomies(): void
    {
        if (ProjectStatus::count() === 0) {
            ProjectStatus::seedDefaults();
        }

        if (ProjectType::count() === 0) {
            ProjectType::seedDefaults();
        }
    }

    private function purgePreviousDemoData(int $studioId): void
    {
        // Invoices cascade to items/payments/schedules via FKs.
        Invoice::where('studio_id', $studioId)->where('number', 'like', 'DEMO-%')->get()
            ->each(fn (Invoice $i) => $i->delete());

        Project::where('studio_id', $studioId)
            ->whereJsonContains('custom_fields->demo', true)->delete();

        Contact::where('studio_id', $studioId)
            ->whereJsonContains('tags', 'demo')->delete();
    }

    private function fakePhone(int $seq): string
    {
        return '+1 (555) '.str_pad((string) (100 + $seq), 3, '0', STR_PAD_LEFT).'-'.str_pad((string) ($seq * 7 % 10000), 4, '0', STR_PAD_LEFT);
    }

    private function report(int $studioId, Carbon $now): void
    {
        $paidLast12 = InvoicePayment::whereHas('invoice', fn ($q) => $q->where('studio_id', $studioId)->where('number', 'like', 'DEMO-%'))
            ->where('paid_on', '>=', $now->copy()->subMonths(12))
            ->sum('amount_cents');

        $futureOutstanding = 0;
        $overdue = 0;
        Invoice::where('studio_id', $studioId)->where('number', 'like', 'DEMO-%')
            ->with('schedules')->get()->each(function (Invoice $inv) use (&$futureOutstanding, &$overdue, $now) {
                foreach ($inv->reminderTargets() as $t) {
                    if ($t['due_date']->gte($now)) {
                        $futureOutstanding += $t['amount_cents'];
                    } else {
                        $overdue += $t['amount_cents'];
                    }
                }
            });

        $this->command->info('Demo data seeded for studio '.$studioId.':');
        $this->command->line('  Collected (last 12 mo):  $'.number_format($paidLast12 / 100, 2));
        $this->command->line('  Projected (future):      $'.number_format($futureOutstanding / 100, 2));
        $this->command->line('  Overdue (outstanding):   $'.number_format($overdue / 100, 2));
    }
}
