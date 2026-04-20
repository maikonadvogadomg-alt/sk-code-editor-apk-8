import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAI } from '@/contexts/AIContext';
import { transcribeAudio } from '@/services/ai';
import { useColors } from '@/hooks/useColors';

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function VoiceButton({ onTranscript, disabled, compact }: Props) {
  const colors = useColors();
  const { apiKeys } = useAI();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.btn, { backgroundColor: colors.secondary }]}>
        <Feather name="mic-off" size={20} color={colors.mutedForeground} />
      </View>
    );
  }

  const startRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = rec;
      setRecording(rec);
    } catch (e) {
      console.warn('Erro ao iniciar gravação', e);
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setRecording(null);
      if (!uri) return;
      setIsTranscribing(true);
      const openaiKey = apiKeys['openai'] ?? '';
      const groqKey = apiKeys['groq'] ?? '';
      const key = openaiKey || groqKey;
      if (!key) {
        onTranscript('[Configure chave OpenAI ou Groq para usar voz]');
        return;
      }
      const text = await transcribeAudio(uri, key);
      if (text) onTranscript(text);
    } catch (e) {
      console.warn('Erro ao transcrever', e);
    } finally {
      setIsTranscribing(false);
    }
  };

  if (isTranscribing) {
    return (
      <View style={compact ? styles.compactBtn : [styles.btn, { backgroundColor: colors.secondary }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        {compact && <Text style={styles.compactLabel}>...</Text>}
      </View>
    );
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactBtn, recording && { backgroundColor: colors.destructive + '22', borderColor: colors.destructive }]}
        onPressIn={startRecording}
        onPressOut={stopRecording}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Feather name="mic" size={13} color={recording ? colors.destructive : colors.mutedForeground} />
        <Text style={[styles.compactLabel, { color: recording ? colors.destructive : colors.mutedForeground }]}>
          {recording ? 'GRAVANDO' : 'DITAR'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {
          backgroundColor: recording ? colors.destructive : colors.secondary,
        },
      ]}
      onPressIn={startRecording}
      onPressOut={stopRecording}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Feather
        name="mic"
        size={20}
        color={recording ? '#fff' : colors.mutedForeground}
      />
      {recording && <Text style={styles.recText}>...</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  recText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  compactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#21262d',
    backgroundColor: '#161b22',
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
});
