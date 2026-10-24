'use client';

import { useState } from 'react';
import { Phone, MessageCircle, X } from 'lucide-react';
import { callLink, whatsappLink } from '@/lib/business';
import { usePublicSettings } from '@/lib/settings-context';

export function FloatingActions() {
  const [open, setOpen] = useState(false);
  const settings = usePublicSettings();
  const phoneHref = callLink(settings);
  const whatsappHref = whatsappLink(settings, 'Hello, I would like to enquire about a property.');

  // Hidden until the business phone / WhatsApp number is configured in admin settings.
  if (!phoneHref && !whatsappHref) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {open && (
        <div className="flex flex-col items-end gap-2 animate-fade-in-up">
          {phoneHref && (
            <a
              href={phoneHref}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
            >
              <Phone className="h-4 w-4 text-accent" />
              Call Jalaram
            </a>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Enquiry
            </a>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl transition-transform hover:scale-105"
        aria-label="Quick contact"
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
      </button>
    </div>
  );
}
