<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class GrantSuperAdmin extends Command
{
    protected $signature = 'admin:grant {email} {--revoke : Remove super admin instead of granting}';

    protected $description = 'Grant (or revoke) platform super admin access for a user by email';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error("No user found with email {$this->argument('email')}.");

            return self::FAILURE;
        }

        $grant = ! $this->option('revoke');
        $user->update(['is_super_admin' => $grant]);

        $this->info(($grant ? 'Granted' : 'Revoked')." super admin for {$user->email}.");

        return self::SUCCESS;
    }
}
