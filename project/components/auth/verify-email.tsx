'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth, homeFor } from '@/lib/auth-context';

export function VerifyEmail() {
  const params = useSearchParams();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const id = params.get('id');
    const hash = params.get('hash');
    const expires = params.get('expires');
    const signature = params.get('signature');
    if (!id || !hash || !expires || !signature) {
      setState('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    api.get<{ message: string }>(`/auth/verify-email/${encodeURIComponent(id)}/${encodeURIComponent(hash)}?expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`)
      .then((res) => { setState('done'); setMessage(res.message); refresh(); })
      .catch((err) => { setState('error'); setMessage(errorMessage(err)); });
  }, [params, refresh]);

  const resend = async () => {
    try {
      const res = await api.post<{ message: string }>('/auth/email/verification-notification');
      setMessage(res.message);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <div className="text-center" role="status">
      {state === 'working' && <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />}
      {state === 'done' && <CheckCircle2 className="mx-auto h-10 w-10 text-success" />}
      {state === 'error' && <XCircle className="mx-auto h-10 w-10 text-destructive" />}
      <p className="mt-3 text-sm text-muted-foreground">{state === 'working' ? 'Verifying your email…' : message}</p>
      <div className="mt-4 flex justify-center gap-4 text-sm">
        {user ? <Link href={homeFor(user)} className="font-medium text-primary hover:underline">Go to your dashboard</Link> : <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>}
        {state === 'error' && user && !user.email_verified && <button onClick={resend} className="text-primary hover:underline">Send a new link</button>}
      </div>
    </div>
  );
}
