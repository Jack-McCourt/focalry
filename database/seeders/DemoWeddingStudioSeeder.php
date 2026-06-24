<?php

namespace Database\Seeders;

use App\Models\Contact;
use App\Models\Contract;
use App\Models\ContractSignature;
use App\Models\ContractTemplate;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Meeting;
use App\Models\MeetingType;
use App\Models\Package;
use App\Models\PackageBooking;
use App\Models\PaymentSchedule;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ProjectType;
use App\Models\Proposal;
use App\Models\Questionnaire;
use App\Models\QuestionnaireTemplate;
use App\Models\Site;
use App\Models\SiteLead;
use App\Models\SitePage;
use App\Models\SiteVisit;
use App\Models\Studio;
use App\Models\Task;
use App\Models\TaskTemplate;
use App\Models\TaskTemplateItem;
use App\Models\User;
use App\Models\Workflow;
use App\Models\WorkflowStep;
use App\Support\SiteTemplates;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * A self-contained demo account for a UK wedding photographer.
 *
 * Creates a login (demo@studio.test / password) with a studio that's filled out
 * the way a real user would: three sellable packages (£1,000 half day / £1,500
 * full day / £2,000 deluxe), a CRM full of leads → booked → completed projects,
 * package bookings, invoices with payments, a few automations, task checklists,
 * a questionnaire and a published website.
 *
 * Idempotent — re-running wipes the previous demo studio first, so it never
 * touches any other account.
 *
 *   php artisan db:seed --class=DemoWeddingStudioSeeder
 */
class DemoWeddingStudioSeeder extends Seeder
{
    private const EMAIL = 'demo@studio.test';

    private const PASSWORD = 'password';

    /** Package keys → [name, price £, deposit £, blurb]. */
    private const PACKAGES = [
        'half' => ['Half Day Collection', 1000, 250, 'Up to 5 hours of coverage — perfect for intimate weddings and elopements.'],
        'full' => ['Full Day Collection', 1500, 400, 'Full-day coverage from bridal prep to first dance, with a second shooter.'],
        'deluxe' => ['Deluxe Collection', 2000, 500, 'Two photographers, an engagement shoot, a fine-art album and a USB keepsake.'],
    ];

    private Carbon $today;

    /** @var array<string,int> label → ProjectStatus id */
    private array $statuses = [];

    /** @var array<string,int> label → ProjectType id */
    private array $types = [];

    /** @var array<string,Package> */
    private array $packages = [];

    private int $invoiceSeq = 1000;

    private int $phoneSeq = 0;

    /** @var array<int,Contact> lead/enquiry contacts, for scheduling consultation calls */
    private array $leadContacts = [];

    public function run(): void
    {
        $this->today = Carbon::today();

        $this->purgePrevious();

        $studio = Studio::create([
            'name' => 'Evergreen & Oak Photography',
            'slug' => 'evergreen-oak-'.Str::lower(Str::random(5)),
            'email' => self::EMAIL,
            'address_line1' => '14 Meadow Lane',
            'city' => 'Bath',
            'region' => 'Somerset',
            'postal_code' => 'BA1 2AB',
            'country' => 'GB',
            'default_currency' => 'gbp',
            'plan' => 'plus', // unlock studio manager / website / store
            'commission_rate' => 0,
        ]);

        $user = User::create([
            'studio_id' => $studio->id,
            'name' => 'Alex Rivers',
            'email' => self::EMAIL,
            'password' => Hash::make(self::PASSWORD),
            'role' => 'owner',
            'email_verified_at' => now(),
        ]);

        // Make the tenant "current" so BelongsToStudio auto-scopes everything below.
        app()->instance('current.studio.id', $studio->id);

        ProjectStatus::seedDefaults();
        ProjectType::seedDefaults();
        $this->statuses = ProjectStatus::pluck('id', 'label')->all();
        $this->types = ProjectType::pluck('id', 'label')->all();

        $this->seedPackages($studio);
        QuestionnaireTemplate::seedDefaults();
        ContractTemplate::seedDefaults();
        $qTemplate = QuestionnaireTemplate::first();
        $contractTpl = ContractTemplate::defaults()[0]; // the "Wedding Photography" template
        $taskTemplate = $this->seedTaskTemplate();
        $meetingType = $this->seedMeetingType();
        $site = $this->seedWebsite($studio);
        $this->seedDeals($studio, $site, $taskTemplate, $qTemplate, $contractTpl);
        $this->seedMeetings($meetingType);
        $this->seedAutomations($taskTemplate, $qTemplate);
        $this->seedTraffic($studio, $site);

        $this->command->info("Demo studio ready. Log in as {$user->email} / ".self::PASSWORD);
    }

