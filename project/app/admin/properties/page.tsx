'use client';

import { PageHeader } from '@/components/shared/page-header';
import { PropertiesBrowser } from '@/components/team/properties-browser';

export default function AdminPropertiesPage() {
  return (
    <>
      <PageHeader title="Listing review" description="Pending listings are shown first. Approve, reject with a reason, suspend or close." />
      <PropertiesBrowser basePath="/admin/properties" detailBase="/admin/properties" endpoint="/admin/properties" />
    </>
  );
}
