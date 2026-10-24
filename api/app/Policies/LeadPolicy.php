<?php

namespace App\Policies;

use App\Models\Lead;
use App\Models\User;

class LeadPolicy
{
    public function view(User $user, Lead $lead): bool
    {
        return $user->isStaff()
            && ($user->hasPermission('leads.view_all') || $lead->assigned_to === null || $lead->assigned_to === $user->id);
    }

    /** Working a lead (notes, status, follow-ups) requires it to be yours, or broad lead access. */
    public function work(User $user, Lead $lead): bool
    {
        return $user->isStaff() && ($user->hasPermission('leads.view_all') || $lead->assigned_to === $user->id);
    }

    /** Anyone on the team may claim an unassigned lead; assigning to others or reassigning needs leads.assign. */
    public function assign(User $user, Lead $lead, User $assignee): bool
    {
        if (! $user->isStaff()) {
            return false;
        }
        if ($user->hasPermission('leads.assign')) {
            return true;
        }

        return $lead->assigned_to === null && $assignee->id === $user->id;
    }
}
