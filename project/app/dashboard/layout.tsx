'use client';

import { Building2, LayoutDashboard, PlusCircle, UserCircle } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/shared/dashboard-shell';

const nav: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/properties', label: 'My Listings', icon: Building2, exact: true },
  { href: '/dashboard/properties/new', label: 'Add Listing', icon: PlusCircle },
  { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Owner Portal" nav={nav} roles={['owner']}>{children}</DashboardShell>;
}
