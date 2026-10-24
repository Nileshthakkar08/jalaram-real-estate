'use client';

import { PageHeader } from '@/components/shared/page-header';
import { LeadsList } from '@/components/team/leads-list';

export default function AdminLeadsListPage() {
  return (
    <>
      <PageHeader title="Leads" description="All leads across the team. Open a lead to assign or work on it." />
      <LeadsList />
    </>
  );
}
