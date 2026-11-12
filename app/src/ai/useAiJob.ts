import type { AiJobDTO, PhotoDTO, AspectRatio } from '@picpac/shared';
import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../api/client';

type Status = 'idle' | 'pending' | 'done' | 'failed';

export function useAiJob(client: ApiClient, jobId: string | null) {
  const [snapshot, setSnapshot] = useState<{
    jobId: string | null;
    status: Status;
    result?: PhotoDTO;
    reason?: string;
  }>();
  const stopPolling = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const job = await client.get<AiJobDTO>(`/ai/jobs/${jobId}`);
        if (cancelled) return;
        if (job.status === 'done') {
          setSnapshot({ jobId, status: 'done', result: job.resultPhoto });
          stop();
        } else if (job.status === 'failed') {
          setSnapshot({ jobId, status: 'failed', reason: job.reason });
          stop();
        }
      } catch {
        // keep polling
      }
    }, 1000);
    function stop() {
      cancelled = true;
      clearInterval(timer);
    }
    stopPolling.current = stop;
    return stop;
  }, [client, jobId]);

  const current = snapshot?.jobId === jobId ? snapshot : undefined;
  return {
    status: current?.status ?? (jobId ? 'pending' : 'idle'),
    result: current?.result,
    reason: current?.reason,
    cancel() {
      stopPolling.current?.();
      setSnapshot({ jobId, status: 'idle' });
    },
  };
}

export async function startAiEdit(
  client: ApiClient,
  body: { projectId: string; photoId: string; prompt: string; kind?: 'edit' | 'upscale'; aspect?: AspectRatio },
  inFlight: { current: Promise<{ jobId: string }> | null },
): Promise<{ jobId: string }> {
  if (inFlight.current) return inFlight.current;
  inFlight.current = client
    .post<{ jobId: string }>('/ai/edit', body)
    .finally(() => {
      inFlight.current = null;
    });
  return inFlight.current;
}
