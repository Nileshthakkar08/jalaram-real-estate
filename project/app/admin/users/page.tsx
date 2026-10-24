'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState, LoadingState } from '@/components/shared/states';
import { Pager } from '@/components/shared/pager';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field, selectClass } from '@/components/shared/form-field';
import { FilterBar } from '@/components/team/filter-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';
import { api, qs } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatDate, humanize } from '@/lib/format';
import type { Paginated, User } from '@/lib/types';

type UsersResponse = Paginated<User> & { meta: Paginated<User>['meta'] & { permissions: Record<string, string> } };

function PermissionChecks({ permissions, granted }: { permissions: Record<string, string>; granted: string[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Team member permissions</legend>
      {Object.entries(permissions).map(([key, label]) => (
        <label key={key} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="permissions" value={key} defaultChecked={granted.includes(key)} className="mt-1" />
          <span><span className="font-medium">{key}</span> — {label}</span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">Admins always have every permission. Owners have none.</p>
    </fieldset>
  );
}

function Users() {
  const params = useSearchParams();
  const router = useRouter();
  const { user: me } = useAuth();
  const f = Object.fromEntries(['role', 'q', 'page'].map((k) => [k, params.get(k) ?? '']));
  const { data, loading, error, reload } = useApi<UsersResponse>(`/admin/users${qs(f)}`);
  const permissions = data?.meta.permissions ?? {};
  const set = (c: Record<string, string>) => router.push(`/admin/users${qs({ ...f, page: '', ...c })}`);

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Owners register themselves. Create staff accounts here and grant team-member permissions."
        actions={
          <ActionDialog trigger={<Button className="gap-2"><Plus className="h-4 w-4" /> New staff account</Button>} title="Create staff account" confirmLabel="Create"
            onConfirm={async (fd) => {
              await api.post('/admin/users', {
                name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone') || null, role: fd.get('role'),
                password: fd.get('password'), permissions: fd.getAll('permissions'),
              });
              toast({ title: 'Account created', description: 'Share the temporary password securely and ask them to change it.' });
              reload();
            }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="u-name"><Input id="u-name" name="name" required /></Field>
              <Field label="Email" htmlFor="u-email"><Input id="u-email" name="email" type="email" required /></Field>
              <Field label="Phone" htmlFor="u-phone"><Input id="u-phone" name="phone" /></Field>
              <Field label="Role" htmlFor="u-role">
                <select id="u-role" name="role" className={selectClass} defaultValue="team_member">
                  <option value="team_member">Team member</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Temporary password" htmlFor="u-pass" hint="At least 10 characters with letters and numbers." className="sm:col-span-2">
                <Input id="u-pass" name="password" type="text" required minLength={10} autoComplete="off" />
              </Field>
            </div>
            <PermissionChecks permissions={permissions} granted={[]} />
          </ActionDialog>
        }
      />
      <FilterBar>
        <form className="relative lg:col-span-3" onSubmit={(e) => { e.preventDefault(); set({ q: String(new FormData(e.currentTarget).get('q') ?? '') }); }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={f.q} placeholder="Name, email or phone" className="pl-9" aria-label="Search users" />
        </form>
        <select className={selectClass} value={f.role} onChange={(e) => set({ role: e.target.value })} aria-label="Role">
          <option value="">All roles</option><option value="admin">Admin</option><option value="team_member">Team member</option><option value="owner">Owner</option>
        </select>
      </FilterBar>
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title="No users" /> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Permissions</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last sign-in</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.data.map((u) => (
                    <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                      <td className="px-4 py-3"><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}{u.phone && ` · ${u.phone}`}</p></td>
                      <td className="px-4 py-3">{humanize(u.role)}{u.role === 'owner' && <p className="text-xs text-muted-foreground">{u.properties_count ?? 0} listings</p>}</td>
                      <td className="max-w-[220px] px-4 py-3 text-xs">{u.role === 'team_member' ? (u.granted_permissions.join(', ') || 'None') : u.role === 'admin' ? 'All' : '—'}</td>
                      <td className="px-4 py-3">{u.is_active ? 'Active' : 'Deactivated'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(u.last_login_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <ActionDialog trigger={<Button size="sm" variant="outline">Edit</Button>} title={`Edit ${u.name}`} confirmLabel="Save"
                          description={u.id === me?.id ? 'You cannot remove your own admin access or deactivate yourself.' : 'Changes are recorded in the audit log.'}
                          onConfirm={async (fd) => {
                            await api.put(`/admin/users/${u.id}`, {
                              name: fd.get('name'), phone: fd.get('phone') || null, role: fd.get('role'),
                              is_active: fd.get('is_active') === 'on', permissions: fd.getAll('permissions'), reason: fd.get('reason') || null,
                            });
                            toast({ title: 'User updated' });
                            reload();
                          }}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Name" htmlFor={`e-name-${u.id}`}><Input id={`e-name-${u.id}`} name="name" defaultValue={u.name} /></Field>
                            <Field label="Phone" htmlFor={`e-phone-${u.id}`}><Input id={`e-phone-${u.id}`} name="phone" defaultValue={u.phone ?? ''} /></Field>
                            <Field label="Role" htmlFor={`e-role-${u.id}`}>
                              <select id={`e-role-${u.id}`} name="role" className={selectClass} defaultValue={u.role}>
                                <option value="owner">Owner</option><option value="team_member">Team member</option><option value="admin">Admin</option>
                              </select>
                            </Field>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={u.is_active} /> Account active</label>
                          </div>
                          <PermissionChecks permissions={d.meta.permissions} granted={u.granted_permissions} />
                          <Input name="reason" placeholder="Reason for change (audit log)" aria-label="Reason" />
                        </ActionDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager className="border-t border-border py-3" page={d.meta.current_page} lastPage={d.meta.last_page} onChange={(p) => set({ page: String(p) })} />
          </div>
        )}
      </DataState>
    </>
  );
}

export default function AdminUsersPage() {
  return <Suspense fallback={<LoadingState />}><Users /></Suspense>;
}
