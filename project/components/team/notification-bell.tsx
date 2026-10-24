'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

interface Notice { id: string; data: { kind: string; lead_id: number; reference: string; name: string; property_title?: string | null }; read_at: string | null; created_at: string }

const LABEL: Record<string, string> = { enquiry: 'New enquiry', site_visit_request: 'Visit request', assigned: 'Assigned to you' };

export function NotificationBell() {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);

  const load = () => api.get<{ data: Notice[]; unread: number }>('/team/notifications')
    .then((r) => { setItems(r.data); setUnread(r.unread); })
    .catch(() => undefined);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Popover onOpenChange={(open) => { if (!open && unread > 0) api.post('/team/notifications/read').then(() => setUnread(0)).catch(() => undefined); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-2 text-sm font-semibold">Notifications</p>
        {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nothing new.</p> : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={`/team/leads/${n.data.lead_id}`} className={`block px-4 py-2.5 text-sm hover:bg-muted ${n.read_at ? '' : 'bg-accent/5'}`}>
                  <p className="font-medium">{LABEL[n.data.kind] ?? 'Update'} · {n.data.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.data.reference}{n.data.property_title ? ` · ${n.data.property_title}` : ''} · {timeAgo(n.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