    // ── Packages ─────────────────────────────────────────────────────────────

    private function seedPackages(Studio $studio): void
    {
        $sort = 0;
        foreach (self::PACKAGES as $key => [$name, $price, $deposit, $blurb]) {
            $this->packages[$key] = Package::create([
                'name' => $name,
                'description' => $blurb,
                'details' => "What's included:\n• Pre-wedding consultation\n• Online gallery of high-resolution images\n• Personal printing rights",
                'price_cents' => $price * 100,
                'deposit_cents' => $deposit * 100,
                'currency' => 'gbp',
                'active' => true,
                'sort_order' => $sort++,
            ]);
        }
    }

    // ── Task checklist template ──────────────────────────────────────────────

    private function seedTaskTemplate(): TaskTemplate
    {
        $template = TaskTemplate::create(['name' => 'Wedding production checklist']);

        $items = [
            ['Send welcome email & questionnaire', -120],
            ['Pre-wedding consultation call', -30],
            ['Confirm timeline & shot list', -7],
            ['Pack & charge gear', -1],
            ['Wedding day — shoot', 0],
            ['Back up & cull images', 2],
            ['Deliver sneak peeks', 5],
            ['Deliver full gallery', 21],
            ['Request a review', 35],
        ];
        foreach ($items as $i => [$title, $offset]) {
            TaskTemplateItem::create([
                'task_template_id' => $template->id,
                'title' => $title,
                'offset_days' => $offset,
                'position' => $i,
            ]);
        }

        return $template;
    }

    // ── Website ──────────────────────────────────────────────────────────────

    private function seedWebsite(Studio $studio): Site
    {
        $template = SiteTemplates::DEFAULT;

        $site = Site::create([
            'studio_id' => $studio->id,
            'name' => $studio->name,
            'slug' => 'evergreen-oak',
            'template' => $template,
            'theme' => SiteTemplates::theme($template),
            'header_nav' => SiteTemplates::headerNav($template),
            'footer_nav' => SiteTemplates::footerNav($template),
            'contact_email' => self::EMAIL,
            'seo_title' => 'Evergreen & Oak — Wedding Photography in Bath',
            'seo_description' => 'Natural, timeless wedding photography across the South West. Half-day, full-day and deluxe collections.',
            'is_published' => true,
            'published_at' => now(),
        ]);

        $blogPageId = null;
        foreach (SiteTemplates::pages($template, $studio->name) as $i => $page) {
            $created = $site->pages()->create([
                'studio_id' => $studio->id,
                'title' => $page['title'],
                'slug' => $page['slug'],
                'is_home' => $page['is_home'] ?? false,
                'is_blog' => $page['is_blog'] ?? false,
                'position' => $i,
                'blocks' => $page['blocks'],
            ]);
            if ($created->is_blog) {
                $blogPageId = $created->id;
            }
        }

        if ($blogPageId) {
            foreach (SiteTemplates::posts($template) as $i => $post) {
                $site->pages()->create([
                    'studio_id' => $studio->id,
                    'parent_id' => $blogPageId,
                    'title' => $post['title'],
                    'slug' => $post['slug'],
                    'position' => $i,
                    'blocks' => $post['blocks'],
                    'status' => $post['status'] ?? 'published',
                    'published_at' => isset($post['days_ago']) ? now()->subDays($post['days_ago']) : now(),
                    'excerpt' => $post['excerpt'] ?? null,
                    'cover_image' => $post['cover_image'] ?? null,
                ]);
            }
        }

        return $site;
    }

    // ── CRM: leads → booked → completed, with bookings + invoices ────────────

