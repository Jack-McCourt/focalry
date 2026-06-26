<?php

use App\Jobs\SendConversationMessage;
use App\Mail\StudioMessageMail;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageTemplate;
use App\Models\Studio;
use App\Models\User;
use App\Notifications\NewClientReply;
use Illuminate\Http\UploadedFile;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

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
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
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

it('starts a conversation without a subject, defaulting it to the studio name', function () {
    Mail::fake();
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id, 'body' => 'Hello with no subject',
    ])->assertRedirect();

    $conv = Conversation::withoutGlobalScopes()->first();
    expect($conv->subject)->toContain($studio->name);
});

it('opens the existing thread for a contact, else drops into compose', function () {
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    // No conversation yet → redirect into the composer for this contact.
    $this->actingAs($user)->get(route('messages.with-contact', $contact))
        ->assertRedirect(route('messages.index', ['compose' => $contact->id]));

    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'subject' => 'Hi', 'reply_token' => 'with-tok',
    ]);

    // Existing conversation → open it.
    $this->actingAs($user)->get(route('messages.with-contact', $contact))
        ->assertRedirect(route('messages.show', $conv));
});

it('queues the outbound send on the Horizon queue', function () {
    Queue::fake();
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id, 'subject' => 'Hi', 'body' => 'Queued hello',
    ])->assertRedirect();

    Queue::assertPushed(SendConversationMessage::class);
    // Recorded as queued; the job (faked here) flips it to sent when it runs.
    $this->assertDatabaseHas('messages', ['direction' => 'outbound', 'body' => 'Queued hello', 'status' => 'queued']);
});

it('stores outbound attachments and attaches them to the email', function () {
    Mail::fake();
    Storage::fake('wasabi');
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id,
        'subject' => 'Proofs',
        'body' => 'Here is the contract.',
        'attachments' => [UploadedFile::fake()->create('contract.pdf', 12, 'application/pdf')],
    ])->assertRedirect();

    $message = Message::withoutGlobalScopes()->where('direction', 'outbound')->firstOrFail();
    $attachment = $message->attachments()->withoutGlobalScopes()->firstOrFail();

    expect($attachment->name)->toBe('contract.pdf');
    Storage::disk('wasabi')->assertExists($attachment->path);

    Mail::assertSent(StudioMessageMail::class, fn (StudioMessageMail $m) => count($m->files) === 1 && $m->files[0]['name'] === 'contract.pdf');
});

it('allows an attachment-only message with no body', function () {
    Mail::fake();
    Storage::fake('wasabi');
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id,
        'subject' => 'Photo',
        'attachments' => [UploadedFile::fake()->image('shot.jpg')],
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect(Message::withoutGlobalScopes()->where('direction', 'outbound')->count())->toBe(1);
});

it('captures inbound Postmark attachments into the thread', function () {
    Storage::fake('wasabi');
    [$studio] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Your wedding', 'reply_token' => 'att-tok',
    ]);

    $this->postJson('/api/mail/inbound/topsecret', [
        'MailboxHash' => 'att-tok',
        'MessageID' => 'msg-att',
        'From' => 'jane@example.com',
        'StrippedTextReply' => 'See attached.',
        'Attachments' => [[
            'Name' => 'photo.jpg',
            'Content' => base64_encode('fake-image-bytes'),
            'ContentType' => 'image/jpeg',
        ]],
    ])->assertOk();

    $message = Message::withoutGlobalScopes()->where('conversation_id', $conv->id)->firstOrFail();
    $attachment = $message->attachments()->withoutGlobalScopes()->firstOrFail();

    expect($attachment->name)->toBe('photo.jpg')->and($attachment->mime)->toBe('image/jpeg');
    Storage::disk('wasabi')->assertExists($attachment->path);
});

it('ingests a Postmark inbound reply into the conversation thread', function () {
    [$studio] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
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

it('adds an internal note without emailing the client', function () {
    Mail::fake();
    [$studio, $user] = studioUser();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'subject' => 'Hi', 'reply_token' => 'note-tok',
    ]);

    $this->actingAs($user)->post(route('messages.note', $conv), ['body' => 'Client wants outdoor shots'])->assertRedirect();

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conv->id, 'is_internal' => true, 'body' => 'Client wants outdoor shots', 'status' => 'sent',
    ]);
    Mail::assertNothingSent();
});

