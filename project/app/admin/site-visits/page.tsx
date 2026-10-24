'use client';

import { PageHeader } from '@/components/shared/page-header';
import { SiteVisitsList } from '@/components/team/site-visits-list';

export default function AdminSiteVisitsListPage() {
  return (
    <>
      <PageHeader title="Site Visits" description="All requested and scheduled site visits." />
      <SiteVisitsList />
    </>
  );
}