    private function seedDeals(Studio $studio, Site $site, TaskTemplate $taskTemplate, ?QuestionnaireTemplate $qTemplate, array $contractTpl): void
    {
        foreach ($this->deals() as $deal) {
            [$first, $last] = $this->splitNames($deal['client']);
            $isEnquiry = in_array($deal['status'], ['Lead', 'Enquiry'], true);

            $contact = Contact::create([
                'first_name' => $first,
                'last_name' => $last,
                'email' => $deal['email'],
                'phone' => $this->fakePhone(),
                'status' => $isEnquiry ? 'lead' : 'client',
                'notes' => 'Demo contact.',
                'tags' => ['demo'],
            ]);

            $eventDate = $this->today->copy()->addMonthsNoOverflow($deal['event']);

            $project = Project::create([
                'name' => $deal['client'].' Wedding',
                'event_date' => $eventDate,
                'status_id' => $this->statuses[$deal['status']] ?? null,
                'type_id' => $this->types['Wedding'] ?? null,
                'contact_id' => $contact->id,
                'notes' => $deal['note'] ?? 'Demo project.',
                'custom_fields' => ['demo' => true],
            ]);

            // Leads & enquiries came in via the website contact form.
            if ($isEnquiry) {
                $this->leadContacts[] = $contact;

                SiteLead::create([
                    'site_id' => $site->id,
                    'contact_id' => $contact->id,
                    'project_id' => $project->id,
                    'name' => $deal['client'],
                    'email' => $deal['email'],
                    'phone' => $contact->phone,
                    'event_date' => $eventDate,
                    'event_type' => 'Wedding',
                    'message' => $deal['note'] ?? 'We loved your portfolio and would love a quote!',
                    'payload' => ['demo' => true],
                ]);

                // Enquiries get a proposal out the door (some accepted later, some declined).
                if ($deal['status'] === 'Enquiry') {
                    $this->createProposal($project, $contact, $this->packages['full'], null, null, $deal['proposal'] ?? 'sent', $eventDate);
                }

                continue;
            }

            // Booked / in-progress / completed get the full paperwork set.
            $pkg = $this->packages[$deal['package']];
            $this->createBooking($pkg, $contact, $project, $deal);
            $invoice = $this->createInvoice($pkg, $contact, $project, $deal, $eventDate);
            $contract = $this->createContract($project, $contact, $deal, $contractTpl, $eventDate);
            $this->createQuestionnaire($project, $contact, $qTemplate, $deal, $eventDate);
            $this->createProposal($project, $contact, $pkg, $contract, $invoice, 'accepted', $eventDate);

            // Active jobs get the production checklist.
            if (in_array($deal['status'], ['Booked', 'In progress'], true)) {
                $taskTemplate->applyTo($project);
            }
        }
    }

    // ── Contracts ────────────────────────────────────────────────────────────

    private function createContract(Project $project, Contact $contact, array $deal, array $tpl, Carbon $eventDate): Contract
    {
        // Booked & beyond are signed, except one explicitly left awaiting signature.
        $status = $deal['contract'] ?? 'signed';
        $signed = $status === 'signed';
        $sentAt = $eventDate->copy()->subMonths(6);

        $values = [
            'partner_name' => $this->partnerName($deal['client']),
            'client_email' => $contact->email,
            'event_date' => $eventDate->format('jS F Y'),
            'venue_name' => $deal['venue'] ?? 'The Walled Garden',
            'venue_address' => 'Bath, Somerset',
            'start_time' => '1:00 PM',
            'coverage_hours' => '8',
            'delivery_weeks' => '6',
        ];
        $fields = array_map(fn (array $f) => array_merge($f, ['value' => $values[$f['key']] ?? $f['value']]), $tpl['fields']);

        $contract = Contract::create([
            'project_id' => $project->id,
            'contact_id' => $contact->id,
            'title' => $project->name.' — Photography Agreement',
            'body' => $tpl['body'],
            'fields' => $fields,
            'status' => $status,
            'sent_at' => $sentAt,
            'signed_at' => $signed ? $sentAt->copy()->addDays(3) : null,
        ]);

        if ($signed) {
            foreach ([['client', $deal['client']], ['studio', 'Alex Rivers']] as [$role, $name]) {
                ContractSignature::create([
                    'studio_id' => $project->studio_id,
                    'contract_id' => $contract->id,
                    'role' => $role,
                    'signer_name' => $name,
                    'signature_type' => 'typed',
                    'signature_data' => $name,
                    'signed_at' => $contract->signed_at,
                    'ip_address' => '81.2.69.142',
                ]);
            }
        }

        return $contract;
    }

    // ── Questionnaires ───────────────────────────────────────────────────────

