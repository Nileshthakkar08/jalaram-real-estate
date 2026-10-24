'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Phone, Home, LogIn, UserPlus, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { callLink } from '@/lib/business';
import { homeFor } from '@/lib/auth-context';
import { usePublicSettings } from '@/lib/settings-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navLinks = [
  { href: '/buy', label: 'Buy' },
  { href: '/rent', label: 'Rent' },
  { href: '/sell-property', label: 'Sell' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const settings = usePublicSettings();
  const phoneHref = callLink(settings);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const dashboardLink = homeFor(user);
  const profileLink = user?.role === 'owner' ? '/dashboard/profile' : '/team/profile';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-card/90 backdrop-blur-md">
      <div className="container-mw container-px flex h-16 items-center justify-between lg:h-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary lg:h-10 lg:w-10">
            <Home className="h-5 w-5 text-accent lg:h-6 lg:w-6" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-lg font-bold text-primary lg:text-xl">
              Jalaram
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-accent lg:text-xs">
              Real Estate
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative px-4 py-2 text-sm font-medium transition-colors hover:text-primary',
                isActive(link.href) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 lg:flex">
          {phoneHref && (
            <a
              href={phoneHref}
              className="flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
            >
              <Phone className="h-4 w-4 text-accent" />
              {settings.business_phone}
            </a>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" aria-label="Account menu">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={dashboardLink} className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={profileLink} className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/login"><LogIn className="h-4 w-4" /> Sign In</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5 bg-primary">
                <Link href="/list-property"><UserPlus className="h-4 w-4" /> List Property</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-primary lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-card lg:hidden">
          <nav className="container-mw container-px flex flex-col py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-lg px-4 py-3 text-base font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-primary/5 text-primary'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-3 h-px bg-border" />
            {phoneHref && (
              <a
                href={phoneHref}
                className="flex items-center gap-2 px-4 py-3 text-base font-medium text-primary"
              >
                <Phone className="h-4 w-4 text-accent" /> {settings.business_phone}
              </a>
            )}
            {user ? (
              <>
                <Link
                  href={dashboardLink}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-4 py-3 text-base font-medium text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 px-4">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
                </Button>
                <Button asChild className="flex-1 bg-primary">
                  <Link href="/register" onClick={() => setMobileOpen(false)}>Register</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
