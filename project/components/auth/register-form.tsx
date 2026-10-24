'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { useAuth } from '@/lib/auth-context';
import { ApiError, errorMessage } from '@/lib/api';
import { safeRedirect } from '@/lib/safe-redirect';

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await register({
        name: String(fd.get('name')),
        email: String(fd.get('email')),
        phone: String(fd.get('phone')),
        password: String(fd.get('password')),
        password_confirmation: String(fd.get('password_confirmation')),
      });
      // New accounts are always owners, so only owner-area redirects are honoured.
      const target = safeRedirect(params.get('redirect'), '/dashboard');
      router.replace(target.startsWith('/dashboard') ? target : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      } else {
        setError(errorMessage(err));
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name" htmlFor="name" error={errors.name}>
        <Input id="name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={errors.phone} hint="Our team uses this to coordinate visits with you.">
        <Input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="+91 98XXX XXXXX" />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters, with letters and numbers.">
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm password" htmlFor="password_confirmation">
        <Input id="password_confirmation" name="password_confirmation" type="password" required autoComplete="new-password" />
      </Field>
      <p className="text-xs text-muted-foreground">
        By creating an account you agree to our <a href="/terms" className="underline">terms</a> and{' '}
        <a href="/privacy-policy" className="underline">privacy policy</a>. Owner accounts are for listing your own property.
      </p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create owner account
      </Button>
    </form>
  );
}
