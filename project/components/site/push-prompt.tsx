'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enablePush, getPushPublicKey, pushSupported, refreshPushSubscription } from '@/lib/push';

const DISMISS_KEY = 'jre-push-prompt-dismissed-at';
const DISMISS_DAYS = 14;
const SHOW_AFTER_MS = 10_000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode: just don't remember */
  }
}

/**
 * Asks visitors whether they want a browser notification when new properties are listed.
 * Our own card comes first; the browser's permission dialog only appears after "Allow".
 */
export function PushPrompt() {
  const [state, setState] = useState<'hidden' | 'ask' | 'working' | 'done'>('hidden');

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === 'granted') {
      refreshPushSubscription().catch(() => undefined);
      return;
    }
    if (Notification.permission === 'denied' || recentlyDismissed()) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!cancelled && (await getPushPublicKey())) setState('ask');
    }, SHOW_AFTER_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (state === 'hidden') return null;

  const dismiss = () => {
    rememberDismissal();
    setState('hidden');
  };

  const allow = async () => {
    setState('working');
    try {
      const result = await enablePush();
      if (result === 'subscribed') {
        setState('done');
        window.setTimeout(() => setState('hidden'), 4000);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      className="fixed bottom-4 left-4 right-20 z-50 max-w-sm animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-2xl sm:right-auto lg:bottom-6 lg:left-6"
    >
      {state === 'done' ? (
        <p className="flex items-center gap-2 text-sm font-medium" role="status">
          <CheckCircle2 className="h-5 w-5 text-success" /> You&apos;ll be notified when new properties are listed.
        </p>
      ) : (
        <>
          <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Bell className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p id="push-prompt-title" className="font-serif text-base font-semibold">Get alerts for new properties</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll send a browser notification when a new property is listed. No personal details needed — turn it off anytime.
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={dismiss} disabled={state === 'working'}>Not now</Button>
            <Button type="button" size="sm" onClick={allow} disabled={state === 'working'} className="gap-1.5">
              {state === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Allow
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
