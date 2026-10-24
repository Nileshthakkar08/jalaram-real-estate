'use client';

import {
  BarChart3, Building2, CalendarCheck, Handshake, IndianRupee, Inbox, LayoutDashboard, ListTodo, UserCircle, Users,
} from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/shared/dashboard-shell';
import { NotificationBell } from '@/components/team/notification-bell';

const nav: NavItem[] = [
  { href: '/team', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/team/leads', label: 'Leads', icon: Inbox },
  { href: '/team/follow-ups', label: 'Follow-ups', icon: ListTodo },
  { href: '/team/site-visits', label: 'Site Visits', icon: CalendarCheck },
  { href: '/team/properties', label: 'Properties', icon: Building2 },
  { href: '/team/deals', label: 'Deals', icon: Handshake },
  { href: '/team/brokerage', label: 'Brokerage', icon: IndianRupee },
  { href: '/team/customers', label: 'Customers', icon: Users },
  { href: '/admin/properties', label: 'Listing Review', icon: BarChart3, permission: 'properties.moderate' },
  { href: '/team/profile', label: 'Profile', icon: UserCircle },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="Team Workspace" nav={nav} roles={['team_member', 'admin']} headerExtra={<NotificationBell />}>
      {children}
    </DashboardShell>
  );
}
