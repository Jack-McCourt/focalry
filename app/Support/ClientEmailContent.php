<?php

namespace App\Support;

use App\Models\Collection;
use App\Models\Contact;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Proposal;
use App\Models\Questionnaire;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Builds the default email template (subject/body/CTA/options) and the resolved
 * detail lines for sending a client email about an Invoice, Contract or Gallery.
 * Shared by the entity show pages (to seed the compose modal) and the send
 * action (to re-derive trusted values like the download PIN server-side).
 */
class ClientEmailContent
{
    public const TYPES = [
        Invoice::class => 'invoice',
        Contract::class => 'contract',
        Collection::class => 'collection',
        Questionnaire::class => 'questionnaire',
        Proposal::class => 'proposal',
    ];

    public static function type(Model $entity): string
    {
        return self::TYPES[$entity::class] ?? 'unknown';
    }

    public static function modelClass(string $type): ?string
    {
        return array_search($type, self::TYPES, true) ?: null;
    }

    /**
     * Default compose-modal payload for an entity.
     *
     * @return array<string, mixed>
     */
    public static function defaults(Model $entity): array
    {
        return [
            'type' => self::type($entity),
            'id' => $entity->getKey(),
            'to' => self::recipientEmail($entity),
            'subject' => self::subject($entity),
            'body' => self::body($entity),
            'cta_label' => self::ctaLabel($entity),
            'options' => self::availableOptions($entity),
        ];
    }

    /**
     * The client this email is about. For contracts (which are tied to a
     * project) we follow the project's client, falling back to the contract's
     * own contact snapshot.
     */
    public static function resolveContact(Model $entity): ?Contact
    {
        if ($entity instanceof Contract || $entity instanceof Questionnaire || $entity instanceof Proposal) {
            return $entity->project?->contact ?? $entity->contact;
        }

        return $entity->contact;
    }

    public static function recipientEmail(Model $entity): ?string
    {
        return self::resolveContact($entity)?->email;
    }

    public static function contactId(Model $entity): ?int
    {
        return self::resolveContact($entity)?->id ?? $entity->contact_id;
    }

    private static function firstName(Model $entity): string
    {
        $first = self::resolveContact($entity)?->first_name;

        return $first ?: 'there';
    }

    private static function studioName(Model $entity): string
    {
        return $entity->studio?->name ?: config('app.name');
    }

    public static function subject(Model $entity): string
    {
        $studio = self::studioName($entity);

        return match (true) {
            $entity instanceof Invoice => "Invoice {$entity->number} from {$studio}",
            $entity instanceof Contract => "Please review & sign: {$entity->title}",
            $entity instanceof Collection => "Your gallery is ready: {$entity->title}",
            $entity instanceof Questionnaire => "Please complete: {$entity->title}",
            $entity instanceof Proposal => "Your proposal from {$studio}",
            default => $studio,
        };
    }

    public static function body(Model $entity): string
    {
        $name = self::firstName($entity);
        $studio = self::studioName($entity);

        return match (true) {
            $entity instanceof Invoice => "Hi {$name},\n\nPlease find invoice {$entity->number} for our services. You can review the full details and pay securely online using the button below.\n\nIf you have any questions, just reply to this email.\n\nThank you,\n{$studio}",
            $entity instanceof Contract => "Hi {$name},\n\nYour contract is ready to review and sign. Please use the button below to read through it and add your signature.\n\nIf you have any questions, just reply to this email.\n\nThank you,\n{$studio}",
            $entity instanceof Collection => "Hi {$name},\n\nYour photo gallery \"{$entity->title}\" is ready! Click the button below to view your photos.\n\nWe hope you love them.\n\n{$studio}",
            $entity instanceof Questionnaire => "Hi {$name},\n\nWhen you have a few minutes, please complete the questionnaire below — it helps us prepare for your big day.\n\nIf you have any questions, just reply to this email.\n\nThank you,\n{$studio}",
            $entity instanceof Proposal => "Hi {$name},\n\nThank you for considering {$studio}. I've put together a proposal for you — use the button below to review what's included, sign the contract and pay your deposit to confirm your booking.\n\nIf you have any questions, just reply to this email.\n\nThank you,\n{$studio}",
            default => "Hi {$name},\n\n{$studio}",
        };
    }

