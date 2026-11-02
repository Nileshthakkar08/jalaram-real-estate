'use client';

import { useRef, useState } from 'react';
import { Loader2, Trash2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { PropertyVideo } from '@/lib/types';

const MAX_BYTES = 100 * 1024 * 1024;
// Must match PropertyVideoService::CHUNK_BYTES. Netlify's proxy rejects bodies over ~6 MB, so
// the file is sent in 4 MB pieces, one after another.
const CHUNK_BYTES = 4 * 1024 * 1024;
const TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const RETRIES = 2;

type Meta = { resubmitted_for_review?: boolean };

interface VideoManagerProps {
  /** e.g. `/owner/properties/12` or `/admin/properties/12` */
  basePath: string;
  video: PropertyVideo | null | undefined;
  onChange: (video: PropertyVideo | null, meta?: Meta) => void;
  disabled?: boolean;
}

function uploadId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Older browsers: a random version-4 UUID from getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoManager({ basePath, video, onChange, disabled }: VideoManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setError(null);
    // Some phones report an empty type for .mov files; the server checks the contents anyway.
    if (file.type && !TYPES.includes(file.type)) return setError('Use an MP4, MOV or WebM video.');
    if (file.size > MAX_BYTES) return setError(`This video is ${formatSize(file.size)}. The limit is 100 MB: trim it or record a shorter clip.`);

    const id = uploadId();
    const total = Math.ceil(file.size / CHUNK_BYTES);
    setBusy('upload');
    setPercent(0);
    try {
      for (let index = 0; index < total; index++) {
        const fd = new FormData();
        fd.append('upload_id', id);
        fd.append('index', String(index));
        fd.append('total', String(total));
        fd.append('size', String(file.size));
        fd.append('chunk', file.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES), 'chunk');

        for (let attempt = 0; ; attempt++) {
          try {
            const res = await api.post<{ data: { video?: PropertyVideo }; meta?: Meta }>(`${basePath}/video/chunks`, fd);
            if (res.data.video) onChange(res.data.video, res.meta);
            break;
          } catch (err) {
            // Validation errors will not fix themselves; connection drops usually do.
            const retryable = !(err instanceof ApiError) || err.status >= 500 || err.status === 429;
            if (!retryable || attempt >= RETRIES) throw err;
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          }
        }
        setPercent(Math.round(((index + 1) / total) * 100));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this video?')) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await api.delete<{ data: { video: null }; meta?: Meta }>(`${basePath}/video`);
      onChange(null, res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          One walkthrough video · MP4, MOV or WebM up to 100 MB (about 1–2 minutes of phone video).
          {video ? ' Uploading a new video replaces this one.' : ''}
        </p>
        <input ref={input} type="file" accept={TYPES.join(',')} className="hidden" onChange={(e) => upload(e.target.files?.[0])} aria-label="Choose a video" />
        <Button type="button" onClick={() => input.current?.click()} disabled={disabled || !!busy} className="gap-2">
          {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          {busy === 'upload' ? `Uploading… ${percent}%` : video ? 'Replace video' : 'Add video'}
        </Button>
      </div>

      {busy === 'upload' && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Video upload progress">
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Keep this page open until the upload finishes.</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      {video ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <video src={video.url} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
          <div className="flex items-center justify-between gap-2 p-2">
            <span className="text-xs text-muted-foreground">{formatSize(video.size_bytes)}</span>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={disabled || !!busy} onClick={remove}>
              {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete video
            </Button>
          </div>
        </div>
      ) : (
        busy !== 'upload' && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={disabled}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground hover:border-accent"
          >
            <Video className="h-8 w-8" />
            <span className="mt-2 text-sm">Optional: add a short walkthrough video</span>
          </button>
        )
      )}
    </div>
  );
}
