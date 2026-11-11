import type { AiJobDTO, PhotoDTO } from '@picpac/shared';
import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../api/client';

type Status = 'idle' | 'pending' | 'done' | 'failed';

export function useAiJob(client: ApiClient, jobId: string | null) {
  const [status, setStatus] = useState<Status>(jobId ? 'pending' : 'idle');
  const [result, setResult] = useState<PhotoDTO | undefined>();
  const [reason, setReason] = useState<string | undefined>();
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!jobId) {
      setStatus('idle');
      return;
    }
    setStatus('pending');
    const timer = setInterval(() => {
      void (async () => {
        if (cancelled.current) return;
        try {
          const job = await client.get<AiJobDTO>(`/ai/jobs/${jobId}`);
          if (cancelled.current) return;
          if (job.status === 'done') {
            setStatus('done');
            setResult(job.resultPhoto);
            clearInterval(timer);
          } else if (job.status === 'failed') {
            setStatus('failed');
            setReason(job.reason);
            clearInterval(timer);
          }
        } catch {
          // keep polling
        }
      })();
    }, 1000);
    return () => {
      cancelled.current = true;
      clearInterval(timer);
    };
  }, [client, jobId]);

  return {
    status,
    result,
    reason,
    cancel() {
      cancelled.current = true;
      setStatus('idle');
    },
  };
}

export async function startAiEdit(
  client: ApiClient,
  body: { photoId: string; prompt: string },
  inFlight: { current: Promise<AiJobDTO> | null },
): Promise<AiJobDTO> {
  if (inFlight.current) return inFlight.current;
  inFlight.current = client.post<AiJobDTO>('/ai/edit', body).finally(() => {
    inFlight.current = null;
  });
  return inFlight.current;
}
