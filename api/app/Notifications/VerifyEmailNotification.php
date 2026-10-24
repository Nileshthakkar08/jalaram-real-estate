<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // Relative signature so it validates regardless of which host proxies the API.
        $signed = URL::temporarySignedRoute('verification.verify', now()->addHours(24), [
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
        ], absolute: false);

        $query = parse_url($signed, PHP_URL_QUERY);
        $url = rtrim(config('app.frontend_url'), '/').'/verify-email?'.$query.'&'.http_build_query([
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
        ]);

        return (new MailMessage)
            ->subject('Verify your email — Jalaram Real Estate')
            ->line('Please confirm your email address to finish setting up your account.')
            ->action('Verify email', $url)
            ->line('This link expires in 24 hours.');
    }
}
