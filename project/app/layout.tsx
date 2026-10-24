import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth-context';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  title: {
    default: 'Jalaram Real Estate — Find Your Property. Move with Confidence.',
    template: '%s | Jalaram Real Estate',
  },
  description:
    'Premium property brokerage in Ahmedabad, Gujarat. Buy, rent, and sell residential properties with confidence. Browse listings reviewed by our team across Ahmedabad’s finest neighbourhoods.',
  keywords: [
    'Ahmedabad real estate',
    'property in Ahmedabad',
    'buy property Ahmedabad',
    'rent property Ahmedabad',
    'Jalaram Real Estate',
    'property broker Ahmedabad',
  ],
  openGraph: {
    title: 'Jalaram Real Estate — Find Your Property. Move with Confidence.',
    description:
      'Premium property brokerage in Ahmedabad, Gujarat. Buy, rent, and sell residential properties with confidence.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'Jalaram Real Estate',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jalaram Real Estate',
    description:
      'Premium property brokerage in Ahmedabad, Gujarat.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
