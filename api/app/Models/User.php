<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'phone', 'password', 'role', 'permissions', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes;

    public const ROLE_OWNER = 'owner';

    public const ROLE_TEAM = 'team_member';

    public const ROLE_ADMIN = 'admin';

    public const ROLES = [self::ROLE_OWNER, self::ROLE_TEAM, self::ROLE_ADMIN];

    /** Grantable to team members; admins implicitly hold every permission. */
    public const PERMISSIONS = [
        'leads.view_all' => 'View every lead, not only assigned and unassigned ones',
        'leads.assign' => 'Assign and reassign leads to other team members',
        'properties.moderate' => 'Approve, reject and suspend property listings',
        'finance.manage' => 'Record brokerage payments, overrides, refunds and waivers; view all deals',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'permissions' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isOwner(): bool
    {
        return $this->role === self::ROLE_OWNER;
    }

    /** Internal Jalaram staff: team members and admins. */
    public function isStaff(): bool
    {
        return in_array($this->role, [self::ROLE_TEAM, self::ROLE_ADMIN], true);
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isAdmin()) {
            return true;
        }

        return $this->role === self::ROLE_TEAM && in_array($permission, $this->permissions ?? [], true);
    }

    public function effectivePermissions(): array
    {
        if ($this->isAdmin()) {
            return array_keys(self::PERMISSIONS);
        }

        return $this->role === self::ROLE_TEAM ? array_values($this->permissions ?? []) : [];
    }

    public function scopeStaff(Builder $query): Builder
    {
        return $query->whereIn('role', [self::ROLE_TEAM, self::ROLE_ADMIN])->where('is_active', true);
    }

    public function properties(): HasMany
    {
        return $this->hasMany(Property::class, 'owner_id');
    }

    public function assignedLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'assigned_to');
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }
}
