<?php

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Project;
use App\Models\Studio;
use App\Models\User;

function tagSetup(): array
{
    // 'plus' includes the studio_manager feature that gates the projects routes.
    $studio = Studio::factory()->onPaidPlan('plus')->create();
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    $contact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Jane', 'email' => 'jane@example.com', 'status' => 'client',
    ]);
    $conversation = Conversation::create([
        'studio_id' => $studio->id, 'contact_id' => $contact->id, 'subject' => 'Your wedding',
    ]);
    $message = Message::create([
        'studio_id' => $studio->id, 'conversation_id' => $conversation->id,
        'direction' => 'inbound', 'author_name' => 'Jane', 'body' => "line one\nline two", 'status' => 'received',
    ]);

    return [$studio, $user, $contact, $conversation, $message];
}

it('tags a message to a project belonging to the same contact', function () {
    [$studio, $user, $contact, , $message] = tagSetup();
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding', 'contact_id' => $contact->id]);

    $this->actingAs($user)
        ->post(route('messages.tag-project', $message->id), ['project_id' => $project->id])
        ->assertRedirect();

    expect($message->fresh()->project_id)->toBe($project->id);
});

it('refuses to tag a message to another contact\'s project', function () {
    [$studio, $user, , , $message] = tagSetup();
    $otherContact = Contact::withoutGlobalScopes()->create([
        'studio_id' => $studio->id, 'first_name' => 'Bob', 'email' => 'bob@example.com', 'status' => 'client',
    ]);
    $foreign = Project::create(['studio_id' => $studio->id, 'name' => 'Bob Project', 'contact_id' => $otherContact->id]);

    $this->actingAs($user)
        ->post(route('messages.tag-project', $message->id), ['project_id' => $foreign->id])
        ->assertNotFound();

    expect($message->fresh()->project_id)->toBeNull();
});

it('untags a message when given a null project', function () {
    [$studio, $user, $contact, , $message] = tagSetup();
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding', 'contact_id' => $contact->id]);
    $message->update(['project_id' => $project->id]);

    $this->actingAs($user)
        ->post(route('messages.tag-project', $message->id), ['project_id' => null])
        ->assertRedirect();

    expect($message->fresh()->project_id)->toBeNull();
});

it('returns tagged messages in the project drawer payload', function () {
    [$studio, $user, $contact, $conversation, $message] = tagSetup();
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding', 'contact_id' => $contact->id]);
    $message->update(['project_id' => $project->id]);

    $this->actingAs($user)
        ->getJson(route('projects.show', $project->id))
        ->assertOk()
        ->assertJsonPath('messages.0.id', $message->id)
        ->assertJsonPath('messages.0.conversation_id', $conversation->id)
        ->assertJsonPath('messages.0.body', "line one\nline two");
});

it('exposes the contact projects and each message project_id on the thread', function () {
    [$studio, $user, $contact, $conversation, $message] = tagSetup();
    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding', 'contact_id' => $contact->id]);
    $message->update(['project_id' => $project->id]);

    $this->actingAs($user)
        ->get(route('messages.show', $conversation->id))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('selected.projects.0.id', $project->id)
            ->where('selected.messages.0.project_id', $project->id));
});
