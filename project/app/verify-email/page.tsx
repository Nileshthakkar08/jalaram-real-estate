import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicLayout } from '@/components/site/public-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { LoadingState } from '@/components/shared/states';
import { VerifyEmail } from '@/components/auth/verify-email';

// Never cache auth pages at the CDN: they depend on query params (redirect, reset token).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Verify your email', robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <PublicLayout>
      <AuthCard title="Verify your email" footer={null}>
        <Suspense fallback={<LoadingState />}>
          <VerifyEmail />
        </Suspense>
      </AuthCard>
    </PublicLayout>
  );
}
