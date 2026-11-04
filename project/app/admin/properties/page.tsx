'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { PropertiesBrowser } from '@/components/team/properties-browser';

export default function AdminPropertiesPage() {
  return (
    <>
      <PageHeader title="Listing review" description="Pending listings are shown first. Approve, reject with a reason, suspend or close."
        actions={<Button asChild className="gap-2"><Link href="/admin/properties/new"><Plus className="h-4 w-4" /> Add property</Link></Button>}
      />
      <PropertiesBrowser basePath="/admin/properties" detailBase="/admin/properties" endpoint="/admin/properties" />
    </>
  );
}
