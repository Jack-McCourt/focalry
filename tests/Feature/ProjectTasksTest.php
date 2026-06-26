<?php

use App\Models\Project;
use App\Models\Studio;
use App\Models\Task;
use App\Models\User;

it('includes tasks linked to a project in the drawer payload', function () {
    // 'plus' unlocks the studio_manager feature that gates the projects routes.
    $studio = Studio::factory()->onPaidPlan('plus')->create();
    $user = User::factory()->for($studio)->create();
    app()->instance('current.studio.id', $studio->id);

    $project = Project::create(['studio_id' => $studio->id, 'name' => 'Smith Wedding']);
    $other = Project::create(['studio_id' => $studio->id, 'name' => 'Other']);

    Task::create(['studio_id' => $studio->id, 'project_id' => $project->id, 'title' => 'Cull photos']);
    Task::create(['studio_id' => $studio->id, 'project_id' => $project->id, 'title' => 'Send gallery', 'completed_at' => now()]);
    Task::create(['studio_id' => $studio->id, 'project_id' => $other->id, 'title' => 'Unrelated']);

    $res = $this->actingAs($user)->getJson(route('projects.show', $project->id))->assertOk();

    $res->assertJsonCount(2, 'tasks');
    // Incomplete tasks sort before completed ones.
    $res->assertJsonPath('tasks.0.title', 'Cull photos')
        ->assertJsonPath('tasks.0.completed', false)
        ->assertJsonPath('tasks.1.completed', true);
});
