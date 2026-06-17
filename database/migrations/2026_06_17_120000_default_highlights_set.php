<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ensure every collection has at least one set (default "Highlights") and
     * no orphan photos — every photo must belong to a set.
     */
    public function up(): void
    {
        foreach (DB::table('collections')->pluck('id') as $collectionId) {
            $defaultSetId = DB::table('sets')
                ->where('collection_id', $collectionId)
                ->orderBy('position')
                ->value('id');

            if ($defaultSetId === null) {
                $defaultSetId = DB::table('sets')->insertGetId([
                    'collection_id' => $collectionId,
                    'name' => 'Highlights',
                    'position' => 1,
                    'visible' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('photos')
                ->where('collection_id', $collectionId)
                ->whereNull('set_id')
                ->update(['set_id' => $defaultSetId]);
        }
    }

    public function down(): void
    {
        // No-op: we don't want to orphan photos again.
    }
};
