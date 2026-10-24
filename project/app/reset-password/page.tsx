import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/site/public-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { LoadingState } from '@/components/shared/states';
import { ResetPasswordForm } from '@/components/auth/password-forms';

// Never cache auth pages at the CDN: they depend on query params (redirect, reset token).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <PublicLayout>
      <AuthCard title="Choose a new password" footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}>
        <Suspense fallback={<LoadingState />}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </PublicLayout>
  );
}
