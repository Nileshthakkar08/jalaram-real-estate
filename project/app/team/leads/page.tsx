'use client';

import { PageHeader } from '@/components/shared/page-header';
import { LeadsList } from '@/components/team/leads-list';
import { NewLeadDialog } from '@/components/team/new-lead-dialog';

export default function TeamLeadsPage() {
  return (
    <>
      <PageHeader title="Leads" description="Your leads plus the unassigned inbox. Claim a lead to start working on it." actions={<NewLeadDialog />} />
      <LeadsList />
    </>
  );
}
