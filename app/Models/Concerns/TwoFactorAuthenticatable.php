<?php

namespace App\Models\Concerns;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

/**
 * App-secret (TOTP) two-factor authentication, modelled on Fortify's contract but
 * implemented locally (Fortify's QR dependency conflicts with simple-qrcode). The
 * secret and recovery codes are stored encrypted; the QR is rendered client-side
 * from the otpauth:// URI.
 */
trait TwoFactorAuthenticatable
{
    public function initializeTwoFactorAuthenticatable(): void
    {
        $this->casts['two_factor_secret'] = 'encrypted';
        $this->casts['two_factor_recovery_codes'] = 'encrypted';
        $this->casts['two_factor_confirmed_at'] = 'datetime';
    }

    protected static function google2fa(): Google2FA
    {
        return new Google2FA;
    }

    /** Begin enabling 2FA: generate a fresh secret + recovery codes, not yet confirmed. */
    public function enableTwoFactorAuthentication(): void
    {
        $this->forceFill([
            'two_factor_secret' => static::google2fa()->generateSecretKey(),
            'two_factor_recovery_codes' => json_encode(self::generateRecoveryCodes()),
            'two_factor_confirmed_at' => null,
        ])->save();
    }

    /** Verify the first code and, if valid, mark 2FA confirmed. */
    public function confirmTwoFactorAuthentication(string $code): bool
    {
        if (! $this->two_factor_secret || ! $this->verifyTwoFactorCode($code)) {
            return false;
        }

        $this->forceFill(['two_factor_confirmed_at' => now()])->save();

        return true;
    }

    public function disableTwoFactorAuthentication(): void
    {
        $this->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
    }

    public function hasEnabledTwoFactorAuthentication(): bool
    {
        return ! is_null($this->two_factor_secret) && ! is_null($this->two_factor_confirmed_at);
    }

    /** Secret generated but the user hasn't verified a code yet. */
    public function hasPendingTwoFactorAuthentication(): bool
    {
        return ! is_null($this->two_factor_secret) && is_null($this->two_factor_confirmed_at);
    }

    public function verifyTwoFactorCode(string $code): bool
    {
        return $this->two_factor_secret
            && static::google2fa()->verifyKey((string) $this->two_factor_secret, preg_replace('/\s+/', '', $code));
    }

    /** Consume a one-time recovery code; returns true and removes it if matched. */
    public function useRecoveryCode(string $code): bool
    {
        $code = trim($code);
        $codes = $this->recoveryCodes();

        if (! in_array($code, $codes, true)) {
            return false;
        }

        $this->forceFill([
            'two_factor_recovery_codes' => json_encode(array_values(array_diff($codes, [$code]))),
        ])->save();

        return true;
    }

    /** @return array<int, string> */
    public function recoveryCodes(): array
    {
        return $this->two_factor_recovery_codes
            ? (json_decode($this->two_factor_recovery_codes, true) ?: [])
            : [];
    }

    public function regenerateRecoveryCodes(): void
    {
        $this->forceFill(['two_factor_recovery_codes' => json_encode(self::generateRecoveryCodes())])->save();
    }

    public function twoFactorQrCodeUri(): string
    {
        return static::google2fa()->getQRCodeUrl(
            config('app.name'),
            $this->email,
            (string) $this->two_factor_secret,
        );
    }

    /** Inline SVG QR for the otpauth URI (rendered server-side via simple-qrcode). */
    public function twoFactorQrCodeSvg(): string
    {
        return (string) QrCode::format('svg')
            ->size(192)
            ->margin(1)
            ->errorCorrection('M')
            ->generate($this->twoFactorQrCodeUri());
    }

    /** @return array<int, string> */
    protected static function generateRecoveryCodes(): array
    {
        return Collection::times(8, fn () => Str::upper(Str::random(5).'-'.Str::random(5)))->all();
    }
}
