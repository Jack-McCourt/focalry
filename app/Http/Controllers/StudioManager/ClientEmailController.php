<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Mail\ClientMessage;
use App\Models\ClientEmail;
use App\Models\Contract;
use App\Support\ClientEmailContent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class ClientEmailController extends Controller
{
    public function send(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_values(ClientEmailContent::TYPES))],
            'id' => 'required|integer',
            'to' => 'required|email',
            'subject' => 'required|string|max:255',
            'body' => 'required|string|max:20000',
            'options' => 'array',
            'options.*' => 'string',
        ]);

        $entity = $this->resolveEntity($data['type'], (int) $data['id']);
        $entity->loadMissing(['contact', 'studio']);
        if ($entity instanceof Contract) {
            $entity->loadMissing('project.contact');
        }

        $details = ClientEmailContent::details($entity, $data['options'] ?? []);
        $studioName = $entity->studio?->name ?: config('app.name');

        $log = new ClientEmail([
            'studio_id' => $entity->studio_id,
            'contact_id' => ClientEmailContent::contactId($entity),
            'emailable_type' => $entity::class,
            'emailable_id' => $entity->getKey(),
            'sent_by' => $request->user()?->id,
            'to_email' => $data['to'],
            'subject' => $data['subject'],
            'body' => $data['body'],
            'details' => $details,
        ]);

        try {
            Mail::to($data['to'])->send(new ClientMessage(
                studioName: $studioName,
                subjectLine: $data['subject'],
                bodyText: $data['body'],
                ctaLabel: ClientEmailContent::ctaLabel($entity),
                ctaUrl: ClientEmailContent::ctaUrl($entity),
                details: $details,
                replyToEmail: $request->user()?->email,
                logoUrl: $entity->studio?->logoUrl(),
                logoHeight: $entity->studio?->emailLogoHeight(),
            ));
        } catch (\Throwable $e) {
            report($e);
            $log->fill(['status' => 'failed', 'error' => $e->getMessage()])->save();

            return back()->with('error', 'The email could not be sent: '.$e->getMessage());
        }

        $log->fill(['status' => 'sent', 'sent_at' => now()])->save();

        // Emailing a draft contract to the client is what "sends" it.
        if ($entity instanceof Contract && $entity->status === 'draft') {
            $entity->update([
                'status' => 'sent',
                'sent_at' => $entity->sent_at ?? now(),
            ]);
        }

        return back()->with('success', 'Email sent to '.$data['to'].'.');
    }

    private function resolveEntity(string $type, int $id): Model
    {
        $class = ClientEmailContent::modelClass($type);
        abort_if($class === null, 404);

        /** @var Model $model */
        $model = $class::query()->findOrFail($id);

        return $model;
    }
}
