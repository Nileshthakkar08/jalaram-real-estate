<?php

namespace App\Policies;

use App\Models\Deal;
use App\Models\User;

class DealPolicy
{
    public function view(User $user, Deal $deal): bool
    {
        return $user->isStaff() && ($user->hasPermission('finance.manage') || $deal->assigned_to === $user->id);
    }

    public function update(User $user, Deal $deal): bool
    {
        return $this->view($user, $deal);
    }

    /** Payments, refunds, waivers, voids, changes to agreed amounts and cancellations. */
    public function manageFinance(User $user, ?Deal $deal = null): bool
    {
        return $user->isStaff() && $user->hasPermission('finance.manage');
    }
}
