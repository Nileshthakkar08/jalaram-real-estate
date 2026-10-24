'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/shared/form-field';
import { useAuth, homeFor } from '@/lib/auth-context';
import { ApiError, errorMessage } from '@/lib/api';
import { safeRedirect } from '@/lib/safe-redirect';

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(String(fd.get('email')), String(fd.get('password')), remember);
      const fallback = homeFor(user);
      const target = safeRedirect(params.get('redirect'), fallback);
      // Owners shouldn't be bounced into staff areas and vice versa.
      const allowed = user.role === 'owner' ? target.startsWith('/dashboard') || !/^\/(team|admin)/.test(target) : !target.startsWith('/dashboard');
      router.replace(allowed ? target : fallback);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? err.field('email') ?? err.message : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <Label htmlFor="remember" className="text-sm font-normal">Keep me signed in</Label>
        </div>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Sign in
      </Button>
    </form>
  );
}
