'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Send } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, LoadingState } from '@/components/shared/states';
import { Section } from '@/components/shared/section';
import { PropertyForm } from '@/components/property/property-form';
import { ImageManager } from '@/components/property/image-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/use-api';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { ManagedProperty } from '@/lib/types';

const LIVE = ['published', 'unavailable', 'expired'];

function EditProperty() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { data, loading, error, reload, setData } = useApi<{ data: ManagedProperty }>(`/owner/properties/${id}`);

  const submit = async () => {
    try {
      await api.post(`/owner/properties/${id}/submit`);
      toast({ title: 'Submitted for review', description: 'We will notify you once our team has reviewed your listing.' });
      router.push(`/dashboard/properties/${id}`);
    } catch (err) {
      toast({ title: 'Cannot submit yet', description: errorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <DataState loading={loading} error={error} data={data} onRetry={reload}>
      {({ data: property }) => {
        const locked = ['closed', 'suspended'].includes(property.status);
        const canSubmit = ['draft', 'rejected'].includes(property.status);
        return (
          <>
            <PageHeader
              title={`Edit ${property.reference_code}`}
              description={property.title}
              actions={
                <>
                  <Button asChild variant="outline" className="gap-2"><Link href={`/dashboard/properties/${id}`}><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
                  {canSubmit && <Button onClick={submit} className="gap-2"><Send className="h-4 w-4" /> Submit for review</Button>}
                </>
              }
            />
            {locked && (
              <p className="mb-4 rounded-lg bg-muted p-3 text-sm">This listing is {property.status} and can no longer be edited. Contact Jalaram if you need changes.</p>
            )}
            {LIVE.includes(property.status) && (
              <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This listing is live. Saving changes or changing photos sends it back to Jalaram for review, and it will be hidden from the website until approved.
              </p>
            )}
            {property.status === 'rejected' && property.rejection_reason && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <strong>Changes requested:</strong> {property.rejection_reason}
              </p>
            )}
            {!locked && (
              <Tabs defaultValue={params.get('step') === 'photos' ? 'photos' : 'details'}>
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="photos">Photos ({property.images?.length ?? 0})</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="mt-6">
                  <PropertyForm
                    initial={property}
                    submitLabel="Save changes"
                    onSubmit={async (payload) => {
                      const res = await api.put<{ data: ManagedProperty; meta?: { resubmitted_for_review?: boolean } }>(`/owner/properties/${id}`, payload);
                      setData({ data: res.data });
                      toast({
                        title: 'Changes saved',
                        description: res.meta?.resubmitted_for_review ? 'Your listing has been sent back to Jalaram for review.' : undefined,
                      });
                    }}
                  />
                </TabsContent>
                <TabsContent value="photos" className="mt-6">
                  <Section title="Photos">
                    <ImageManager
                      basePath={`/owner/properties/${id}`}
                      images={property.images ?? []}
                      onChange={(images, meta) => {
                        setData({ data: { ...property, images, status: meta?.resubmitted_for_review ? 'pending' : property.status } });
                        if (meta?.resubmitted_for_review) toast({ title: 'Sent back for review', description: 'Photo changes on a live listing are reviewed before going live.' });
                      }}
                    />
                  </Section>
                  {canSubmit && (
                    <div className="mt-6 flex justify-end">
                      <Button onClick={submit} className="gap-2"><Send className="h-4 w-4" /> Submit for review</Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        );
      }}
    </DataState>
  );
}

export default function EditPropertyPage() {
  return <Suspense fallback={<LoadingState />}><EditProperty /></Suspense>;
}
