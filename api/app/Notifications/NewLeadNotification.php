<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/** In-app alert to the team when a new enquiry or site-visit request arrives. */
class NewLeadNotification extends Notification
{
    use Queueable;

    public function __construct(public Lead $lead, public string $kind = 'enquiry') {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'lead_id' => $this->lead->id,
            'reference' => $this->lead->reference_code,
            'name' => $this->lead->name,
            'interest' => $this->lead->interest,
            'property_title' => $this->lead->property?->title,
        ];
    }
}
