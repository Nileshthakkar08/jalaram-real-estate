'use client';

import { PageHeader } from '@/components/shared/page-header';
import { FinanceReportView } from '@/components/team/finance-report';

export default function BrokeragePage() {
  return (
    <>
      <PageHeader title="Brokerage" description="Expected, agreed, invoiced, collected and outstanding brokerage are tracked separately." />
      <FinanceReportView endpoint="/team/brokerage/summary" />
    </>
  );
}
