<?php

namespace App\Notifications;

/**
 * Central registry of studio-facing business notification types. Each type has a
 * human label (for the preferences UI) and whether it emails by default. The
 * `lead` enquiry notification is intentionally absent — it's handled by
 * {@see NewLead} and already emailed via the website lead flow.
 */
class NotificationType
{
    /** @var array<string, array{label: string, email: bool}> */
    public const TYPES = [
        'invoice_paid' => ['label' => 'Invoice paid', 'email' => true],
        'payment_overdue' => ['label' => 'Payment overdue', 'email' => true],
        'contract_signed' => ['label' => 'Contract signed', 'email' => true],
        'questionnaire_submitted' => ['label' => 'Questionnaire completed', 'email' => true],
        'proposal_accepted' => ['label' => 'Proposal accepted', 'email' => true],
        'meeting_booked' => ['label' => 'Meeting booked', 'email' => true],
        'package_booked' => ['label' => 'Package booked', 'email' => true],
        'store_order' => ['label' => 'Store order placed', 'email' => true],
    ];

    /** Whether email is enabled by default for a type (unknown types: no email). */
    public static function emailsByDefault(string $type): bool
    {
        return self::TYPES[$type]['email'] ?? false;
    }

    /** Type key => label, for building the preferences UI. */
    public static function labels(): array
    {
        return array_map(fn ($t) => $t['label'], self::TYPES);
    }
}
