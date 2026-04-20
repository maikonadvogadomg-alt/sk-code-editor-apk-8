import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useColors } from '@/hooks/useColors';
import { Message } from '@/services/ai';

interface Props {
  message: Message;
}

interface Segment {
  type: 'text' | 'code';
  content: string;
  lang?: string;
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', lang: match[1] || 'código', content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[codeStyles.container, { backgroundColor: '#0d1117', borderColor: '#30363d' }]}>
      <View style={codeStyles.header}>
        <Text style={codeStyles.lang}>{lang}</Text>
        <TouchableOpacity onPress={handleCopy} style={codeStyles.copyBtn}>
          <Feather name={copied ? 'check' : 'copy'} size={13} color={copied ? '#22c55e' : '#8b949e'} />
          <Text style={[codeStyles.copyText, { color: copied ? '#22c55e' : '#8b949e' }]}>
            {copied ? 'Copiado!' : 'Copiar'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={codeStyles.code} selectable>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

export function ChatMessage({ message }: Props) {
  const colors = useColors();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const segments = parseSegments(message.content);
  const hasCode = segments.some((s) => s.type === 'code');

  const handleCopyAll = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={[styles.bubble, { backgroundColor: colors.primary, borderColor: colors.primary, maxWidth: '80%' }]}>
          <Text style={[styles.text, { color: colors.primaryForeground }]} selectable>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={styles.avatarText}>IA</Text>
      </View>
      <View style={{ flex: 1, maxWidth: '90%' }}>
        <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {segments.map((seg, i) => {
            if (seg.type === 'code') {
              return <CodeBlock key={i} lang={seg.lang ?? 'código'} code={seg.content} />;
            }
            const trimmed = seg.content.trim();
            if (!trimmed) return null;
            return (
              <Text key={i} style={[styles.text, { color: colors.foreground }]} selectable>
                {trimmed}
              </Text>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.copyRow, { opacity: copied ? 1 : 0.7 }]}
          onPress={handleCopyAll}
          activeOpacity={0.6}
        >
          <Feather name={copied ? 'check' : 'copy'} size={12} color={copied ? '#22c55e' : colors.mutedForeground} />
          <Text style={[styles.copyLabel, { color: copied ? '#22c55e' : colors.mutedForeground }]}>
            {copied ? 'Copiado!' : hasCode ? 'Copiar tudo' : 'Copiar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const codeStyles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  lang: {
    color: '#8b949e',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 11,
  },
  code: {
    color: '#e6edf3',
    fontSize: 12.5,
    fontFamily: 'monospace',
    lineHeight: 20,
    padding: 12,
  },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginTop: 2,
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 6,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
    paddingVertical: 2,
  },
  copyLabel: {
    fontSize: 11,
  },
});
