<?php

namespace App\Policies;

use App\Models\Property;
use App\Models\User;

class PropertyPolicy
{
    /** Owners only ever reach their own listings. */
    public function ownerView(User $user, Property $property): bool
    {
        return $user->isOwner() && $property->owner_id === $user->id;
    }

    public function ownerUpdate(User $user, Property $property): bool
    {
        return $this->ownerView($user, $property);
    }

    public function ownerDelete(User $user, Property $property): bool
    {
        return $this->ownerView($user, $property) && in_array($property->status, ['draft', 'rejected'], true);
    }

    public function moderate(User $user, ?Property $property = null): bool
    {
        return $user->isStaff() && $user->hasPermission('properties.moderate');
    }
}
