'use client';

import Link from 'next/link';
import { ArrowRight, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import { useAuth, homeFor } from '@/lib/auth-context';

export function ListPropertyActions() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  if (user?.role === 'owner') {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="font-serif text-2xl font-bold">Welcome back, {user.name.split(' ')[0]}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Start a new listing or continue with a draft.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard/properties/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Create a listing <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard/properties" className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
            My listings
          </Link>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="font-serif text-2xl font-bold">You are signed in as Jalaram staff</h2>
        <p className="mt-2 text-sm text-muted-foreground">Owner listings are created from owner accounts. Use the team workspace to manage listings.</p>
        <Link href={homeFor(user)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          <LayoutDashboard className="h-4 w-4" /> Go to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-6">
        <UserPlus className="h-8 w-8 text-accent" />
        <h2 className="mt-4 font-serif text-xl font-bold">New to Jalaram?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create a free owner account to add your property, upload photos and track its review status.</p>
        <Link href="/register?redirect=/dashboard/properties/new" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Create owner account <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <LogIn className="h-8 w-8 text-accent" />
        <h2 className="mt-4 font-serif text-xl font-bold">Already registered?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to create a new listing or manage your existing ones.</p>
        <Link href="/login?redirect=/dashboard/properties/new" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
          Sign in <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
