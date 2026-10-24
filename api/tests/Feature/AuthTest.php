<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthTest extends TestCase
{
    private array $spa = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/'];

    public function test_registration_always_creates_an_owner_even_if_a_role_is_supplied(): void
    {
        Notification::fake();

        $this->withHeaders($this->spa)->postJson('/api/v1/auth/register', [
            'name' => 'Ravi Shah', 'email' => 'Ravi@Example.com', 'phone' => '+91 98765 43210',
            'password' => 'secret123', 'password_confirmation' => 'secret123', 'role' => 'admin',
        ])->assertCreated()->assertJsonPath('data.role', 'owner');

        $user = User::where('email', 'ravi@example.com')->firstOrFail();
        $this->assertSame('owner', $user->role);
        $this->assertNotSame('secret123', $user->password);
        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }

    public function test_login_logout_and_current_user(): void
    {
        $user = $this->owner(['email' => 'o@example.com', 'password' => 'secret123']);

        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', ['email' => 'o@example.com', 'password' => 'wrong-pass'])
            ->assertStatus(422);
        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', ['email' => 'o@example.com', 'password' => 'secret123'])
            ->assertOk()->assertJsonPath('data.email', 'o@example.com');
        $this->withHeaders($this->spa)->getJson('/api/v1/auth/user')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->withHeaders($this->spa)->postJson('/api/v1/auth/logout')->assertOk();
    }

    public function test_login_is_rate_limited(): void
    {
        $this->owner(['email' => 'o@example.com']);
        for ($i = 0; $i < 5; $i++) {
            $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', ['email' => 'o@example.com', 'password' => 'nope'])->assertStatus(422);
        }
        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', ['email' => 'o@example.com', 'password' => 'nope'])->assertStatus(429);
    }

    public function test_deactivated_users_cannot_sign_in_or_use_the_api(): void
    {
        $user = $this->owner(['email' => 'off@example.com', 'password' => 'secret123', 'is_active' => false]);
        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', ['email' => 'off@example.com', 'password' => 'secret123'])->assertStatus(422);
        $this->as($user)->getJson('/api/v1/owner/properties')->assertForbidden();
    }

    public function test_forgot_password_does_not_reveal_accounts_and_reset_works(): void
    {
        Notification::fake();
        $user = $this->owner(['email' => 'reset@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'reset@example.com', 'password' => 'newpass123', 'password_confirmation' => 'newpass123',
        ])->assertOk();

        $this->withHeaders($this->spa)->postJson('/api/v1/auth/login', ['email' => 'reset@example.com', 'password' => 'newpass123'])->assertOk();
    }

    public function test_email_verification_with_relative_signed_url(): void
    {
        $user = $this->owner(['email_verified_at' => null]);
        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1($user->email)], absolute: false);

        $this->getJson($url)->assertOk();
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $this->getJson("/api/v1/auth/verify-email/{$user->id}/".sha1($user->email).'?signature=forged')->assertForbidden();
    }

    public function test_profile_update_cannot_change_role(): void
    {
        $user = $this->owner();
        $this->as($user)->putJson('/api/v1/auth/profile', ['name' => 'New Name', 'phone' => '9876543210', 'email' => $user->email, 'role' => 'admin'])
            ->assertOk()->assertJsonPath('data.role', 'owner');
        $this->assertSame('owner', $user->fresh()->role);
    }
}
