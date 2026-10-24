'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { api, ApiError, errorMessage } from '@/lib/api';

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', { email: new FormData(e.currentTarget).get('email') });
      setDone(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 text-sm text-muted-foreground">{done}</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  if (!token || !email) {
    return <p className="text-sm text-destructive">This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.</p>;
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await api.post('/auth/reset-password', {
        token, email, password: fd.get('password'), password_confirmation: fd.get('password_confirmation'),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 text-sm text-muted-foreground">Your password has been reset.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {errors.email && <p className="text-sm text-destructive" role="alert">{errors.email}</p>}
      <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters, with letters and numbers.">
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="password_confirmation">
        <Input id="password_confirmation" name="password_confirmation" type="password" required autoComplete="new-password" />
      </Field>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reset password
      </Button>
    </form>
  );
}