    private function createQuestionnaire(Project $project, Contact $contact, ?QuestionnaireTemplate $tpl, array $deal, Carbon $eventDate): void
    {
        if (! $tpl) {
            return;
        }

        $completed = in_array($deal['status'], ['Completed', 'In progress'], true);
        $sentAt = $eventDate->copy()->subMonths(5);

        $answers = $completed ? [
            'partner_names' => $deal['client'],
            'ceremony_venue' => ($deal['venue'] ?? 'The Walled Garden').', Bath',
            'reception_venue' => 'The Old Barn, nearby',
            'ceremony_time' => '1:00 PM',
            'guest_count' => (string) (80 + ($this->phoneSeq * 7 % 80)),
            'getting_ready' => 'The Manor House, both suites',
            'planner' => 'Self-planned',
            'must_have_shots' => 'Family group shots, golden-hour couple portraits, the first dance.',
            'first_look' => true,
        ] : null;

        Questionnaire::create([
            'project_id' => $project->id,
            'contact_id' => $contact->id,
            'questionnaire_template_id' => $tpl->id,
            'title' => $tpl->name,
            'status' => $completed ? 'completed' : 'sent',
            'questions' => $tpl->questions,
            'answers' => $answers,
            'sent_at' => $sentAt,
            'completed_at' => $completed ? $sentAt->copy()->addDays(4) : null,
        ]);
    }

    // ── Proposals ────────────────────────────────────────────────────────────

    private function createProposal(Project $project, Contact $contact, Package $pkg, ?Contract $contract, ?Invoice $invoice, string $status, Carbon $eventDate): void
    {
        $sentAt = $eventDate->copy()->subMonths(7);

        Proposal::create([
            'project_id' => $project->id,
            'contact_id' => $contact->id,
            'package_id' => $pkg->id,
            'contract_id' => $contract?->id,
            'invoice_id' => $invoice?->id,
            'title' => 'Your wedding photography proposal',
            'status' => $status,
            'intro' => "Hi {$contact->first_name},\n\nThank you so much for considering Evergreen & Oak for your wedding. Here's everything in one place — your collection, the agreement and how to secure your date.",
            'require_signature' => true,
            'require_deposit' => true,
            'sent_at' => $sentAt,
            'accepted_at' => $status === 'accepted' ? $sentAt->copy()->addDays(5) : null,
            'declined_at' => $status === 'declined' ? $sentAt->copy()->addDays(9) : null,
        ]);
    }

    // ── Meetings (consultation calls) ────────────────────────────────────────

    private function seedMeetingType(): MeetingType
    {
        return MeetingType::create([
            'name' => 'Consultation call',
            'slug' => 'consultation',
            'description' => 'A relaxed 30-minute video call to chat through your wedding day and answer any questions.',
            'duration_minutes' => 30,
            'location_type' => 'video',
            'video_provider' => 'google_meet',
            'color' => '#6366f1',
            'buffer_minutes' => 15,
            'min_lead_hours' => 24,
            'max_per_day' => 4,
            'manual_approve' => false,
            'active' => true,
        ]);
    }

    private function seedMeetings(MeetingType $type): void
    {
        // [days offset from today, status]
        $slots = [
            [3, 'confirmed'],
            [6, 'confirmed'],
            [1, 'pending'],
            [-9, 'confirmed'],
        ];

        foreach ($slots as $i => [$offset, $status]) {
            $contact = $this->leadContacts[$i] ?? null;
            if (! $contact) {
                continue;
            }
            $starts = $this->today->copy()->addDays($offset)->setTime(10 + $i, 0);

            Meeting::create([
                'meeting_type_id' => $type->id,
                'contact_id' => $contact->id,
                'client_name' => $contact->name,
                'client_email' => $contact->email,
                'client_phone' => $contact->phone,
                'starts_at' => $starts,
                'ends_at' => $starts->copy()->addMinutes($type->duration_minutes),
                'status' => $status,
                'location' => 'Google Meet',
                'meeting_url' => 'https://meet.google.com/demo-'.Str::lower(Str::random(6)),
                'notes' => 'Consultation call booked via the public scheduling page.',
            ]);
        }
    }

    private function createBooking(Package $pkg, Contact $contact, Project $project, array $deal): void
    {
        $deposit = $deal['paid'] === 'deposit';
        PackageBooking::create([
            'package_id' => $pkg->id,
            'contact_id' => $contact->id,
            'project_id' => $project->id,
            'client_name' => $deal['client'],
            'client_email' => $deal['email'],
            'client_phone' => $contact->phone,
            'amount_cents' => $deposit ? $pkg->deposit_cents : $pkg->price_cents,
            'payment_type' => $deposit ? 'deposit' : 'full',
            'currency' => 'gbp',
            'status' => 'paid',
            'notes' => 'Booked via the online packages page.',
        ]);
    }

