'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ProfileSettings } from '@/components/account/profile-forms';

export default function TeamProfilePage() {
  return (
    <>
      <PageHeader title="Profile" />
      <ProfileSettings />
    </>
  );
}
