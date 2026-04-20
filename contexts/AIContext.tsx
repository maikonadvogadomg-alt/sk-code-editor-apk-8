import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { AIConfig, PROVIDERS, Message, sendMessage } from '@/services/ai';
import { GitHubConfig } from '@/services/files';

export interface UserProfile {
  nome: string;
  oab: string;
  telefone: string;
  tribunal: string;
  cidade: string;
}

export interface AIProfile {
  id: string;
  name: string;
  icon: string;
  provider: string;
  model: string;
}

const DEFAULT_AI_PROFILES: AIProfile[] = [
  { id: 'principal', name: 'Principal', icon: 'zap', provider: 'openai', model: 'gpt-4o' },
  { id: 'rapido', name: 'Rápido', icon: 'wind', provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { id: 'especializado', name: 'Especializado', icon: 'cpu', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  { id: 'teste', name: 'Teste', icon: 'activity', provider: 'gemini', model: 'gemini-2.0-flash' },
];

interface AIContextValue {
  config: AIConfig;
  apiKeys: Record<string, string>;
  githubConfig: GitHubConfig;
  voiceLang: string;
  maxTokens: number;
  userProfile: UserProfile;
  neonUrl: string;
  profiles: AIProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  setProfile: (id: string, data: Partial<AIProfile>) => void;
  setActiveProvider: (provider: string) => void;
  setActiveModel: (model: string) => void;
  setApiKey: (provider: string, key: string) => void;
  setGithubConfig: (cfg: GitHubConfig) => void;
  setVoiceLang: (lang: string) => void;
  setMaxTokens: (n: number) => void;
  setUserProfile: (profile: UserProfile) => void;
  setNeonUrl: (url: string) => void;
  chat: (messages: Message[], systemPrompt?: string) => Promise<string>;
  isConfigured: boolean;
}

const AIContext = createContext<AIContextValue | null>(null);

const STORAGE_KEYS = {
  apiKeys: '@sk_api_keys',
  activeProvider: '@sk_active_provider',
  activeModel: '@sk_active_model',
  github: '@sk_github',
  voiceLang: '@sk_voice_lang',
  maxTokens: '@sk_max_tokens',
  userProfile: '@sk_user_profile',
  neonUrl: '@sk_neon_url',
  profiles: '@sk_ai_profiles',
  activeProfileId: '@sk_active_profile_id',
};

const DEFAULT_PROFILE: UserProfile = {
  nome: '',
  oab: '',
  telefone: '',
  tribunal: '',
  cidade: '',
};

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [githubConfig, setGithubConfigState] = useState<GitHubConfig>({
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
  });
  const [voiceLang, setVoiceLangState] = useState('pt-BR');
  const [maxTokens, setMaxTokensState] = useState(16384);
  const [userProfile, setUserProfileState] = useState<UserProfile>(DEFAULT_PROFILE);
  const [neonUrl, setNeonUrlState] = useState('');
  const [profiles, setProfilesState] = useState<AIProfile[]>(DEFAULT_AI_PROFILES);
  const [activeProfileId, setActiveProfileIdState] = useState('principal');

  useEffect(() => {
    (async () => {
      try {
        const [keysStr, ghStr, lang, tokStr, profileStr, neonStr, profilesStr, activeIdStr] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.apiKeys),
            AsyncStorage.getItem(STORAGE_KEYS.github),
            AsyncStorage.getItem(STORAGE_KEYS.voiceLang),
            AsyncStorage.getItem(STORAGE_KEYS.maxTokens),
            AsyncStorage.getItem(STORAGE_KEYS.userProfile),
            AsyncStorage.getItem(STORAGE_KEYS.neonUrl),
            AsyncStorage.getItem(STORAGE_KEYS.profiles),
            AsyncStorage.getItem(STORAGE_KEYS.activeProfileId),
          ]);
        if (keysStr) setApiKeys(JSON.parse(keysStr));
        if (ghStr) setGithubConfigState(JSON.parse(ghStr));
        if (lang) setVoiceLangState(lang);
        if (tokStr) setMaxTokensState(Number(tokStr));
        if (profileStr) setUserProfileState(JSON.parse(profileStr));
        if (neonStr) setNeonUrlState(neonStr);
        if (profilesStr) setProfilesState(JSON.parse(profilesStr));
        if (activeIdStr) setActiveProfileIdState(activeIdStr);
      } catch {}
    })();
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;

  const setApiKey = useCallback(async (provider: string, key: string) => {
    setApiKeys((prev) => {
      const next = { ...prev, [provider]: key };
      AsyncStorage.setItem(STORAGE_KEYS.apiKeys, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setActiveProfileId = useCallback((id: string) => {
    setActiveProfileIdState(id);
    AsyncStorage.setItem(STORAGE_KEYS.activeProfileId, id).catch(() => {});
  }, []);

  const setProfile = useCallback((id: string, data: Partial<AIProfile>) => {
    setProfilesState((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
      AsyncStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setActiveProvider = useCallback(
    (provider: string) => {
      const model = PROVIDERS[provider]?.models[0] ?? '';
      setProfile(activeProfileId, { provider, model });
    },
    [activeProfileId, setProfile],
  );

  const setActiveModel = useCallback(
    (model: string) => {
      setProfile(activeProfileId, { model });
    },
    [activeProfileId, setProfile],
  );

  const setGithubConfig = useCallback((cfg: GitHubConfig) => {
    setGithubConfigState(cfg);
    AsyncStorage.setItem(STORAGE_KEYS.github, JSON.stringify(cfg)).catch(() => {});
  }, []);

  const setVoiceLang = useCallback((lang: string) => {
    setVoiceLangState(lang);
    AsyncStorage.setItem(STORAGE_KEYS.voiceLang, lang).catch(() => {});
  }, []);

  const setMaxTokens = useCallback((n: number) => {
    setMaxTokensState(n);
    AsyncStorage.setItem(STORAGE_KEYS.maxTokens, String(n)).catch(() => {});
  }, []);

  const setUserProfile = useCallback((profile: UserProfile) => {
    setUserProfileState(profile);
    AsyncStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(profile)).catch(() => {});
  }, []);

  const setNeonUrl = useCallback((url: string) => {
    setNeonUrlState(url);
    AsyncStorage.setItem(STORAGE_KEYS.neonUrl, url).catch(() => {});
  }, []);

  const chat = useCallback(
    async (messages: Message[], systemPrompt?: string): Promise<string> => {
      const cfg: AIConfig = {
        provider: activeProfile.provider,
        apiKey: apiKeys[activeProfile.provider] ?? '',
        model: activeProfile.model,
        maxTokens,
      };
      return sendMessage(messages, cfg, systemPrompt);
    },
    [activeProfile, apiKeys, maxTokens],
  );

  const config: AIConfig = {
    provider: activeProfile.provider,
    apiKey: apiKeys[activeProfile.provider] ?? '',
    model: activeProfile.model,
    maxTokens,
  };

  const isConfigured = !!(
    apiKeys[activeProfile.provider] && apiKeys[activeProfile.provider]!.length > 5
  );

  return (
    <AIContext.Provider
      value={{
        config,
        apiKeys,
        githubConfig,
        voiceLang,
        maxTokens,
        userProfile,
        neonUrl,
        profiles,
        activeProfileId,
        setActiveProfileId,
        setProfile,
        setActiveProvider,
        setActiveModel,
        setApiKey,
        setGithubConfig,
        setVoiceLang,
        setMaxTokens,
        setUserProfile,
        setNeonUrl,
        chat,
        isConfigured,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI deve ser usado dentro de AIProvider');
  return ctx;
}
