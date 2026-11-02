import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { RequirementForm } from '@/components/site/requirement-form';
import { serverApi } from '@/lib/server-api';

/** Short landing page for social media links (reels, stories): "tell us what you need". */
export const metadata: Metadata = {
  title: 'Tell Us Your Property Requirement',
  description: 'Share your budget, BHK and preferred area in Ahmedabad and the Jalaram Real Estate team will contact you with matching properties.',
  alternates: { canonical: '/requirement' },
  // A form with no listings of its own: reachable from links, kept out of search results.
  robots: { index: false, follow: true },
};

export default async function RequirementPage() {
  const localities = (await serverApi.maybe(serverApi.localities())) ?? [];

  return (
    <PublicLayout>
      <section className="bg-primary py-10 lg:py-14">
        <div className="container-mw container-px text-primary-foreground">
          <h1 className="max-w-2xl text-balance font-serif text-3xl font-bold lg:text-4xl">Tell us what you&apos;re looking for</h1>
          <p className="mt-3 max-w-xl text-primary-foreground/80">
            Fill this in under a minute. Tap the mic to speak instead of typing. Our team will contact you with matching properties.
          </p>
        </div>
      </section>
      <section className="py-8 lg:py-12">
        <div className="container-mw container-px">
          <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8">
            <RequirementForm localities={localities} />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
