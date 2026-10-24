'use client';

import { PageHeader } from '@/components/shared/page-header';
import { PropertiesBrowser } from '@/components/team/properties-browser';

export default function TeamPropertiesPage() {
  return (
    <>
      <PageHeader title="Properties" description="All submitted listings with private owner details for coordination." />
      <PropertiesBrowser basePath="/team/properties" detailBase="/team/properties" endpoint="/team/properties" />
    </>
  );
}
