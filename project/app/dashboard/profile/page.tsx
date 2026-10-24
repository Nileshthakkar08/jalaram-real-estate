'use client';

import { PageHeader } from '@/components/shared/page-header';
import { ProfileSettings } from '@/components/account/profile-forms';

export default function OwnerProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Your contact details are used by the Jalaram team to coordinate with you." />
      <ProfileSettings />
    </>
  );
}
