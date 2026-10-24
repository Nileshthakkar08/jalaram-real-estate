'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, CalendarCheck, FileClock, Handshake, Inbox, LayoutDashboard, MapPin, Percent, PieChart, Settings, Sparkles, Users,
} from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/shared/dashboard-shell';
import { useAuth } from '@/lib/auth-context';

const nav: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true, roles: ['admin'] },
  { href: '/admin/properties', label: 'Listing Review', icon: Building2, permission: 'properties.moderate' },
  { href: '/admin/leads', label: 'Leads', icon: Inbox, roles: ['admin'] },
  { href: '/admin/site-visits', label: 'Site Visits', icon: CalendarCheck, roles: ['admin'] },
  { href: '/admin/deals', label: 'Deals', icon: Handshake, roles: ['admin'] },
  { href: '/admin/reports', label: 'Finance Reports', icon: PieChart, roles: ['admin'] },
  { href: '/admin/brokerage-rules', label: 'Brokerage Rules', icon: Percent, roles: ['admin'] },
  { href: '/admin/users', label: 'Users & Roles', icon: Users, roles: ['admin'] },
  { href: '/admin/localities', label: 'Localities', icon: MapPin, roles: ['admin'] },
  { href: '/admin/amenities', label: 'Amenities', icon: Sparkles, roles: ['admin'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileClock, roles: ['admin'] },
];

/** Moderators (team members with properties.moderate) may only use listing review. */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, can } = useAuth();
  const pathname = usePathname();
  const allowed = user?.role === 'admin' || (pathname.startsWith('/admin/properties') && can('properties.moderate'));

  if (!allowed) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="font-serif text-xl font-bold">Administrator access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">This area is limited to Jalaram administrators.</p>
        <Link href="/team" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Back to the team workspace</Link>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Administration" nav={nav} roles={['admin', 'team_member']}>
      <AdminGate>{children}</AdminGate>
    </DashboardShell>
  );
}
