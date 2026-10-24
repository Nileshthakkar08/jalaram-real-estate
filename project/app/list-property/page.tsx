import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { ContentHero } from '@/components/site/content-page';
import { ListPropertyActions } from '@/components/site/list-property-actions';

export const metadata: Metadata = {
  title: 'List Your Property',
  description: 'Create a free owner account and list your Ahmedabad property with Jalaram Real Estate.',
  alternates: { canonical: '/list-property' },
};

export default function ListPropertyPage() {
  return (
    <PublicLayout>
      <ContentHero
        eyebrow="Owner Portal"
        title="List your property"
        intro="Create your listing in the owner portal. Our team reviews it before publishing, and every enquiry comes to Jalaram — we coordinate with you for visits."
      />
      <section className="py-14">
        <div className="container-mw container-px">
          <ListPropertyActions />
        </div>
      </section>
    </PublicLayout>
  );
}
