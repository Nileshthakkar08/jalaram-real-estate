'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Home, LogOut, Menu, ExternalLink, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AuthGuard } from '@/components/site/auth-guard';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Permission, UserRole } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: Permission;
  roles?: UserRole[];
}

interface DashboardShellProps {
  title: string;
  nav: NavItem[];
  roles: UserRole[];
  children: ReactNode;
  headerExtra?: ReactNode;
}

/** Shared authenticated layout for the owner, team and admin portals. */
export function DashboardShell({ title, nav, roles, children, headerExtra }: DashboardShellProps) {
  return (
    <AuthGuard roles={roles}>
      <ShellInner title={title} nav={nav} headerExtra={headerExtra}>{children}</ShellInner>
    </AuthGuard>
  );
}

function ShellInner({ title, nav, children, headerExtra }: Omit<DashboardShellProps, 'roles'>) {
  const pathname = usePathname();
  const { user, signOut, can } = useAuth();
  const [open, setOpen] = useState(false);

  const items = nav.filter((item) => (!item.permission || can(item.permission)) && (!item.roles || (user && item.roles.includes(user.role))));
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/'));

  const NavLinks = () => (
    <nav className="flex flex-col gap-1" aria-label={`${title} navigation`}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(item) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(item) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <item.icon className={cn('h-4 w-4', isActive(item) ? 'text-accent' : '')} />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const Brand = () => (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
        <Home className="h-5 w-5 text-accent" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-serif text-lg font-bold text-primary">Jalaram</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-accent">{title}</span>
      </div>
    </Link>
  );

  const Footer = () => (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="px-3">
        <p className="truncate text-sm font-medium">{user?.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>
      {user?.role !== 'owner' && (
        <div className="flex gap-1 px-3 text-xs">
          {user?.role === 'admin' && <Link href="/admin" className="text-primary hover:underline">Admin</Link>}
          {user?.role === 'admin' && <span className="text-muted-foreground">·</span>}
          <Link href="/team" className="text-primary hover:underline">Team</Link>
        </div>
      )}
      <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
        <ExternalLink className="h-4 w-4" /> View website
      </Link>
      <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#dashboard-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-card focus:p-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-border bg-card p-4 lg:flex">
        <div className="space-y-6 overflow-y-auto">
          <Brand />
          <NavLinks />
        </div>
        <Footer />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          {headerExtra}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                <SheetHeader><SheetTitle className="text-left">{title}</SheetTitle></SheetHeader>
                <NavLinks />
              </div>
              <Footer />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="lg:pl-64">
        {headerExtra && (
          <div className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-card/90 px-8 backdrop-blur lg:flex">
            {headerExtra}
          </div>
        )}
        <main id="dashboard-main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
