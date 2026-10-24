import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/site/public-layout';
import { ContentHero, Prose } from '@/components/site/content-page';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Terms for using the Jalaram Real Estate website and owner portal.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <PublicLayout>
      <ContentHero eyebrow="Legal" title="Terms and Conditions" intro="Last updated: 23 October 2026" />
      <section className="py-12 lg:py-16">
        <div className="container-mw container-px max-w-3xl">
          <Prose>
            <p>By using this website or the owner portal you agree to these terms. If you do not agree, please do not use the service.</p>

            <h2>Our role</h2>
            <p>
              Jalaram Real Estate acts as a property broker. We publish listings provided by owners, handle enquiries from buyers and tenants,
              coordinate site visits and support negotiation. We are not the owner of listed properties and are not a party to the sale or
              lease agreement between owner and buyer/tenant.
            </p>

            <h2>Listings</h2>
            <ul>
              <li>Owners are responsible for the accuracy of the information and photos they submit, and confirm they have the right to sell or rent the property.</li>
              <li>We review listings before publishing and may edit, reject, suspend or remove any listing. A listing review is not a legal title verification or a guarantee of condition.</li>
              <li>Buyers and tenants should independently verify ownership, approvals and documents before paying any amount or signing an agreement.</li>
              <li>Prices, availability and details can change. A listing on this website is not an offer capable of acceptance.</li>
            </ul>

            <h2>Enquiries</h2>
            <p>
              Enquiries about listed properties are handled by our team. By submitting an enquiry you agree that we may contact you about it
              and share necessary details with the property owner to arrange visits or agreements. See our <Link href="/privacy-policy">privacy policy</Link>.
            </p>

            <h2>Brokerage</h2>
            <ul>
              <li>Brokerage is payable only when a transaction is completed through our services.</li>
              <li>The brokerage amount, method of calculation, the paying party or parties, and the due date are agreed in writing with the relevant party before the deal is closed.</li>
              <li>Any applicable taxes are charged as required by law and shown on the invoice.</li>
              <li>Brokerage is separate from rent, security deposits and sale consideration, which are paid between the parties as per their agreement.</li>
            </ul>

            <h2>Accounts</h2>
            <p>
              Keep your login details confidential. We may suspend accounts that provide false information or misuse the service. Owners
              must not contact enquirers obtained through our service to bypass agreed brokerage.
            </p>

            <h2>Liability</h2>
            <p>
              To the extent permitted by law, we are not liable for losses arising from reliance on listing information, from agreements
              between owners and buyers/tenants, or from interruptions to the website.
            </p>

            <h2>Governing law</h2>
            <p>These terms are governed by the laws of India. Courts at Ahmedabad, Gujarat have jurisdiction.</p>
          </Prose>
        </div>
      </section>
    </PublicLayout>
  );
}
