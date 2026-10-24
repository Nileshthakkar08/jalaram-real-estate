import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '@/components/site/public-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { LoadingState } from '@/components/shared/states';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginPage() {
  return (
    <PublicLayout>
      <AuthCard title="Sign in" subtitle="Owners, Jalaram team members and administrators sign in here." footer={<>New property owner? <Link href="/register" className="font-medium text-primary hover:underline">Create an account</Link></>}>
        <Suspense fallback={<LoadingState />}>
          <LoginForm />
        </Suspense>
      </AuthCard>
    </PublicLayout>
  );
}
