'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/shared/password-input';
import { Field } from '@/components/shared/form-field';
import { Section } from '@/components/shared/section';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/hooks/use-toast';

function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const handle = (err: unknown) => {
    if (err instanceof ApiError && err.status === 422) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
    else toast({ title: 'Could not save', description: errorMessage(err), variant: 'destructive' });
  };
  return { errors, setErrors, handle };
}

export function ProfileSettings() {
  const { user, refresh } = useAuth();
  const profile = useFormErrors();
  const password = useFormErrors();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [resent, setResent] = useState(false);

  if (!user) return null;

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSavingProfile(true);
    profile.setErrors({});
    try {
      await api.put('/auth/profile', { name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') });
      await refresh();
      toast({ title: 'Profile updated' });
    } catch (err) {
      profile.handle(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSavingPassword(true);
    password.setErrors({});
    try {
      await api.put('/auth/password', {
        current_password: fd.get('current_password'), password: fd.get('password'), password_confirmation: fd.get('password_confirmation'),
      });
      form.reset();
      toast({ title: 'Password changed' });
    } catch (err) {
      password.handle(err);
    } finally {
      setSavingPassword(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/email/verification-notification');
      setResent(true);
    } catch (err) {
      toast({ title: 'Could not send', description: errorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Your details">
        {!user.email_verified && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Your email address is not verified.{' '}
              {resent ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Link sent.</span>
                : <button type="button" onClick={resend} className="font-medium underline">Send verification link</button>}
            </div>
          </div>
        )}
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Full name" htmlFor="name" error={profile.errors.name}>
            <Input id="name" name="name" defaultValue={user.name} required />
          </Field>
          <Field label="Email" htmlFor="email" error={profile.errors.email} hint="Changing your email requires verifying it again.">
            <Input id="email" name="email" type="email" defaultValue={user.email} required />
          </Field>
          <Field label="Phone" htmlFor="phone" error={profile.errors.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ''} required />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile} className="gap-2">
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />} Save details
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Change password">
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Current password" htmlFor="current_password" error={password.errors.current_password}>
            <PasswordInput id="current_password" name="current_password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" htmlFor="new_password" error={password.errors.password} hint="At least 8 characters, with letters and numbers.">
            <PasswordInput id="new_password" name="password" autoComplete="new-password" required />
          </Field>
          <Field label="Confirm new password" htmlFor="password_confirmation">
            <PasswordInput id="password_confirmation" name="password_confirmation" autoComplete="new-password" required />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword} className="gap-2">
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />} Change password
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
