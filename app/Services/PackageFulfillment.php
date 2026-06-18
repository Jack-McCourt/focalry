<?php

namespace App\Services;

use App\Models\PackageBooking;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\ProjectType;

/**
 * Marks a package booking paid and creates the linked Project. Idempotent:
 * safe to call again from a replayed Stripe webhook.
 */
class PackageFulfillment
{
    public function markPaid(PackageBooking $booking, ?string $paymentIntent, int $amount): void
    {
        if ($booking->status === 'paid') {
            return;
        }

        // Bind the studio so BelongsToStudio scoping/assignment work off-request.
        app()->instance('current.studio.id', $booking->studio_id);

        if (! $booking->project_id) {
            $booking->project_id = $this->createProject($booking)->id;
        }

        $booking->status = 'paid';
        $booking->stripe_payment_intent = $paymentIntent;
        if ($amount > 0) {
            $booking->amount_cents = $amount; // trust Stripe's amount
        }
        $booking->save();
    }

    private function createProject(PackageBooking $booking): Project
    {
        $status = ProjectStatus::where('studio_id', $booking->studio_id)->orderBy('position')->first();
        $type = ProjectType::where('studio_id', $booking->studio_id)->orderBy('position')->first();

        $name = trim(($booking->package?->name ? $booking->package->name.' — ' : '').$booking->client_name) ?: 'New booking';

        return Project::create([
            'studio_id' => $booking->studio_id,
            'name' => $name,
            'status_id' => $status?->id,
            'type_id' => $type?->id,
            'contact_id' => $booking->contact_id,
            'position' => (int) Project::where('status_id', $status?->id)->max('position') + 1,
        ]);
    }
}
