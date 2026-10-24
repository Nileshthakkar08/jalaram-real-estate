'use client';

import { Phone, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { callLink, whatsappLink } from '@/lib/business';
import { usePublicSettings } from '@/lib/settings-context';
import type { PublicProperty } from '@/lib/types';

export function PropertyContactPanel({ property }: { property: PublicProperty }) {
  const settings = usePublicSettings();
  const phoneHref = callLink(settings);
  const whatsappHref = whatsappLink(settings, `Hello, I'm interested in ${property.title} (Ref: ${property.reference_code}).`);
  const interest = property.listing_purpose === 'sale' ? 'buy' : 'rent';

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-serif text-lg font-semibold">Interested in this property?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Our team handles all enquiries for this listing. We&apos;ll call you, coordinate with the owner and arrange a visit.
      </p>

      {(phoneHref || whatsappHref) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {phoneHref && (
            <a href={phoneHref} className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <Phone className="h-4 w-4 text-accent" /> Call
            </a>
          )}
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="my-5 h-px bg-border" />

      <Tabs defaultValue="enquiry">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="enquiry">Enquire</TabsTrigger>
          <TabsTrigger value="visit">Book a Visit</TabsTrigger>
        </TabsList>
        <TabsContent value="enquiry" className="mt-4">
          <EnquiryForm propertyId={property.id} propertyTitle={property.title} leadType={interest} compact />
        </TabsContent>
        <TabsContent value="visit" className="mt-4">
          <EnquiryForm propertyId={property.id} propertyTitle={property.title} leadType={interest} mode="visit" compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}
