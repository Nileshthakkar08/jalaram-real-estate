import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/site/public-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { LoadingState } from '@/components/shared/states';
import { ForgotPasswordForm } from '@/components/auth/password-forms';

export const metadata: Metadata = { title: 'Forgot your password?', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <PublicLayout>
      <AuthCard title="Forgot your password?" subtitle="Enter your email and we will send you a reset link." footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
        <Suspense fallback={<LoadingState />}>
          <ForgotPasswordForm />
        </Suspense>
      </AuthCard>
    </PublicLayout>
  );
}
