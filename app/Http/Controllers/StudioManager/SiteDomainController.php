<?php

namespace App\Http\Controllers\StudioManager;

use App\Http\Controllers\Controller;
use App\Http\Controllers\StudioManager\Concerns\ResolvesSite;
use App\Jobs\ProvisionDomainJob;
use App\Models\Site;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Custom-domain management for the studio's website: claim a domain, verify
 * ownership via a DNS TXT record, and disconnect. Serving happens in the
 * ResolveCustomDomain middleware; nginx/TLS provisioning via `domains:provision`.
 */
class SiteDomainController extends Controller
{
    use ResolvesSite;

    /** Set (or change) the site's custom domain — resets verification. */
    public function update(Request $request): RedirectResponse
    {
        $site = $this->resolveSite();
        $data = $request->validate([
            'custom_domain' => ['required', 'string', 'max:255', 'regex:/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i'],
        ]);

        $domain = Site::normalizeDomain($data['custom_domain']);

        // Don't let a studio claim the platform's own domain.
        $appHost = Site::normalizeDomain((string) parse_url((string) config('app.url'), PHP_URL_HOST));
        if ($domain === $appHost) {
            return back()->withErrors(['custom_domain' => 'That domain isn’t available.']);
        }

        $taken = Site::withoutGlobalScopes()
            ->where('custom_domain', $domain)
            ->where('id', '!=', $site->id)
            ->exists();
        if ($taken) {
            return back()->withErrors(['custom_domain' => 'That domain is already connected to another site.']);
        }

        $site->update([
            'custom_domain' => $domain,
            'domain_token' => 'focalry-verify='.Str::random(32),
            'domain_verified_at' => null,
            'domain_provisioned_at' => null,
        ]);

        return back()->with('success', 'Domain saved. Add the DNS records below, then verify.');
    }

    /** Verify ownership by looking up the DNS TXT token. */
    public function verify(): RedirectResponse
    {
        $site = $this->resolveSite();
        if (! $site->custom_domain || ! $site->domain_token) {
            return back()->withErrors(['custom_domain' => 'Add a domain first.']);
        }

        $records = @dns_get_record('_focalry-verify.'.$site->custom_domain, DNS_TXT) ?: [];
        $found = collect($records)->contains(fn ($r) => trim($r['txt'] ?? '') === $site->domain_token);

        if (! $found) {
            return back()->withErrors(['custom_domain' => 'Verification TXT record not found yet. DNS can take a few minutes to propagate.']);
        }

        $site->update(['domain_verified_at' => now()]);

        // Kick off nginx + TLS provisioning immediately so the domain goes live
        // within seconds rather than waiting on the periodic backstop timer.
        ProvisionDomainJob::dispatch();

        return back()->with('success', 'Domain verified. It will go live once the certificate is issued (usually within a few minutes).');
    }

    /** Disconnect the custom domain. */
    public function destroy(): RedirectResponse
    {
        $site = $this->resolveSite();
        $site->update([
            'custom_domain' => null,
            'domain_token' => null,
            'domain_verified_at' => null,
            'domain_provisioned_at' => null,
        ]);

        return back()->with('success', 'Custom domain disconnected.');
    }
}