it('marks a conversation unread again', function () {
    [$studio, $user] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'mu-tok', 'unread' => false,
    ]);

    $this->actingAs($user)->post(route('messages.unread', $conv))->assertRedirect();

    expect($conv->refresh()->unread)->toBeTrue();
});

it('updates conversation labels', function () {
    [$studio, $user] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'tag-tok',
    ]);

    $this->actingAs($user)->patch(route('messages.tags', $conv), ['tags' => ['VIP', 'Wedding', 'VIP', ' ']])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect(Conversation::withoutGlobalScopes()->find($conv->id)->tags)->toBe(['VIP', 'Wedding']);
});

it('stores and deletes a canned reply template', function () {
    [$studio, $user] = studioUser();

    $this->actingAs($user)->post(route('message-templates.store'), ['name' => 'Welcome', 'body' => 'Thanks for booking!'])->assertRedirect();
    $this->assertDatabaseHas('message_templates', ['studio_id' => $studio->id, 'name' => 'Welcome']);

    $template = MessageTemplate::withoutGlobalScopes()->firstOrFail();
    $this->actingAs($user)->delete(route('message-templates.destroy', $template))->assertRedirect();
    $this->assertDatabaseMissing('message_templates', ['id' => $template->id]);
});

it('records a database notification when a client replies', function () {
    [$studio, $user] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'notif-tok',
    ]);

    $this->postJson('/api/mail/inbound/topsecret', [
        'MailboxHash' => 'notif-tok', 'MessageID' => 'm-notif', 'From' => 'jane@example.com',
        'FromFull' => ['Email' => 'jane@example.com', 'Name' => 'Jane'], 'StrippedTextReply' => 'Hello back',
    ])->assertOk();

    $this->assertDatabaseHas('notifications', [
        'notifiable_type' => User::class, 'notifiable_id' => $user->id, 'type' => NewClientReply::class,
    ]);
});

it('renders the client-reply email preserving the message line breaks', function () {
    // The fix lives in the markdown view: single newlines render as <br> instead
    // of being collapsed to spaces.
    $html = (string) app(Markdown::class)->render('mail.new-client-reply', [
        'fromName' => 'Jane',
        'subject' => 'Re: Your photos',
        'body' => "line one\nline two\n\npara two",
        'url' => 'https://example.com/messages/1',
    ]);

    expect($html)->toContain('<br');
    expect($html)->toContain('View conversation');
    expect($html)->not->toContain('line one line two');
});

it('records an open via the tracking pixel and ignores a bad token', function () {
    [$studio] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'open-tok',
    ]);
    $message = $conv->messages()->create([
        'studio_id' => $studio->id, 'direction' => 'outbound', 'body' => 'hello', 'status' => 'sent',
    ]);

    $this->get(route('mail.open', ['message' => $message->id, 'token' => 'wrong']))->assertOk();
    expect(Message::withoutGlobalScopes()->find($message->id)->opened_at)->toBeNull();

    $this->get($message->openTrackingUrl())
        ->assertOk()
        ->assertHeader('Content-Type', 'image/gif');
    expect(Message::withoutGlobalScopes()->find($message->id)->opened_at)->not->toBeNull();
});

it('appends the studio signature to outbound mail', function () {
    Mail::fake();
    $studio = Studio::factory()->create(['email_signature' => '— The Studio Team']);
    $user = User::factory()->for($studio)->create();
    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com',
    ]);

    $this->actingAs($user)->post(route('messages.store'), [
        'contact_id' => $contact->id, 'subject' => 'Hi', 'body' => 'Hello',
    ])->assertRedirect();

    Mail::assertSent(StudioMessageMail::class, fn (StudioMessageMail $m) => $m->signature === '— The Studio Team' && str_contains($m->trackingUrl ?? '', '/e/o/'));
});

it('marks a conversation read when opened', function () {
    [$studio, $user] = studioUser();
    $conv = Conversation::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'subject' => 'Hi', 'reply_token' => 'read-tok', 'unread' => true,
    ]);

    $this->actingAs($user)->get(route('messages.show', $conv))->assertOk();

    expect($conv->refresh()->unread)->toBeFalse();
});