    private function createInvoice(Package $pkg, Contact $contact, Project $project, array $deal, Carbon $eventDate): Invoice
    {
        $total = $pkg->price_cents;
        $deposit = $pkg->deposit_cents;
        $balance = $total - $deposit;

        $issue = $eventDate->copy()->subMonths(6);

        $invoice = Invoice::create([
            'contact_id' => $contact->id,
            'project_id' => $project->id,
            'number' => 'INV-'.(++$this->invoiceSeq),
            'status' => 'draft',
            'currency' => 'gbp',
            'issue_date' => $issue,
            'due_date' => $eventDate->copy()->subDays(14),
            'event_date' => $eventDate,
            'tax_rate' => 0,
            'discount_cents' => 0,
            'notes' => 'Thank you for booking with Evergreen & Oak!',
            'payment_methods' => ['card', 'bank_transfer'],
            'sent_at' => $issue,
        ]);

        InvoiceItem::create([
            'invoice_id' => $invoice->id,
            'description' => $pkg->name.' — wedding photography',
            'quantity' => 1,
            'unit_amount_cents' => $total,
            'position' => 0,
        ]);

        // Two-instalment schedule: deposit on booking, balance before the event.
        PaymentSchedule::create(['invoice_id' => $invoice->id, 'position' => 0, 'amount_cents' => $deposit, 'due_date' => $issue]);
        PaymentSchedule::create(['invoice_id' => $invoice->id, 'position' => 1, 'amount_cents' => $balance, 'due_date' => $eventDate->copy()->subDays(14)]);

        // Record payments depending on where the job is in its lifecycle.
        if ($deal['status'] === 'Completed') {
            $this->pay($invoice, $deposit, $issue->copy()->addDays(2));
            $this->pay($invoice, $balance, $eventDate->copy()->subDays(10));
        } else {
            // Booked / in progress — deposit paid, balance still outstanding.
            $this->pay($invoice, $deposit, $issue->copy()->addDays(2));
        }

        $invoice->load('items', 'payments');
        $invoice->recalculateTotals();
        $invoice->save();
        $invoice->syncPaymentState();

        return $invoice;
    }

    private function pay(Invoice $invoice, int $cents, Carbon $on): void
    {
        InvoicePayment::create([
            'invoice_id' => $invoice->id,
            'amount_cents' => $cents,
            'method' => 'card',
            'reference' => 'Demo payment',
            'paid_on' => $on,
        ]);
    }

    // ── Automations ──────────────────────────────────────────────────────────

    private function seedAutomations(TaskTemplate $taskTemplate, ?QuestionnaireTemplate $questionnaire): void
    {
        // 1) New enquiry → reply fast + create a follow-up task.
        $lead = Workflow::create([
            'name' => 'New enquiry follow-up',
            'description' => 'Reply to website enquiries and remind me to call.',
            'trigger' => 'project_created',
            'is_active' => true,
        ]);
        $this->step($lead, 0, 'send_email', [
            'subject' => 'Thanks for your enquiry — Evergreen & Oak',
            'body' => "Hi {{client_name}},\n\nThank you so much for getting in touch about your wedding! I'd love to hear more about your day. Are you free for a quick call this week?\n\nWarmly,\nAlex",
        ], delay: 0);
        $this->step($lead, 1, 'create_task', ['title' => 'Call new enquiry', 'offset_days' => 1], delay: 0);

        // 2) Booking confirmed → onboard the couple.
        $booked = Workflow::create([
            'name' => 'Booking confirmed onboarding',
            'description' => 'When a couple is marked Booked, kick off onboarding.',
            'trigger' => 'project_status_changed',
            'trigger_status_id' => $this->statuses['Booked'] ?? null,
            'is_active' => true,
        ]);
        $this->step($booked, 0, 'send_email', [
            'subject' => "You're booked in! 🎉",
            'body' => "Hi {{client_name}},\n\nWe're officially booked for your wedding — I can't wait! I've sent over a short questionnaire so I can start planning your coverage.\n\nAlex",
        ], delay: 0);
        if ($questionnaire) {
            $this->step($booked, 1, 'send_questionnaire', ['template_id' => $questionnaire->id], delay: 0);
        }
        $this->step($booked, 2, 'apply_task_template', ['template_id' => $taskTemplate->id], delay: 0);

        // 3) Two weeks before the wedding → final details reminder.
        $prep = Workflow::create([
            'name' => 'Final details reminder',
            'description' => 'Two weeks before the wedding, confirm the timeline.',
            'trigger' => 'project_status_changed',
            'trigger_status_id' => $this->statuses['Booked'] ?? null,
            'is_active' => true,
        ]);
        $this->stepBeforeEvent($prep, 0, 'send_email', [
            'subject' => 'Two weeks to go — final details',
            'body' => "Hi {{client_name}},\n\nNot long now! Could you confirm your final timeline and any must-have shots? Excited for your big day.\n\nAlex",
        ], weeks: 2);
    }

