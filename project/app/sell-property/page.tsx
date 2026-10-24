import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Camera, ClipboardCheck, Handshake, PhoneCall, ShieldCheck, Users } from 'lucide-react';
import { PublicLayout } from '@/components/site/public-layout';
import { ContentHero } from '@/components/site/content-page';
import { EnquiryForm } from '@/components/site/enquiry-form';

export const metadata: Metadata = {
  title: 'Sell or Rent Out Your Property in Ahmedabad',
  description: 'List your Ahmedabad property with Jalaram Real Estate. Our team reviews your listing, handles every enquiry, arranges visits and supports negotiation.',
  alternates: { canonical: '/sell-property' },
};

const steps = [
  { icon: ClipboardCheck, title: 'Create your listing', desc: 'Register as an owner, add your property details and up to 10 photos. Save it as a draft until you are ready.' },
  { icon: ShieldCheck, title: 'We review it', desc: 'Our team checks the listing before publishing. If something needs fixing we tell you why, so you can update and resubmit.' },
  { icon: Users, title: 'We handle enquiries', desc: 'Buyers and tenants contact Jalaram — not you directly. We screen them, understand their requirement and keep you informed.' },
  { icon: PhoneCall, title: 'We coordinate visits', desc: 'We confirm a convenient time with you and accompany or arrange site visits.' },
  { icon: Handshake, title: 'Negotiation to agreement', desc: 'We support negotiation and paperwork until the deal is agreed.' },
];

export default function SellPropertyPage() {
  return (
    <PublicLayout>
      <ContentHero
        eyebrow="For Property Owners"
        title="Sell or rent out your property with a team that handles the calls"
        intro="List your property with Jalaram Real Estate. We manage enquiries, site visits and negotiation, so you only deal with serious, screened buyers and tenants."
      />

      <section className="py-16 lg:py-20">
        <div className="container-mw container-px">
          <h2 className="font-serif text-3xl font-bold">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                  <step.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-serif text-2xl font-bold">Brokerage</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Jalaram earns brokerage only when a sale or rental is successfully completed. The brokerage amount, how it is calculated
                and which party pays it are discussed and agreed with you in writing before the deal is closed. There is no charge for
                creating or publishing a listing.
              </p>
              <h3 className="mt-6 font-serif text-lg font-semibold">Before you list, keep ready</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><Camera className="h-4 w-4 shrink-0 text-accent" /> Clear photos of each room (JPEG, PNG or WebP, up to 5 MB each)</li>
                <li className="flex gap-2"><ClipboardCheck className="h-4 w-4 shrink-0 text-accent" /> Carpet/built-up area, floor, furnishing and amenities</li>
                <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-accent" /> Ownership documents — we may ask to see them before visits</li>
              </ul>
              <Link href="/list-property" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                List your property <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-serif text-2xl font-bold">Prefer we call you?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Share your details and our team will help you list your property.</p>
              <div className="mt-6">
                <EnquiryForm leadType="sell" submitLabel="Request a Call Back" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
