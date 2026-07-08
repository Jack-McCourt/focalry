<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Triggers nginx + TLS provisioning for verified custom domains by invoking the
 * root wrapper (/usr/local/sbin/focalry-provision) via sudo. Dispatched right
 * after a domain is verified so it goes live within seconds; a periodic timer
 * running the same wrapper is the backstop for domains whose A/CNAME had not yet
 * propagated at verify time.
 *
 * The wrapper takes no arguments and runs the full idempotent batch, so this job
 * is not tied to a single site — retries and overlapping runs are harmless.
 */
class ProvisionDomainJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    // DNS for a freshly-verified domain may still be propagating, so certbot's
    // HTTP-01 challenge can fail the first time. Back off and retry over ~10 min.
    public array $backoff = [60, 300, 600];

    public function handle(): void
    {
        $process = new Process(['sudo', '-n', '/usr/local/sbin/focalry-provision']);
        $process->setTimeout(180);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException(trim($process->getErrorOutput() ?: $process->getOutput()) ?: 'provisioning failed');
        }

        Log::info('ProvisionDomainJob: '.trim($process->getOutput()));
    }

    public function failed(Throwable $e): void
    {
        Log::error('ProvisionDomainJob failed: '.$e->getMessage());
    }
}
