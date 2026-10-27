'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, Loader2, PlusSquare, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enablePush, getPushPublicKey, pushSupported, refreshPushSubscription } from '@/lib/push';

const DISMISS_KEY = 'jre-push-prompt-dismissed-at';
const DISMISS_DAYS = 14;
const SHOW_AFTER_MS = 10_000;

type View = 'hidden' | 'ask' | 'ios-install' | 'working' | 'done';

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

/** iPhone/iPad (including iPadOS, which reports itself as a Mac with touch). */
function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Opened from the Home Screen icon rather than a browser tab. */
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Centered dialog offering browser notifications for new properties. Our own dialog comes first;
 * the browser's permission prompt only appears after "Allow". On iPhone, where browsers only
 * support notifications for Home Screen web apps, it explains how to add the site instead.
 */
export function PushPrompt() {
  const [view, setView] = useState<View>('hidden');
  const allowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ios = isIos();
    const canPushHere = pushSupported();

    if (canPushHere && Notification.permission === 'granted') {
      refreshPushSubscription().catch(() => undefined);
      return;
    }
    if ((canPushHere && Notification.permission === 'denied') || recentlyDismissed()) return;
    // Only iPhones in a browser tab get the "add to Home Screen" variant; other unsupported browsers get nothing.
    if (!canPushHere && !(ios && !isStandalone())) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || !(await getPushPublicKey())) return;
      setView(canPushHere ? 'ask' : 'ios-install');
    }, SHOW_AFTER_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    rememberDismissal();
    setView('hidden');
  }

  const open = view !== 'hidden';

  // Escape closes; focus the main button when the dialog opens.
  useEffect(() => {
    if (!open) return;
    allowRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const allow = async () => {
    setView('working');
    try {
      const result = await enablePush();
      if (result === 'subscribed') {
        setView('done');
        window.setTimeout(() => setView('hidden'), 3000);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && view !== 'working') dismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
        className="relative w-full max-w-md animate-scale-in rounded-2xl border border-border bg-card p-6 text-center shadow-2xl sm:p-8"
      >
        {view !== 'done' && (
          <button type="button" onClick={dismiss} disabled={view === 'working'} className="absolute right-3 top-3 rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        )}

        {view === 'done' ? (
          <div role="status">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <p className="mt-4 font-serif text-xl font-semibold">You&apos;re subscribed</p>
            <p className="mt-2 text-sm text-muted-foreground">We&apos;ll notify you when new properties are listed.</p>
          </div>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Bell className="h-8 w-8 text-accent" />
            </div>
            <h2 id="push-prompt-title" className="mt-5 font-serif text-2xl font-bold">Get alerts for new properties</h2>

            {view === 'ios-install' ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  On iPhone, notifications work when you add Jalaram Real Estate to your Home Screen:
                </p>
                <ol className="mt-5 space-y-3 text-left text-sm">
                  <li className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                    <Share className="h-5 w-5 shrink-0 text-primary" />
                    <span>Tap the <strong>Share</strong> button in your browser</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                    <PlusSquare className="h-5 w-5 shrink-0 text-primary" />
                    <span>Choose <strong>Add to Home Screen</strong></span>
                  </li>
                  <li className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                    <Bell className="h-5 w-5 shrink-0 text-primary" />
                    <span>Open the site from the new icon and tap <strong>Allow</strong></span>
                  </li>
                </ol>
                <Button ref={allowRef} type="button" onClick={dismiss} className="mt-6 w-full">Got it</Button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Be the first to know when a new property is listed. No personal details needed — turn it off anytime.
                </p>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                  <Button type="button" variant="outline" onClick={dismiss} disabled={view === 'working'} className="sm:min-w-32">
                    Not now
                  </Button>
                  <Button ref={allowRef} type="button" onClick={allow} disabled={view === 'working'} className="gap-2 sm:min-w-40">
                    {view === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Allow notifications
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
