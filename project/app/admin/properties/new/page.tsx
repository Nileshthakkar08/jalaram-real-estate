'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { PropertyForm } from '@/components/property/property-form';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { ManagedProperty } from '@/lib/types';

export default function AdminNewPropertyPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Add a property"
        description="Step 1 of 2: property details. Put the real owner's name and phone under contact details. You'll add photos or a video next, then publish."
      />
      <PropertyForm
        staff
        submitLabel="Save draft & add photos"
        onSubmit={async (payload) => {
          const res = await api.post<{ data: ManagedProperty }>('/admin/properties', payload);
          toast({ title: 'Draft saved', description: 'Now add photos or a video, then publish.' });
          router.push(`/admin/properties/${res.data.id}?tab=photos`);
        }}
      />
    </>
  );
}
