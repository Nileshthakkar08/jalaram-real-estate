import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { PublicLayout } from '@/components/site/public-layout';
import { ContentHero } from '@/components/site/content-page';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { serverApi } from '@/lib/server-api';
import { callLink, whatsappLink } from '@/lib/business';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact Jalaram Real Estate in Ahmedabad about buying, renting or selling a property.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const settings = await serverApi.settings();
  const phoneHref = callLink(settings);
  const whatsappHref = whatsappLink(settings, 'Hello, I would like to enquire about a property.');
  const details = [
    phoneHref && { icon: Phone, label: 'Phone', value: settings.business_phone, href: phoneHref },
    whatsappHref && { icon: MessageCircle, label: 'WhatsApp', value: 'Chat with us', href: whatsappHref },
    settings.business_email && { icon: Mail, label: 'Email', value: settings.business_email, href: `mailto:${settings.business_email}` },
    settings.business_address && { icon: MapPin, label: 'Office', value: settings.business_address },
    settings.business_hours && { icon: Clock, label: 'Hours', value: settings.business_hours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  return (
    <PublicLayout>
      <ContentHero
        eyebrow="Contact"
        title="Talk to our team"
        intro="Tell us what you are looking for — buying, renting or selling — and a member of our team will get back to you."
      />
      <section className="py-14 lg:py-20">
        <div className="container-mw container-px grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <h2 className="font-serif text-2xl font-bold">Get in touch</h2>
            {details.length > 0 ? (
              <ul className="space-y-3">
                {details.map((d) => (
                  <li key={d.label} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <d.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</p>
                      {d.href ? (
                        <a href={d.href} className="font-medium text-primary hover:underline" {...(d.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{d.value}</a>
                      ) : (
                        <p className="font-medium">{d.value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Use the form to send us a message and we will contact you.</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm lg:p-8">
            <h2 className="font-serif text-xl font-bold">Send us a message</h2>
            <div className="mt-6">
              <EnquiryForm showInterest leadType="general" submitLabel="Send Message" />
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
