<?php

use App\Jobs\SendConversationMessage;
use App\Mail\StudioMessageMail;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    config(['services.messaging.inbound_address' => 'reply@inbound.example.com']);
    config(['services.messaging.inbound_secret' => 'topsecret']);
});

function studioUser(): array
{
    $studio = Studio::factory()->create();
    $user = User::factory()->for($studio)->create();

    return [$studio, $user];
}

it('starts a conversation and emails the client with a token reply-to', function () {
    Mail::fake();
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com', 'status' => 'client',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id, 'subject' => 'Your wedding', 'body' => 'Hello Jane!',
    ])->assertRedirect();

    $conv = Conversation::withoutGlobalScopes()->first();
    expect($conv)->not->toBeNull()
        ->and($conv->subject)->toBe('Your wedding')
        ->and($conv->reply_token)->not->toBeEmpty();

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conv->id, 'direction' => 'outbound', 'body' => 'Hello Jane!', 'status' => 'sent',
    ]);

    Mail::assertSent(StudioMessageMail::class, fn (StudioMessageMail $m) => $m->hasTo('jane@example.com')
        && str_contains($m->replyToAddress, $conv->reply_token));
});

it('queues the outbound send on the Horizon queue', function () {
    Queue::fake();
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com', 'status' => 'client',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id, 'subject' => 'Hi', 'body' => 'Queued hello',
    ])->assertRedirect();

    Queue::assertPushed(SendConversationMessage::class);
    // Recorded as queued; the job (faked here) flips it to sent when it runs.
    $this->assertDatabaseHas('messages', ['direction' => 'outbound', 'body' => 'Queued hello', 'status' => 'queued']);
});

it('ingests a Postmark inbound reply into the conversation thread', function () {
    [$studio] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com', 'status' => 'client',
    ]);
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'subject' => 'Your wedding', 'reply_token' => 'tok123abc',
    ]);

    $this->postJson('/api/mail/inbound/topsecret', [
        'MailboxHash' => 'tok123abc',
        'MessageID' => 'msg-1',
        'From' => 'jane@example.com',
        'FromFull' => ['Email' => 'jane@example.com', 'Name' => 'Jane Doe'],
        'StrippedTextReply' => 'Sounds great, see you then!',
        'TextBody' => "Sounds great, see you then!\n\nOn ... wrote:\n> original",
    ])->assertOk();

    $conv->refresh();
    expect($conv->unread)->toBeTrue();
    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conv->id, 'direction' => 'inbound', 'body' => 'Sounds great, see you then!',
        'author_email' => 'jane@example.com', 'email_message_id' => 'msg-1',
    ]);
});

it('is idempotent on duplicate inbound delivery', function () {
    [$studio] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'dup-tok',
    ]);

    $payload = ['MailboxHash' => 'dup-tok', 'MessageID' => 'same-id', 'From' => 'a@b.com', 'StrippedTextReply' => 'hi'];
    $this->postJson('/api/mail/inbound/topsecret', $payload)->assertOk();
    $this->postJson('/api/mail/inbound/topsecret', $payload)->assertOk();

    expect(Message::withoutGlobalScopes()->where('conversation_id', $conv->id)->count())->toBe(1);
});

it('rejects the inbound webhook with a wrong secret', function () {
    $this->postJson('/api/mail/inbound/wrong', ['MailboxHash' => 'x'])->assertNotFound();
});

it('marks a conversation read when opened', function () {
    [$studio, $user] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'read-tok', 'unread' => true,
    ]);

    $this->actingAs($user)->get(route('messages.show', $conv))->assertOk();

    expect($conv->refresh()->unread)->toBeFalse();
});
