'use client';

import { PageHeader } from '@/components/shared/page-header';
import { SiteVisitsList } from '@/components/team/site-visits-list';

export default function SiteVisitsPage() {
  return (
    <>
      <PageHeader title="Site visits" description="Requests from customers and scheduled visits. Confirm times with the owner before scheduling." />
      <SiteVisitsList />
    </>
  );
}
