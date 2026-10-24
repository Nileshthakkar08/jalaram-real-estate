'use client';

import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataState, EmptyState } from '@/components/shared/states';
import { ActionDialog } from '@/components/shared/action-dialog';
import { Field } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/hooks/use-api';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { Amenity, Locality } from '@/lib/types';

type Item = (Locality | Amenity) & { description?: string | null; image_url?: string | null; city?: string };

/** CRUD table for localities or amenities. Items in use are deactivated, not deleted. */
export function CatalogAdmin({ kind }: { kind: 'localities' | 'amenities' }) {
  const isLocality = kind === 'localities';
  const { data, loading, error, reload } = useApi<{ data: Item[] }>(`/admin/${kind}`);
  const label = isLocality ? 'locality' : 'amenity';

  const fields = (item?: Item) => (
    <>
      <Field label="Name" htmlFor={`c-name-${item?.id ?? 'new'}`}><Input id={`c-name-${item?.id ?? 'new'}`} name="name" required defaultValue={item?.name} /></Field>
      {isLocality && (
        <>
          <Field label="URL slug" htmlFor={`c-slug-${item?.id ?? 'new'}`} hint="Leave blank to generate from the name."><Input id={`c-slug-${item?.id ?? 'new'}`} name="slug" defaultValue={item?.slug} /></Field>
          <Textarea name="description" placeholder="Short description for the area page" defaultValue={item?.description ?? ''} />
          <Field label="Image URL (https)" htmlFor={`c-img-${item?.id ?? 'new'}`} hint="Use an image you have the rights to. Leave blank for the default design."><Input id={`c-img-${item?.id ?? 'new'}`} name="image_url" type="url" defaultValue={item?.image_url ?? ''} /></Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sort order" htmlFor={`c-sort-${item?.id ?? 'new'}`}><Input id={`c-sort-${item?.id ?? 'new'}`} name="sort_order" type="number" min={0} defaultValue={item?.sort_order ?? 0} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active ?? true} /> Active</label>
      </div>
    </>
  );

  const payload = (fd: FormData) => ({
    name: fd.get('name'), is_active: fd.get('is_active') === 'on', sort_order: Number(fd.get('sort_order') || 0),
    ...(isLocality ? { slug: fd.get('slug') || null, description: fd.get('description') || null, image_url: fd.get('image_url') || null } : {}),
  });

  return (
    <>
      <PageHeader
        title={isLocality ? 'Localities' : 'Amenities'}
        description={isLocality ? 'Ahmedabad areas used for listings, search filters and area landing pages.' : 'Amenities owners can select on their listings.'}
        actions={
          <ActionDialog trigger={<Button className="gap-2"><Plus className="h-4 w-4" /> Add {label}</Button>} title={`Add ${label}`} confirmLabel="Add"
            onConfirm={async (fd) => { await api.post(`/admin/${kind}`, payload(fd)); toast({ title: 'Added' }); reload(); }}>
            {fields()}
          </ActionDialog>
        }
      />
      <DataState loading={loading} error={error} data={data} onRetry={reload}>
        {(d) => d.data.length === 0 ? <EmptyState title={`No ${kind}`} /> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Listings</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Order</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.data.map((item) => (
                  <tr key={item.id} className={item.is_active ? '' : 'opacity-60'}>
                    <td className="px-4 py-3"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.slug}</p></td>
                    <td className="px-4 py-3">{item.properties_count ?? 0}</td>
                    <td className="px-4 py-3">{item.is_active ? 'Active' : 'Inactive'}</td>
                    <td className="px-4 py-3">{item.sort_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <ActionDialog trigger={<Button size="sm" variant="outline">Edit</Button>} title={`Edit ${item.name}`} confirmLabel="Save"
                          onConfirm={async (fd) => { await api.put(`/admin/${kind}/${item.id}`, payload(fd)); toast({ title: 'Saved' }); reload(); }}>
                          {fields(item)}
                        </ActionDialog>
                        <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${item.name}`} disabled={(item.properties_count ?? 0) > 0}
                          title={(item.properties_count ?? 0) > 0 ? 'In use — deactivate instead' : undefined}
                          onClick={async () => {
                            if (!window.confirm(`Delete ${item.name}?`)) return;
                            try { await api.delete(`/admin/${kind}/${item.id}`); toast({ title: 'Deleted' }); reload(); }
                            catch (err) { toast({ title: 'Cannot delete', description: errorMessage(err), variant: 'destructive' }); }
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>
    </>
  );
}
