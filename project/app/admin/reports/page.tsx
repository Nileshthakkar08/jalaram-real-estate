'use client';

import { PageHeader } from '@/components/shared/page-header';
import { FinanceReportView } from '@/components/team/finance-report';

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader title="Finance reports" description="Brokerage earned and collected by Jalaram. Property prices and rents are not revenue and are never included." />
      <FinanceReportView endpoint="/admin/reports/finance" />
    </>
  );
}
