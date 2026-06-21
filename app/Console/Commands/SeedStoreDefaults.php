<?php

namespace App\Console\Commands;

use App\Fulfilment\Prodigi\StoreDefaults;
use App\Models\Studio;
use Illuminate\Console\Command;

class SeedStoreDefaults extends Command
{
    protected $signature = 'store:seed-defaults {studio? : Studio id (default: all studios without a price sheet)}';

    protected $description = 'Seed the default Prodigi lab price sheet + products for studios that have no store yet.';

    public function handle(StoreDefaults $defaults): int
    {
        $studios = $this->argument('studio')
            ? Studio::whereKey($this->argument('studio'))->get()
            : Studio::all();

        $seeded = 0;
        foreach ($studios as $studio) {
            if ($defaults->seedFor($studio)) {
                $this->info("Seeded store defaults for studio #{$studio->id} ({$studio->name}).");
                $seeded++;
            }
        }

        $this->info("Seeded {$seeded} studio(s).");

        return self::SUCCESS;
    }
}
