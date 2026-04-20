import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export function speak(text: string, lang: string = 'pt-BR'): void {
  Speech.stop();
  Speech.speak(text, {
    language: lang,
    pitch: 1.0,
    rate: Platform.OS === 'ios' ? 0.52 : 1.0,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}