    private function step(Workflow $wf, int $pos, string $action, array $config, int $delay): void
    {
        WorkflowStep::create([
            'workflow_id' => $wf->id,
            'position' => $pos,
            'action' => $action,
            'config' => $config,
            'schedule_mode' => 'after_trigger',
            'offset_value' => 0,
            'offset_unit' => 'day',
            'delay_days' => $delay,
        ]);
    }

    private function stepBeforeEvent(Workflow $wf, int $pos, string $action, array $config, int $weeks): void
    {
        WorkflowStep::create([
            'workflow_id' => $wf->id,
            'position' => $pos,
            'action' => $action,
            'config' => $config,
            'schedule_mode' => 'before_event',
            'offset_value' => $weeks,
            'offset_unit' => 'week',
            'delay_days' => 0,
        ]);
    }

    // ── Website traffic (drives the analytics dashboard) ─────────────────────

    private function seedTraffic(Studio $studio, Site $site): void
    {
        $paths = ['/', '/', '/', 'about', 'investment', 'portfolio', 'contact', 'journal'];
        $referrers = ['google.com', 'instagram.com', null, null, 'pinterest.com', 'facebook.com'];
        $rows = [];

        for ($d = 29; $d >= 0; $d--) {
            $count = random_int(3, 22);
            for ($i = 0; $i < $count; $i++) {
                $rows[] = [
                    'studio_id' => $studio->id,
                    'site_id' => $site->id,
                    'path' => $paths[array_rand($paths)],
                    'referrer_host' => $referrers[array_rand($referrers)],
                    'created_at' => $this->today->copy()->subDays($d)->addMinutes(random_int(0, 1439)),
                ];
            }
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            SiteVisit::insert($chunk);
        }
    }

    // ── The demo deals ───────────────────────────────────────────────────────

