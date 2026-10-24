'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DealsList } from '@/components/team/deals-list';

export default function DealsPage() {
  return (
    <>
      <PageHeader title="Deals" description="Open a deal from a lead. Brokerage is agreed per party and payments are recorded on the deal." />
      <DealsList />
    </>
  );
}
