import Link from 'next/link';
import { Home, Phone, Mail, MapPin, Clock, Instagram, Facebook, MessageCircle, BadgeCheck } from 'lucide-react';
import { BUSINESS, callLink, whatsappLink } from '@/lib/business';
import type { PublicSettings } from '@/lib/types';

const footerLinks = {
  'Browse Properties': [
    { href: '/buy', label: 'Buy Property' },
    { href: '/rent', label: 'Rent Property' },
    { href: '/sell-property', label: 'Sell Property' },
    { href: '/list-property', label: 'List Your Property' },
  ],
  'Company': [
    { href: '/about', label: 'About Us' },
    { href: '/contact', label: 'Contact' },
    { href: '/login', label: 'Owner & Team Sign In' },
    { href: '/privacy-policy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
};

export function Footer({ settings }: { settings: PublicSettings }) {
  const phoneHref = callLink(settings);
  const whatsappHref = whatsappLink(settings, 'Hello, I would like to enquire about a property.');
  const socials = [
    { href: settings.social_instagram, label: 'Instagram', Icon: Instagram },
    { href: settings.social_facebook, label: 'Facebook', Icon: Facebook },
    { href: whatsappHref ?? undefined, label: 'WhatsApp', Icon: MessageCircle },
  ].filter((s) => !!s.href);
  const hasContact = !!(settings.business_address || phoneHref || settings.business_email || settings.business_hours);

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container-mw container-px py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Home className="h-5 w-5 text-primary" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-serif text-xl font-bold">Jalaram</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-accent">
                  Real Estate
                </span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-primary-foreground/70">
              {BUSINESS.tagline} Your trusted property brokerage in {BUSINESS.area}.
            </p>
            {socials.length > 0 && (
              <div className="flex gap-3">
                {socials.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10 transition-colors hover:bg-accent hover:text-primary"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">{heading}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Get in Touch</h3>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              {settings.business_address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-accent" />
                  <span>{settings.business_address}</span>
                </li>
              )}
              {phoneHref && (
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-accent" />
                  <a href={phoneHref} className="hover:text-primary-foreground">{settings.business_phone}</a>
                </li>
              )}
              {settings.business_email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-accent" />
                  <a href={`mailto:${settings.business_email}`} className="hover:text-primary-foreground">{settings.business_email}</a>
                </li>
              )}
              {settings.business_hours && (
                <li className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-accent" />
                  <span>{settings.business_hours}</span>
                </li>
              )}
              {settings.rera_registration && (
                <li className="flex items-center gap-2.5">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-accent" />
                  <span>RERA: {settings.rera_registration}</span>
                </li>
              )}
              {!hasContact && (
                <li>
                  <Link href="/contact" className="hover:text-primary-foreground">Send us a message</Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/10 pt-6">
          <p className="text-xs text-primary-foreground/50">
            &copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved. Listings are reviewed by our team
            before publishing; this review is not a legal title verification. Please verify all documents before any transaction.
          </p>
        </div>
      </div>
    </footer>
  );
}