    /** @return array<int, array<string, mixed>> */
    private function deals(): array
    {
        return [
            // ---- New leads / enquiries (no booking yet) ----
            ['client' => 'Holly & Daniel', 'email' => 'holly.daniel@example.com', 'status' => 'Lead', 'event' => 14, 'note' => 'Found you on Instagram — barn wedding next summer!'],
            ['client' => 'Amara & Joel', 'email' => 'amara.joel@example.com', 'status' => 'Lead', 'event' => 11, 'note' => 'Looking for full-day coverage, ~120 guests.'],
            ['client' => 'Freya & Tom', 'email' => 'freya.tom@example.com', 'status' => 'Lead', 'event' => 9],
            ['client' => 'Nadia & Sam', 'email' => 'nadia.sam@example.com', 'status' => 'Enquiry', 'event' => 7, 'note' => 'Comparing the full day vs deluxe collections.', 'proposal' => 'sent'],
            ['client' => 'Beth & Carlos', 'email' => 'beth.carlos@example.com', 'status' => 'Enquiry', 'event' => 13, 'proposal' => 'declined', 'note' => 'Went with a family friend in the end.'],

            // ---- Booked (future), deposit paid ----
            ['client' => 'Grace & Noah', 'email' => 'grace.noah@example.com', 'status' => 'Booked', 'event' => 5, 'package' => 'full', 'paid' => 'deposit'],
            ['client' => 'Priya & Raj', 'email' => 'priya.raj@example.com', 'status' => 'Booked', 'event' => 8, 'package' => 'deluxe', 'paid' => 'deposit'],
            ['client' => 'Chloe & Ethan', 'email' => 'chloe.ethan@example.com', 'status' => 'Booked', 'event' => 3, 'package' => 'full', 'paid' => 'deposit'],
            ['client' => 'Isabella & Lucas', 'email' => 'bella.lucas@example.com', 'status' => 'Booked', 'event' => 10, 'package' => 'half', 'paid' => 'deposit', 'contract' => 'sent'],

            // ---- In progress (just happened, balance outstanding) ----
            ['client' => 'Mia & Liam', 'email' => 'mia.liam@example.com', 'status' => 'In progress', 'event' => -1, 'package' => 'full', 'paid' => 'deposit', 'note' => 'Editing the gallery now.'],
            ['client' => 'Zara & Omar', 'email' => 'zara.omar@example.com', 'status' => 'In progress', 'event' => -1, 'package' => 'deluxe', 'paid' => 'deposit'],

            // ---- Completed (paid in full) ----
            ['client' => 'Sarah & Tom', 'email' => 'sarah.tomw@example.com', 'status' => 'Completed', 'event' => -3, 'package' => 'full', 'paid' => 'full'],
            ['client' => 'Olivia & James', 'email' => 'olivia.james@example.com', 'status' => 'Completed', 'event' => -6, 'package' => 'deluxe', 'paid' => 'full'],
            ['client' => 'Emma & Harry', 'email' => 'emma.harry@example.com', 'status' => 'Completed', 'event' => -9, 'package' => 'half', 'paid' => 'full'],
            ['client' => 'Ava & Mason', 'email' => 'ava.mason@example.com', 'status' => 'Completed', 'event' => -2, 'package' => 'full', 'paid' => 'full'],
        ];
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** @return array{0:string,1:?string} */
    private function splitNames(string $couple): array
    {
        // "Holly & Daniel" → first names list as the contact's first name.
        $primary = trim(explode('&', $couple)[0]);

        return [$primary ?: $couple, null];
    }

    /** Second name in a "X & Y" couple, for the partner contract field. */
    private function partnerName(string $couple): string
    {
        $parts = explode('&', $couple);

        return isset($parts[1]) ? trim($parts[1]) : '';
    }

    private function fakePhone(): string
    {
        $this->phoneSeq++;

        return '+44 7700 '.str_pad((string) (900000 + $this->phoneSeq), 6, '0', STR_PAD_LEFT);
    }

    /** Remove a previous run's demo studio (and everything under it). */
    private function purgePrevious(): void
    {
        $user = User::where('email', self::EMAIL)->first();
        $studioId = $user?->studio_id ?? Studio::where('email', self::EMAIL)->value('id');
        if (! $studioId) {
            return;
        }

        $w = fn ($q) => $q->withoutGlobalScopes()->where('studio_id', $studioId);

        // Order matters: delete records that reference others first.
        WorkflowStep::query()->whereIn('workflow_id', Workflow::withoutGlobalScopes()->where('studio_id', $studioId)->pluck('id'))->delete();
        $w(Workflow::query())->delete();

        $w(Proposal::query())->delete(); // references contracts/invoices/packages

        ContractSignature::query()->whereIn('contract_id', Contract::withoutGlobalScopes()->where('studio_id', $studioId)->pluck('id'))->delete();
        $w(Contract::query())->delete();
        $w(ContractTemplate::query())->delete();

        $w(Questionnaire::query())->delete();
        $w(QuestionnaireTemplate::query())->delete();

        $w(Meeting::query())->delete();
        $w(MeetingType::query())->delete();

        TaskTemplateItem::query()->whereIn('task_template_id', TaskTemplate::withoutGlobalScopes()->where('studio_id', $studioId)->pluck('id'))->delete();
        $w(TaskTemplate::query())->delete();
        $w(Task::query())->delete();

        $w(PackageBooking::query())->delete();
        // Invoices cascade to items/payments/schedules via FKs.
        $w(Invoice::query())->get()->each(fn (Invoice $i) => $i->delete());
        $w(Package::query())->delete();

        $w(SiteLead::query())->delete();
        $w(SiteVisit::query())->delete();
        $w(SitePage::query())->delete();
        $w(Site::query())->delete();

        $w(Project::query())->delete();
        $w(Contact::query())->delete();
        $w(ProjectStatus::query())->delete();
        $w(ProjectType::query())->delete();

        User::where('studio_id', $studioId)->delete();
        Studio::where('id', $studioId)->delete();
    }
}
