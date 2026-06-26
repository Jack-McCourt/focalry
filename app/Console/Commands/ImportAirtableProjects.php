<?php

namespace App\Console\Commands;

use App\Models\Contact;
use App\Models\Project;
use App\Models\ProjectFieldDefinition;
use App\Models\User;
use App\Support\PublicAsset;
use App\Support\StudioPaths;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Imports an Airtable CSV export of weddings into a studio's Projects.
 *
 *   Name           -> Contact (first/last) + Project name
 *   Wedding date   -> event_date (+ a "Wedding time" custom field)
 *   Notes          -> Project notes
 *   Status         -> ignored
 *   everything else -> custom fields (created on demand; attachments become
 *                      "file" fields, paid/album flags become checkboxes)
 *
 * Idempotent: contacts matched by name, projects by name + event_date.
 */
class ImportAirtableProjects extends Command
{
    protected $signature = 'import:airtable-projects {path=airtable.csv} {--email=jack@mccourtphotography.co.uk} {--dry-run : Show what would happen without writing}';

    protected $description = 'Import an Airtable weddings CSV into a studio\'s Projects';

    /** Custom field definitions to ensure, keyed by CSV column => [key, label, type]. */
    private const FIELD_MAP = [
        'Wedding time' => ['wedding_time', 'Wedding time', 'text'],          // synthesised from Wedding date
        'Couples Shoot' => ['couples_shoot', 'Couples Shoot', 'text'],
        'Shot lists' => ['shot_lists', 'Shot Lists', 'file'],
        'Schedule' => ['schedule', 'Schedule', 'file'],
        'Timeline' => ['timeline', 'Timeline', 'long_text'],
        'Address' => ['venue_address', 'Venue Address', 'text'],
        'Getting Ready Address' => ['getting_ready_address', 'Getting Ready Address', 'long_text'],
        'Number of guests' => ['number_of_guests', 'Number of Guests', 'text'],
        'Assets' => ['assets', 'Assets', 'file'],
        'Deposit paid' => ['deposit_paid', 'Deposit Paid', 'checkbox'],
        'Paid in full' => ['paid_in_full', 'Paid in Full', 'checkbox'],
        'Package/Price' => ['package_price', 'Package / Price', 'long_text'],
        'Contact Details' => ['contact_details', 'Contact Details', 'long_text'],
        'Album' => ['album', 'Album', 'checkbox'],
    ];

    public function handle(): int
    {
        $path = $this->argument('path');
        if (! is_file($path)) {
            $this->error("CSV not found at: {$path}");

            return self::FAILURE;
        }

        $user = User::where('email', $this->option('email'))->first();
        if (! $user?->studio_id) {
            $this->error("No studio found for {$this->option('email')}");

            return self::FAILURE;
        }
        app()->instance('current.studio.id', $user->studio_id);

        $dry = (bool) $this->option('dry-run');
        $this->info(($dry ? '[DRY RUN] ' : '')."Importing into studio #{$user->studio_id} ({$user->studio->name})");

        // 1) Ensure custom field definitions exist.
        $fields = $this->ensureFields($dry);

        // 2) Parse the CSV.
        $rows = $this->readCsv($path);
        $this->info('Parsed '.count($rows).' rows.');

        $created = 0;
        $updated = 0;
        $contactsNew = 0;
        $warnings = [];

        foreach ($rows as $n => $row) {
            $name = trim($row['Name'] ?? '');
            if ($name === '') {
                $warnings[] = "Row {$n}: blank name, skipped.";

                continue;
            }

            [$first, $last] = $this->splitName($name);
            [$eventDate, $weddingTime] = $this->parseDate($row['Wedding date'] ?? '');

            // Contact details: pull a reliable email/phone out of the free-text column.
            $contactCol = trim($row['Contact Details'] ?? '');
            $email = $this->extractEmail($contactCol);
            $phone = $this->extractPhone($contactCol);

            // Build custom field values.
            $custom = [];
            if ($weddingTime) {
                $custom['wedding_time'] = $weddingTime;
            }
            foreach (self::FIELD_MAP as $col => [$key, , $type]) {
                if ($col === 'Wedding time') {
                    continue;
                }
                $raw = trim($row[$col] ?? '');
                if ($raw === '') {
                    continue;
                }
                $custom[$key] = match ($type) {
                    'checkbox' => $this->isChecked($raw),
                    'file' => $this->parseAttachments($raw, $warnings, $n, $col, $dry),
                    default => $raw,
                };
                // Drop empty file arrays so the field stays blank.
                if ($type === 'file' && empty($custom[$key])) {
                    unset($custom[$key]);
                }
            }

            $notes = trim($row['Notes'] ?? '') ?: null;

            if ($dry) {
                if ($n < 5) {
                    $this->line(sprintf(
                        '  • %s | event %s%s | %d custom fields%s%s',
                        $name,
                        $eventDate ?? '—',
                        $weddingTime ? " {$weddingTime}" : '',
                        count($custom),
                        $email ? " | email {$email}" : '',
                        $notes ? ' | has notes' : '',
                    ));
                }

                continue;
            }

            // Contact: find by name, create if missing; fill email/phone if blank.
            $contact = Contact::where('first_name', $first)->where('last_name', $last)->first();
            if (! $contact) {
                $contact = new Contact(['first_name' => $first, 'last_name' => $last]);
                $contactsNew++;
            }
            if ($email && ! $contact->email) {
                $contact->email = $email;
            }
            if ($phone && ! $contact->phone) {
                $contact->phone = $phone;
            }
            $contact->save();

            // Project: match on name + event_date (idempotent re-runs).
            $project = Project::where('name', $name)
                ->where('event_date', $eventDate)
                ->first();

            $attrs = [
                'name' => $name,
                'event_date' => $eventDate,
                'contact_id' => $contact->id,
                'notes' => $notes,
                'custom_fields' => $custom,
            ];

            if ($project) {
                $project->update($attrs);
                $updated++;
            } else {
                $attrs['position'] = (int) Project::max('position') + 1;
                Project::create($attrs);
                $created++;
            }
        }

        $this->newLine();
        if ($dry) {
            $this->info('[DRY RUN] No changes written. Showed the first 5 rows above.');
            $this->info('Would ensure '.count($fields).' custom fields and process '.count($rows).' projects.');
        } else {
            $this->info("Done. Projects created: {$created}, updated: {$updated}. New contacts: {$contactsNew}.");
        }

        if ($warnings) {
            $this->warn(count($warnings).' warning(s):');
            foreach (array_slice($warnings, 0, 15) as $w) {
                $this->line('  - '.$w);
            }
        }

        return self::SUCCESS;
    }

