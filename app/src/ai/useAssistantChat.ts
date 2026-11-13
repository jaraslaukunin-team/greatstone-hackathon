import type { AiChatMessage, AiChatResponse } from '@picpac/shared';
import { useCallback, useState } from 'react';
import type { ApiClient } from '../api/client';
import { ApiRequestError } from '../api/client';

export function useAssistantChat(client: ApiClient) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      content: 'Здравствуйте! Я ассистент picPac: заказы, каталог и советы по оформлению.',
    },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [orderId, setOrderId] = useState<string | undefined>();

  const grantConsent = useCallback(async () => {
    await client.post('/ai/consent', { consent: true });
    setNeedsConsent(false);
    setError(null);
  }, [client]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      setSending(true);
      setError(null);
      const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content }];
      setMessages(nextMessages);
      try {
        const res = await client.post<AiChatResponse>('/ai/chat', {
          messages: nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
          orderId,
        });
        setNeedsConsent(false);
        setMessages(res.messages);
      } catch (e) {
        if (e instanceof ApiRequestError && e.code === 'AI_CONSENT_REQUIRED') {
          setNeedsConsent(true);
          setError(e.message);
          setMessages(messages);
        } else {
          setError(e instanceof ApiRequestError ? e.message : 'Не удалось получить ответ');
        }
      } finally {
        setSending(false);
      }
    },
    [client, messages, orderId, sending],
  );

  return { messages, sending, error, needsConsent, grantConsent, orderId, setOrderId, send };
}
