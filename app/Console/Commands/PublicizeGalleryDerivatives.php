<?php

namespace App\Console\Commands;

use App\Models\Photo;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Migrates legacy gallery derivatives (stored at private `studios/...` keys and
 * served via signed URLs) to unguessable public keys served straight from the
 * CDN. Server-side copies each derivative to `public/.../{random}/variant.jpg`,
 * rewrites the photo's derivative_keys, then deletes the old objects.
 *
 * Originals (wasabi_key_original) are never touched — they stay private.
 */
class PublicizeGalleryDerivatives extends Command
{
    protected $signature = 'gallery:publicize {--keep-old : Do not delete the old objects after copying} {--dry-run : Report what would change without writing}';

    protected $description = 'Move legacy gallery derivatives to unguessable public CDN keys';

    public function handle(): int
    {
        $disk = Storage::disk('wasabi');
        $dry = (bool) $this->option('dry-run');
        $keepOld = (bool) $this->option('keep-old');
        $migrated = 0;
        $skipped = 0;
        $failed = 0;

        Photo::withoutGlobalScopes()
            ->whereNotNull('derivative_keys')
            ->chunkById(200, function ($photos) use ($disk, $dry, $keepOld, &$migrated, &$skipped, &$failed) {
                foreach ($photos as $photo) {
                    $keys = $photo->derivative_keys ?? [];
                    // Already migrated (all derivatives under public/) → nothing to do.
                    if (! $keys || collect($keys)->every(fn ($k) => str_starts_with($k, 'public/'))) {
                        $skipped++;

                        continue;
                    }

                    $dir = "public/studios/{$photo->studio_id}/collections/{$photo->collection_id}/photos/{$photo->id}/".Str::random(40);
                    $new = [];
                    $oldToDelete = [];

                    try {
                        foreach ($keys as $variant => $old) {
                            if (str_starts_with($old, 'public/')) {
                                $new[$variant] = $old; // leave already-public variants in place

                                continue;
                            }
                            $ext = pathinfo($old, PATHINFO_EXTENSION) ?: 'jpg';
                            $dest = "{$dir}/{$variant}.{$ext}";
                            if (! $dry) {
                                $disk->copy($old, $dest);
                            }
                            $new[$variant] = $dest;
                            $oldToDelete[] = $old;
                        }

                        if (! $dry) {
                            $photo->update(['derivative_keys' => $new]);
                            if (! $keepOld) {
                                foreach ($oldToDelete as $old) {
                                    $disk->delete($old);
                                }
                            }
                        }

                        $migrated++;
                        $this->line("  photo {$photo->id}: ".count($oldToDelete).' derivative(s) '.($dry ? 'would move' : 'moved'));
                    } catch (\Throwable $e) {
                        $failed++;
                        $this->warn("  photo {$photo->id}: FAILED — {$e->getMessage()}");
                    }
                }
            });

        $this->newLine();
        $this->info(($dry ? '[dry-run] ' : '')."Done. migrated={$migrated} skipped={$skipped} failed={$failed}");

        return self::SUCCESS;
    }
}
