import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/site/public-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { LoadingState } from '@/components/shared/states';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create an owner account', robots: { index: false } };

export default function RegisterPage() {
  return (
    <PublicLayout>
      <AuthCard title="Create an owner account" subtitle="List and manage your property. Enquiries are handled by the Jalaram team." footer={<>Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}>
        <Suspense fallback={<LoadingState />}>
          <RegisterForm />
        </Suspense>
      </AuthCard>
    </PublicLayout>
  );
}
