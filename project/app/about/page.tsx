import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Handshake, Headphones, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '@/components/site/public-layout';
import { ContentHero } from '@/components/site/content-page';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Jalaram Real Estate is a residential property brokerage in Ahmedabad that manages every enquiry, site visit and negotiation for buyers, tenants and owners.',
  alternates: { canonical: '/about' },
};

const principles = [
  { icon: Headphones, title: 'One team for every enquiry', desc: 'Buyers and tenants contact Jalaram, not the owner directly. A named team member follows up, so nothing falls through the cracks.' },
  { icon: ShieldCheck, title: 'Listings reviewed before publishing', desc: 'Owners submit listings through our portal and our team reviews them before they appear on the website.' },
  { icon: Handshake, title: 'Clear brokerage terms', desc: 'Brokerage is earned only when a transaction completes, and the amount and paying party are agreed in writing before closing.' },
  { icon: Building2, title: 'Focused on Ahmedabad', desc: 'We work across Ahmedabad’s residential neighbourhoods — from Bodakdev and Prahlad Nagar to Bopal, Shela and Gota.' },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      <ContentHero
        eyebrow={BUSINESS.tagline}
        title={`About ${BUSINESS.name}`}
        intro="We are a residential property brokerage in Ahmedabad. We help people buy, rent and sell homes by managing the whole process — from the first enquiry to the final agreement."
      />
      <section className="py-16 lg:py-20">
        <div className="container-mw container-px">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl font-bold">How we work</h2>
              <div className="mt-4 space-y-4 text-muted-foreground">
                <p>
                  Property owners list their homes through our owner portal. Our team reviews each listing before it is published, then
                  handles every enquiry that comes in — whether it arrives through the website, a phone call or WhatsApp.
                </p>
                <p>
                  When you enquire about a property, a member of our team calls you to understand what you need, checks availability with
                  the owner, and arranges a site visit at a time that suits both of you. We then support negotiation and paperwork until the
                  deal is agreed.
                </p>
                <p>
                  Because enquiries come to us centrally, owners are not flooded with calls, and buyers and tenants have a single, accountable
                  point of contact.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/buy" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  Browse properties <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted">
                  Contact us
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {principles.map((p) => (
                <div key={p.title} className="rounded-xl border border-border bg-card p-5">
                  <p.icon className="h-7 w-7 text-accent" />
                  <h3 className="mt-3 font-serif text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
