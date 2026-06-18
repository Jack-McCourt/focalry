<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStudio;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContractTemplate extends Model
{
    use BelongsToStudio, HasFactory;

    protected $fillable = ['studio_id', 'name', 'body', 'fields'];

    protected function casts(): array
    {
        return ['fields' => 'array'];
    }

    /** A studio-fillable merge field definition. */
    private static function field(string $key, string $label, string $type = 'text', string $fillBy = 'studio'): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type, 'fill_by' => $fillBy, 'value' => null];
    }

    /**
     * Catch-all starter templates seeded for each studio. The body uses
     * {{built-in}} tokens (client_name, studio_name, event_date, today) plus the
     * custom fields listed alongside, which the photographer fills in when
     * creating a contract (and can edit freely thereafter).
     *
     * @return array<int, array{name: string, body: string, fields: array<int, array<string, mixed>>}>
     */
    public static function defaults(): array
    {
        return [
            [
                'name' => 'Wedding Photography',
                'fields' => [
                    self::field('partner_name', 'Partner name'),
                    self::field('client_email', 'Client email'),
                    self::field('event_date', 'Event date', 'date'),
                    self::field('venue_name', 'Venue name'),
                    self::field('venue_address', 'Venue address'),
                    self::field('start_time', 'Coverage start time'),
                    self::field('coverage_hours', 'Hours of coverage'),
                    self::field('delivery_weeks', 'Delivery time (weeks)'),
                    self::field('payment_schedule', 'Payment schedule (linked invoice)', 'invoice'),
                ],
                'body' => <<<'HTML'
<h2>Wedding Photography Agreement</h2>
<p>This agreement is made on {{today}} between <strong>{{studio_name}}</strong> (the "Photographer") and <strong>{{client_name}}</strong> and <strong>{{partner_name}}</strong> (the "Clients"). Contact email: {{client_email}}.</p>
<h3>1. The Event</h3>
<p>The Photographer will provide wedding photography services on <strong>{{event_date}}</strong> at <strong>{{venue_name}}</strong>, {{venue_address}}. Coverage begins at {{start_time}} and continues for approximately {{coverage_hours}} hours.</p>
<h3>2. Fees &amp; Payment</h3>
<p>The fees for the photography services are set out in the linked invoice and are payable according to the schedule below. The first payment is non-refundable and reserves the date.</p>
{{payment_schedule}}
<h3>3. Deliverables</h3>
<p>The Photographer will deliver a set of professionally edited images via a private online gallery within approximately {{delivery_weeks}} weeks of the event.</p>
<h3>4. Cancellation</h3>
<p>The booking fee is non-refundable. If the Clients cancel, fees already paid are not refundable. If the Photographer is unable to perform due to circumstances beyond their control, liability is limited to a refund of monies paid.</p>
<h3>5. Copyright &amp; Usage</h3>
<p>The Photographer retains copyright of all images. The Clients are granted a personal-use licence to print and share the images. The Photographer may use selected images for portfolio and marketing purposes unless the Clients object in writing.</p>
<h3>6. Liability</h3>
<p>The Photographer's total liability under this agreement shall not exceed the total fee paid. The Photographer is not responsible for missed images due to circumstances outside their reasonable control.</p>
<p>By signing below, both parties agree to the terms of this agreement.</p>
HTML,
            ],
            [
                'name' => 'Portrait / Couples Session',
                'fields' => [
                    self::field('client_email', 'Client email'),
                    self::field('event_date', 'Session date', 'date'),
                    self::field('session_location', 'Session location'),
                    self::field('session_time', 'Session start time'),
                    self::field('duration', 'Session length'),
                    self::field('delivery_weeks', 'Delivery time (weeks)'),
                    self::field('payment_schedule', 'Payment schedule (linked invoice)', 'invoice'),
                ],
                'body' => <<<'HTML'
<h2>Portrait Session Agreement</h2>
<p>This agreement is made on {{today}} between <strong>{{studio_name}}</strong> (the "Photographer") and <strong>{{client_name}}</strong> (the "Client"). Contact email: {{client_email}}.</p>
<h3>1. The Session</h3>
<p>The Photographer will provide a portrait session on <strong>{{event_date}}</strong> at <strong>{{session_location}}</strong>, beginning at {{session_time}} and lasting approximately {{duration}}.</p>
<h3>2. Fees &amp; Payment</h3>
<p>The fees for the session are set out in the linked invoice and are payable according to the schedule below.</p>
{{payment_schedule}}
<h3>3. Deliverables</h3>
<p>Edited images will be delivered via a private online gallery within approximately {{delivery_weeks}} weeks of the session.</p>
<h3>4. Rescheduling &amp; Cancellation</h3>
<p>Sessions may be rescheduled with reasonable notice subject to availability. The deposit is non-refundable on cancellation.</p>
<h3>5. Copyright &amp; Usage</h3>
<p>The Photographer retains copyright. The Client receives a personal-use licence. The Photographer may use selected images for portfolio and marketing purposes unless the Client objects in writing.</p>
<p>By signing below, both parties agree to the terms of this agreement.</p>
HTML,
            ],
            [
                'name' => 'Corporate / Commercial',
                'fields' => [
                    self::field('company_name', 'Company name'),
                    self::field('contact_email', 'Contact email'),
                    self::field('event_date', 'Shoot date', 'date'),
                    self::field('shoot_type', 'Type of shoot'),
                    self::field('shoot_location', 'Location'),
                    self::field('shoot_time', 'Start time'),
                    self::field('coverage_hours', 'Hours of coverage'),
                    self::field('deliverables', 'Deliverables', 'multiline'),
                    self::field('usage_rights', 'Usage / licensing terms', 'multiline'),
                    self::field('payment_schedule', 'Payment schedule (linked invoice)', 'invoice'),
                ],
                'body' => <<<'HTML'
<h2>Commercial Photography Agreement</h2>
<p>This agreement is made on {{today}} between <strong>{{studio_name}}</strong> (the "Photographer") and <strong>{{company_name}}</strong> (the "Client"), represented by {{client_name}}. Contact email: {{contact_email}}.</p>
<h3>1. The Assignment</h3>
<p>The Photographer will provide {{shoot_type}} photography on <strong>{{event_date}}</strong> at <strong>{{shoot_location}}</strong>, beginning at {{shoot_time}} for approximately {{coverage_hours}} hours.</p>
<h3>2. Deliverables</h3>
<p>{{deliverables}}</p>
<h3>3. Fees &amp; Payment</h3>
<p>The fees for the assignment are set out in the linked invoice and are payable according to the schedule below.</p>
{{payment_schedule}}
<h3>4. Licensing &amp; Usage</h3>
<p>{{usage_rights}}</p>
<p>Unless stated otherwise above, the Photographer retains copyright and grants the Client a licence to use the delivered images for the agreed purposes.</p>
<h3>5. Liability</h3>
<p>The Photographer's total liability under this agreement shall not exceed the total fee paid.</p>
<p>By signing below, both parties agree to the terms of this agreement.</p>
HTML,
            ],
            [
                'name' => 'General Event',
                'fields' => [
                    self::field('client_email', 'Client email'),
                    self::field('event_date', 'Event date', 'date'),
                    self::field('event_type', 'Type of event'),
                    self::field('event_location', 'Event location'),
                    self::field('event_time', 'Start time'),
                    self::field('coverage_hours', 'Hours of coverage'),
                    self::field('delivery_weeks', 'Delivery time (weeks)'),
                    self::field('payment_schedule', 'Payment schedule (linked invoice)', 'invoice'),
                ],
                'body' => <<<'HTML'
<h2>Event Photography Agreement</h2>
<p>This agreement is made on {{today}} between <strong>{{studio_name}}</strong> (the "Photographer") and <strong>{{client_name}}</strong> (the "Client"). Contact email: {{client_email}}.</p>
<h3>1. The Event</h3>
<p>The Photographer will provide photography for a {{event_type}} on <strong>{{event_date}}</strong> at <strong>{{event_location}}</strong>, beginning at {{event_time}} for approximately {{coverage_hours}} hours.</p>
<h3>2. Fees &amp; Payment</h3>
<p>The fees are set out in the linked invoice and are payable according to the schedule below.</p>
{{payment_schedule}}
<h3>3. Deliverables</h3>
<p>Edited images will be delivered via a private online gallery within approximately {{delivery_weeks}} weeks of the event.</p>
<h3>4. Cancellation</h3>
<p>The deposit is non-refundable. If the Photographer is unable to attend due to circumstances beyond their control, liability is limited to a refund of monies paid.</p>
<h3>5. Copyright &amp; Usage</h3>
<p>The Photographer retains copyright and grants the Client a personal-use licence. The Photographer may use selected images for portfolio and marketing purposes unless the Client objects in writing.</p>
<p>By signing below, both parties agree to the terms of this agreement.</p>
HTML,
            ],
        ];
    }

    public static function seedDefaults(): void
    {
        foreach (self::defaults() as $template) {
            static::create($template);
        }
    }
}
