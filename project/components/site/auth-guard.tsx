'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, homeFor } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import type { UserRole } from '@/lib/types';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

/**
 * Client-side routing guard for a smoother UX. Real enforcement happens on the API:
 * every protected endpoint checks the session, role, permissions and record ownership.
 */
export function AuthGuard({ children, roles }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
    } else if (!allowed) {
      router.replace(homeFor(user));
    }
  }, [loading, user, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
