import { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAssistantChat } from '../../src/ai/useAssistantChat';
import { Button } from '../../src/ui/Button';
import { FormattedText } from '../../src/ui/FormattedText';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

export default function ProfileSupportScreen() {
  const client = useApiClient();
  const chat = useAssistantChat(client);
  const [chatInput, setChatInput] = useState('');
  const [orders, setOrders] = useState<{ id: string; number: string }[]>([]);

  useEffect(() => {
    void client
      .get<{ id: string; number: string }[]>('/orders')
      .then((list) => setOrders(list.map((o) => ({ id: o.id, number: o.number }))))
      .catch(() => setOrders([]));
  }, [client]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Поддержка</Text>
      <Text style={styles.sub}>Чат-ассистент picPac: заказы, каталог и советы по оформлению.</Text>

      <View style={styles.chatWrap}>
        <ScrollView contentContainerStyle={styles.chatList} style={styles.chatScroll}>
          {chat.messages.map((m, i) => (
            <View
              key={`${m.role}-${i}`}
              style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}
            >
              <FormattedText style={styles.bubbleText}>{m.content}</FormattedText>
            </View>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            style={[styles.chip, !chat.orderId && styles.chipOn]}
            onPress={() => chat.setOrderId(undefined)}
          >
            <Text style={styles.chipText}>Без заказа</Text>
          </Pressable>
          {orders.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.chip, chat.orderId === o.id && styles.chipOn]}
              onPress={() => chat.setOrderId(o.id)}
            >
              <Text style={styles.chipText}>{o.number}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {chat.error ? <Text style={styles.error}>{chat.error}</Text> : null}

        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Спросите про заказ или каталог"
            placeholderTextColor={lightColors.textMuted}
          />
          <Button
            title="↵"
            onPress={() => {
              const t = chatInput;
              setChatInput('');
              void chat.send(t);
            }}
            disabled={chat.sending}
          />
        </View>
      </View>

      <Text style={styles.contactsTitle}>Другие способы</Text>
      <Button title="Email support@picpac.by" onPress={() => void Linking.openURL('mailto:support@picpac.by')} />
      <Button
        title="Instagram @picpac_by"
        variant="secondary"
        onPress={() => void Linking.openURL('https://instagram.com/picpac_by')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.bg,
    padding: space[4],
    gap: space[3],
  },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  chatWrap: { flex: 1, gap: space[2], minHeight: 280 },
  chatScroll: { flex: 1 },
  chatList: { gap: space[2], paddingBottom: space[2] },
  bubble: { maxWidth: '88%', padding: space[3], borderRadius: radius.card },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: lightColors.accentSoft },
  bubbleBot: { alignSelf: 'flex-start', backgroundColor: lightColors.surfaceMuted },
  bubbleText: { ...typography.body, color: lightColors.text },
  chipsScroll: { flexGrow: 0, maxHeight: 44 },
  chips: {
    alignItems: 'center',
    flexGrow: 0,
    gap: space[2],
    paddingVertical: 4,
  },
  chip: {
    height: 36,
    paddingHorizontal: space[3],
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: lightColors.surfaceMuted,
  },
  chipOn: { backgroundColor: lightColors.accentSoft },
  chipText: { ...typography.caption, color: lightColors.text },
  chatInputRow: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
  chatInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingHorizontal: space[3],
    ...typography.body,
    color: lightColors.text,
    backgroundColor: lightColors.surface,
  },
  error: { ...typography.caption, color: lightColors.danger },
  contactsTitle: { ...typography.h3, color: lightColors.text, marginTop: space[2] },
});
