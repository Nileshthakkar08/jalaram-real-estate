<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LeadAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(public Lead $lead) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'assigned',
            'lead_id' => $this->lead->id,
            'reference' => $this->lead->reference_code,
            'name' => $this->lead->name,
            'interest' => $this->lead->interest,
            'property_title' => $this->lead->property?->title,
        ];
    }
}
