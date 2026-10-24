'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { PropertyForm } from '@/components/property/property-form';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { ManagedProperty } from '@/lib/types';

export default function NewPropertyPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader title="Add a listing" description="Step 1 of 2: property details. You'll add photos next. Your listing stays a private draft until you submit it." />
      <PropertyForm
        submitLabel="Save draft & add photos"
        onSubmit={async (payload) => {
          const res = await api.post<{ data: ManagedProperty }>('/owner/properties', payload);
          toast({ title: 'Draft saved', description: 'Now add photos and submit for review.' });
          router.push(`/dashboard/properties/${res.data.id}/edit?step=photos`);
        }}
      />
    </>
  );
}
