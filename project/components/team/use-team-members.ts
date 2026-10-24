'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface TeamMember { id: number; name: string; role: string }

let cache: Promise<TeamMember[]> | null = null;

/** Active staff for assignment dropdowns (cached per page load). */
export function useTeamMembers(): TeamMember[] {
  const [members, setMembers] = useState<TeamMember[]>([]);
  useEffect(() => {
    cache ??= api.get<{ data: TeamMember[] }>('/team/members').then((r) => r.data).catch(() => { cache = null; return []; });
    cache.then(setMembers);
  }, []);
  return members;
}
