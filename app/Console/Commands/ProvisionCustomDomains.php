<?php

namespace App\Console\Commands;

use App\Models\Site;
use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

/**
 * Provisions nginx + a Let's Encrypt certificate for verified custom domains so
 * studio sites can be served over HTTPS on their own domain.
 *
 * Verification (DNS TXT) happens in-app; this handles the server side. It must
 * run with privileges to write nginx config and invoke certbot, so it's safe by
 * default (dry-run) and only mutates the server with --apply. Intended to run
 * from cron as root, e.g.:  sudo php artisan domains:provision --apply
 */
class ProvisionCustomDomains extends Command
{
    protected $signature = 'domains:provision {--apply : Write nginx config, run certbot and reload (requires root)} {--site= : Only this site id}';

    protected $description = 'Provision nginx + TLS for verified custom domains';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');

        $sites = Site::withoutGlobalScopes()
            ->whereNotNull('domain_verified_at')
            ->whereNull('domain_provisioned_at')
            ->where('is_published', true)
            ->when($this->option('site'), fn ($q) => $q->whereKey($this->option('site')))
            ->get();

        if ($sites->isEmpty()) {
            $this->info('No domains awaiting provisioning.');

            return self::SUCCESS;
        }

        foreach ($sites as $site) {
            $domain = $site->custom_domain;
            $this->line("→ {$domain} (site {$site->id})");

            $available = "/etc/nginx/sites-available/focalry-{$domain}";
            $enabled = "/etc/nginx/sites-enabled/focalry-{$domain}";
            $config = $this->vhost($domain);

            if (! $apply) {
                $this->comment("  [dry-run] would write {$available}, enable it, run certbot, reload nginx");
                $this->line($config);

                continue;
            }

            try {
                file_put_contents($available, $config);
                if (! file_exists($enabled)) {
                    symlink($available, $enabled);
                }

                $this->runProcess(['nginx', '-t']);
                $this->runProcess(['systemctl', 'reload', 'nginx']);
                $this->runProcess([
                    'certbot', '--nginx', '-d', $domain,
                    '--non-interactive', '--agree-tos', '--redirect',
                    '-m', config('mail.from.address') ?: 'admin@'.parse_url((string) config('app.url'), PHP_URL_HOST),
                ]);

                $site->update(['domain_provisioned_at' => now()]);
                $this->info("  ✓ live: https://{$domain}");
            } catch (\Throwable $e) {
                $this->error("  ✗ {$domain}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }

    /** Run a shell command, throwing on failure. */
    private function runProcess(array $cmd): void
    {
        $p = new Process($cmd);
        $p->setTimeout(120);
        $p->run();
        if (! $p->isSuccessful()) {
            throw new \RuntimeException(trim($p->getErrorOutput() ?: $p->getOutput()));
        }
    }

    /** nginx server block: a plain HTTP vhost that proxies to the app's php-fpm.
     *  Certbot rewrites it for TLS + the 80→443 redirect on first run. */
    private function vhost(string $domain): string
    {
        $root = base_path('public');

        // Mirrors the platform's own vhost (PHP 8.4 via the shared snippet).
        // Certbot rewrites this for TLS + the 80→443 redirect on first run.
        return <<<NGINX
        # Managed by Focalry (domains:provision). Studio custom domain.
        server {
            listen 80;
            listen [::]:80;
            server_name {$domain};
            root {$root};
            index index.php;

            location / {
                try_files \$uri \$uri/ /index.php?\$args;
            }

            include conf.d/php8.4;

            location ~ /\.(?!well-known).* { deny all; }
        }
        NGINX;
    }
}
