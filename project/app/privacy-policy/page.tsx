import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/site/public-layout';
import { ContentHero, Prose } from '@/components/site/content-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Jalaram Real Estate collects, uses and protects personal information.',
  alternates: { canonical: '/privacy-policy' },
};

export default function PrivacyPolicyPage() {
  return (
    <PublicLayout>
      <ContentHero eyebrow="Legal" title="Privacy Policy" intro="Last updated: 27 October 2026" />
      <section className="py-12 lg:py-16">
        <div className="container-mw container-px max-w-3xl">
          <Prose>
            <p>
              This policy explains how Jalaram Real Estate (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects and uses personal information when you use
              this website, submit an enquiry or list a property. We process personal data in line with applicable Indian law, including the
              Digital Personal Data Protection Act, 2023.
            </p>

            <h2>Information we collect</h2>
            <ul>
              <li><strong>Enquiries and visit requests:</strong> your name, phone number, optional email, message, budget and preferences, the property you asked about, the page you submitted from and any campaign tags in the link you followed.</li>
              <li><strong>Owner accounts:</strong> name, email, phone, password (stored only as a secure hash), and the property details, address and photos you submit.</li>
              <li><strong>Transactions:</strong> if a deal proceeds, agreed terms, brokerage agreements, payment references and related documents.</li>
              <li><strong>Technical data:</strong> IP address (used to prevent spam and abuse) and essential cookies that keep you signed in and protect forms against forgery. We do not use advertising cookies.</li>
            </ul>

            <h2>Browser notifications</h2>
            <p>
              If you choose <strong>Allow</strong> when we offer alerts for new properties, your browser gives us an anonymous
              push subscription (a technical address issued by your browser&apos;s push service, such as Google, Mozilla, Apple or
              Microsoft). We store only that address and the keys needed to send to it — not your name, email, phone number or IP
              address. We use it solely to tell you when a new property is listed. You can stop notifications at any time in your
              browser&apos;s site settings; subscriptions that stop working are deleted automatically.
            </p>

            <h2>How we use it</h2>
            <ul>
              <li>To contact you about your enquiry, arrange site visits and support negotiation.</li>
              <li>To coordinate with the property owner on your behalf. We share only what is needed to arrange a visit or agreement.</li>
              <li>To review and publish owner listings. Exact addresses and owner contact details are never shown publicly.</li>
              <li>To keep records of agreements and brokerage payments, as required for accounting and legal purposes.</li>
              <li>To send listing updates, only if you opted in. You can opt out at any time.</li>
            </ul>

            <h2>Who can see your information</h2>
            <p>
              Your details are visible only to authorised Jalaram staff who need them to handle your enquiry or transaction. We do not sell
              personal information. We may share information with service providers who host our systems, or when required by law.
            </p>

            <h2>Retention</h2>
            <p>
              We keep enquiry records while they are useful for following up on your requirement, and transaction records for as long as
              required by law. You can ask us to delete information we no longer need.
            </p>

            <h2>Your rights</h2>
            <p>
              You can ask to access, correct or delete your personal information, or withdraw consent for marketing messages. Contact us
              through the <Link href="/contact">contact page</Link> and we will respond within a reasonable time.
            </p>

            <h2>Security</h2>
            <p>
              We use encrypted connections, hashed passwords, role-based access for staff and audit logs for sensitive changes. No system is
              completely secure, so please do not share sensitive documents through enquiry forms.
            </p>

            <h2>Changes</h2>
            <p>We may update this policy. The date at the top shows when it was last changed.</p>
          </Prose>
        </div>
      </section>
    </PublicLayout>
  );
}
