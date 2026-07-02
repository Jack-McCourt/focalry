<?php

namespace App\Models;

use App\Models\Concerns\TwoFactorAuthenticatable;
use App\Notifications\NotificationType;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    protected $fillable = [
        'studio_id',
        'name',
        'email',
        'password',
        'role',
        'is_super_admin',
        'notification_preferences',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_super_admin' => 'boolean',
            'notification_preferences' => 'array',
        ];
    }

    /**
     * Whether this user wants an email for a given notification type. Falls back
     * to the type's default when the user hasn't set an explicit preference.
     */
    public function wantsEmail(string $type): bool
    {
        $prefs = $this->notification_preferences ?? [];

        return (bool) ($prefs[$type] ?? NotificationType::emailsByDefault($type));
    }

    /**
     * Platform super admin — either flagged in the DB or present in the
     * configured allowlist (env SUPER_ADMIN_EMAILS), so access can be
     * bootstrapped without a DB write.
     */
    public function isSuperAdmin(): bool
    {
        $flagged = array_key_exists('is_super_admin', $this->getAttributes())
            && (bool) $this->is_super_admin;

        return $flagged
            || in_array(strtolower($this->email), config('admin.emails', []), true);
    }

    public function studio(): BelongsTo
    {
        return $this->belongsTo(Studio::class);
    }

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['owner', 'admin']);
    }
}
