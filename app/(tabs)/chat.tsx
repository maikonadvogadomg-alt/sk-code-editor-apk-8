import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatMessage } from '@/components/ChatMessage';
import { VoiceButton } from '@/components/VoiceButton';
import { useAI } from '@/contexts/AIContext';
import { useColors } from '@/hooks/useColors';
import { Message } from '@/services/ai';
import { speak, stopSpeaking } from '@/services/voice';

const SYSTEM_PROMPT =
  'Você é um assistente IA inteligente, criativo e prestativo. Responda de forma natural, clara e útil. Use português do Brasil.';

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chat, isConfigured, config } = useAI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    try {
      const reply = await chat(newMessages, SYSTEM_PROMPT);
      const assistantMsg: Message = { role: 'assistant', content: reply };
      setMessages((prev) => [...prev, assistantMsg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const errMsg: Message = {
        role: 'assistant',
        content: `Erro: ${e instanceof Error ? e.message : 'Algo deu errado'}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeak = async (text: string) => {
    const currently = await Speech.isSpeakingAsync();
    if (currently) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speak(text);
      setTimeout(() => setSpeaking(false), text.length * 60);
    }
  };

  const clearChat = () => {
    setMessages([]);
    stopSpeaking();
    setSpeaking(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Platform.OS === 'web' ? 67 : insets.top,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Chat Livre</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {config.provider} · {config.model}
          </Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {!isConfigured && (
        <View style={[styles.warning, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]}>
          <Feather name="alert-circle" size={14} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            Configure sua chave de API em Configurações
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <View>
            <ChatMessage message={item} />
            {item.role === 'assistant' && (
              <TouchableOpacity
                style={[styles.speakBtn, { marginLeft: 46 }]}
                onPress={() => toggleSpeak(item.content)}
              >
                <Feather
                  name={speaking ? 'volume-x' : 'volume-2'}
                  size={14}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 20 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Comece uma conversa
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Digite ou segure o microfone para falar
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 8,
            },
          ]}
        >
          <VoiceButton onTranscript={(t) => send(t)} disabled={loading} />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Mensagem..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: loading || !input.trim() ? colors.secondary : colors.primary },
            ]}
            onPress={() => send()}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="send" size={18} color={!input.trim() ? colors.mutedForeground : '#fff'} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' as const },
  headerSub: { fontSize: 12, marginTop: 2 },
  clearBtn: { padding: 8 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    margin: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: { fontSize: 13, flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600' as const },
  emptyHint: { fontSize: 13 },
  speakBtn: { paddingHorizontal: 12, paddingBottom: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
