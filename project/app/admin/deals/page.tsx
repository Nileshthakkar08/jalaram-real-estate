'use client';

import { PageHeader } from '@/components/shared/page-header';
import { DealsList } from '@/components/team/deals-list';

export default function AdminDealsListPage() {
  return (
    <>
      <PageHeader title="Deals" description="All deals and their brokerage status." />
      <DealsList />
    </>
  );
}
