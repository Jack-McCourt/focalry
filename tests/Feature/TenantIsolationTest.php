<?php

namespace Tests\Feature;

use App\Models\Collection;
use App\Models\Studio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_collections_are_scoped_to_current_studio(): void
    {
        $studioA = Studio::factory()->create();
        $studioB = Studio::factory()->create();

        $userA = User::factory()->for($studioA)->create();

        // Bypass scope to create collections for both studios
        Collection::withoutGlobalScope('studio')->create([
            'studio_id' => $studioA->id,
            'title' => 'Studio A Collection',
            'slug' => 'studio-a-collection',
            'status' => 'published',
        ]);

        Collection::withoutGlobalScope('studio')->create([
            'studio_id' => $studioB->id,
            'title' => 'Studio B Collection',
            'slug' => 'studio-b-collection',
            'status' => 'published',
        ]);

        // Acting as Studio A user, the global scope should only return Studio A's collections
        $this->actingAs($userA);
        app()->instance('current.studio.id', $studioA->id);

        $collections = Collection::all();

        $this->assertCount(1, $collections);
        $this->assertSame('Studio A Collection', $collections->first()->title);
    }
}