    public static function ctaLabel(Model $entity): string
    {
        return match (true) {
            $entity instanceof Invoice => 'View & pay invoice',
            $entity instanceof Contract => 'Review & sign contract',
            $entity instanceof Collection => 'View your gallery',
            $entity instanceof Questionnaire => 'Open questionnaire',
            $entity instanceof Proposal => 'View proposal',
            default => 'Open',
        };
    }

    public static function ctaUrl(Model $entity): string
    {
        return match (true) {
            $entity instanceof Invoice => route('invoices.public.show', $entity->public_id),
            $entity instanceof Contract => route('contracts.public.show', $entity->public_id),
            $entity instanceof Collection => route('gallery.show', $entity->slug),
            $entity instanceof Questionnaire => route('questionnaires.public.show', $entity->public_id),
            $entity instanceof Proposal => route('proposals.public.show', $entity->public_id),
            default => url('/'),
        };
    }

    /**
     * Toggleable extra detail lines available for this entity.
     *
     * @return array<int, array{key: string, label: string, default: bool}>
     */
    public static function availableOptions(Model $entity): array
    {
        if ($entity instanceof Invoice) {
            $opts = [['key' => 'amount_due', 'label' => 'Show amount due', 'default' => true]];
            if ($entity->due_date) {
                $opts[] = ['key' => 'due_date', 'label' => 'Show due date', 'default' => true];
            }

            return $opts;
        }

        if ($entity instanceof Collection) {
            $opts = [];
            if (! empty($entity->download_settings['pin'])) {
                $opts[] = ['key' => 'pin', 'label' => 'Include download PIN', 'default' => true];
            }
            if (! empty($entity->privacy['password_hash'])) {
                $opts[] = ['key' => 'password_note', 'label' => 'Note that a password is required', 'default' => true];
            }
            if ($entity->event_date) {
                $opts[] = ['key' => 'event_date', 'label' => 'Show event date', 'default' => false];
            }
            if ($entity->expires_at) {
                $opts[] = ['key' => 'expiry', 'label' => 'Mention the gallery expiry date', 'default' => true];
            }

            return $opts;
        }

        return [];
    }

    /**
     * Resolve the enabled options into [label, value] detail lines. Values are
     * read from the model server-side (never trusted from the client).
     *
     * @param  array<int, string>  $enabledKeys
     * @return array<int, array{label: string, value: string}>
     */
    public static function details(Model $entity, array $enabledKeys): array
    {
        $details = [];
        $on = fn (string $key) => in_array($key, $enabledKeys, true);

        if ($entity instanceof Invoice) {
            if ($on('amount_due')) {
                $details[] = ['label' => 'Amount due', 'value' => Money::format($entity->balanceCents(), $entity->currency)];
            }
            if ($on('due_date') && $entity->due_date) {
                $details[] = ['label' => 'Due date', 'value' => Carbon::parse($entity->due_date)->format('j M Y')];
            }
        }

        if ($entity instanceof Collection) {
            if ($on('pin') && ! empty($entity->download_settings['pin'])) {
                $details[] = ['label' => 'Download PIN', 'value' => (string) $entity->download_settings['pin']];
            }
            if ($on('password_note') && ! empty($entity->privacy['password_hash'])) {
                $details[] = ['label' => 'Access', 'value' => 'This gallery is password protected — the password has been shared with you separately.'];
            }
            if ($on('event_date') && $entity->event_date) {
                $details[] = ['label' => 'Event date', 'value' => Carbon::parse($entity->event_date)->format('j M Y')];
            }
            if ($on('expiry') && $entity->expires_at) {
                $details[] = ['label' => 'Available until', 'value' => Carbon::parse($entity->expires_at)->format('j M Y')];
            }
        }

        return $details;
    }
}
