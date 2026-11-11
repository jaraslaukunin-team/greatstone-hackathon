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
  const [orderId, setOrderId] = useState<string | undefined>();

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      setSending(true);
      setError(null);
      const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content }];
      setMessages(nextMessages);
      try {
        await client.post('/ai/consent', { consent: true });
        const res = await client.post<AiChatResponse>('/ai/chat', {
          messages: nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
          orderId,
        });
        setMessages(res.messages);
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : 'Не удалось получить ответ');
      } finally {
        setSending(false);
      }
    },
    [client, messages, orderId, sending],
  );

  return { messages, sending, error, orderId, setOrderId, send };
}