    /** @return array<string, ProjectFieldDefinition> keyed by field key */
    private function ensureFields(bool $dry): array
    {
        $out = [];
        $pos = (int) ProjectFieldDefinition::max('position');
        foreach (self::FIELD_MAP as [$key, $label, $type]) {
            $existing = ProjectFieldDefinition::where('key', $key)->first();
            if ($existing) {
                $out[$key] = $existing;

                continue;
            }
            $this->line("  + field: {$label} ({$type})");
            if (! $dry) {
                $out[$key] = ProjectFieldDefinition::create([
                    'key' => $key, 'label' => $label, 'type' => $type, 'position' => ++$pos,
                ]);
            }
        }

        return $out;
    }

    /** @return array<int, array<string, string>> */
    private function readCsv(string $path): array
    {
        $fh = fopen($path, 'r');
        $header = fgetcsv($fh);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // strip UTF-8 BOM
        $rows = [];
        while (($r = fgetcsv($fh)) !== false) {
            if (count(array_filter($r, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue; // blank line
            }
            $rows[] = array_combine($header, array_pad($r, count($header), ''));
        }
        fclose($fh);

        return $rows;
    }

    /** @return array{0:string,1:string} */
    private function splitName(string $name): array
    {
        $name = trim(preg_replace('/\s+/', ' ', $name));
        $sp = strpos($name, ' ');

        return $sp === false ? [$name, ''] : [substr($name, 0, $sp), substr($name, $sp + 1)];
    }

    /** @return array{0:?string,1:?string} [event date (Y-m-d), wedding time] */
    private function parseDate(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [null, null];
        }
        $time = null;
        if (preg_match('/\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/i', $raw, $m)) {
            $time = trim($m[0]);
        }
        try {
            return [Carbon::parse($raw)->toDateString(), $time];
        } catch (Throwable) {
            return [null, $time];
        }
    }

    /** @return array<int, array{url:string,name:string}> */
    private function parseAttachments(string $raw, array &$warnings, int $row, string $col, bool $dry): array
    {
        preg_match_all('/([^()\n]+?)\s*\((https?:\/\/[^)\s]+)\)/', $raw, $m, PREG_SET_ORDER);
        $out = [];
        foreach ($m as $pair) {
            $name = trim($pair[1]);
            $sourceUrl = trim($pair[2]);

            if ($dry) {
                $out[] = ['name' => $name, 'url' => $sourceUrl];

                continue;
            }

            // Pull the file off the (expiring) Airtable URL and onto Wasabi so the
            // link keeps working. Fall back to the original URL if the fetch fails.
            $stored = $this->downloadToWasabi($sourceUrl, $name);
            if ($stored) {
                $out[] = $stored;
            } else {
                $warnings[] = "Row {$row}: '{$col}' could not fetch '{$name}'; kept original link.";
                $out[] = ['name' => $name, 'url' => $sourceUrl];
            }
        }
        if (! $out && $raw !== '') {
            $warnings[] = "Row {$row}: '{$col}' had no parseable attachment link, skipped: ".mb_substr($raw, 0, 60);
        }

        return $out;
    }

    /**
     * Download a remote file and store it on the public Wasabi prefix.
     *
     * @return array{url:string,name:string}|null
     */
    private function downloadToWasabi(string $url, string $name): ?array
    {
        try {
            $resp = Http::timeout(120)->get($url);
            if (! $resp->successful()) {
                return null;
            }
            $ext = pathinfo($name, PATHINFO_EXTENSION) ?: 'bin';
            $key = StudioPaths::asset(app('current.studio.id'), 'projects/files').'/'.Str::random(40).'.'.$ext;
            Storage::disk('wasabi')->put($key, $resp->body(), 'public');

            return ['url' => PublicAsset::url($key), 'name' => $name];
        } catch (Throwable) {
            return null;
        }
    }

    private function isChecked(string $raw): bool
    {
        return stripos($raw, 'check') !== false || in_array(strtolower(trim($raw)), ['yes', 'true', '1', 'paid'], true);
    }

    private function extractEmail(string $raw): ?string
    {
        return preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $raw, $m) ? $m[0] : null;
    }

    private function extractPhone(string $raw): ?string
    {
        // Conservative UK-ish: a 0/+44 lead with 9-12 following digits (spaces allowed).
        if (preg_match('/(?:\+44\s?|0)\d[\d\s]{7,12}\d/', $raw, $m)) {
            $digits = preg_replace('/\s+/', '', $m[0]);

            return strlen($digits) >= 10 ? $m[0] : null;
        }

        return null;
    }
}
