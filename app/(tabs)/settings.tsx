import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAI } from '@/contexts/AIContext';
import type { AIProfile } from '@/contexts/AIContext';
import { PROVIDERS } from '@/services/ai';

const BG = '#0d1117';
const CARD = '#161b22';
const BORDER = '#21262d';
const MUTED = '#8b949e';
const FG = '#e6edf3';
const PRIMARY = '#7c6ef0';
const SUCCESS = '#3fb950';
const DANGER = '#f85149';
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const TOKEN_PRESETS = [
  { label: '4K', value: 4096 },
  { label: '8K', value: 8192 },
  { label: '16K', value: 16384 },
  { label: '32K', value: 32768 },
  { label: '64K', value: 65536 },
  { label: 'Máx', value: 131072 },
];

const VOICE_LANGS = [
  { label: 'PT-BR', value: 'pt-BR' },
  { label: 'EN-US', value: 'en-US' },
  { label: 'ES', value: 'es-ES' },
];

const PROFILE_COLORS: Record<string, string> = {
  principal: '#7c6ef0',
  rapido: '#3fb950',
  especializado: '#79c0ff',
  teste: '#f0c674',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
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
    setApiKey,
    setGithubConfig,
    setVoiceLang,
    setMaxTokens,
    setUserProfile,
    setNeonUrl,
  } = useAI();

  const [editingProfileId, setEditingProfileId] = useState(activeProfileId);
  const editingProfile = profiles.find((p) => p.id === editingProfileId) ?? profiles[0]!;

  const [localModel, setLocalModel] = useState(editingProfile.model);
  const [ghToken, setGhToken] = useState(githubConfig.token);
  const [ghOwner, setGhOwner] = useState(githubConfig.owner);
  const [ghRepo, setGhRepo] = useState(githubConfig.repo);
  const [ghBranch, setGhBranch] = useState(githubConfig.branch);
  const [neonInput, setNeonInput] = useState(neonUrl);
  const [savedBadge, setSavedBadge] = useState('');

  const [profileNome, setProfileNome] = useState(userProfile.nome);
  const [profileOab, setProfileOab] = useState(userProfile.oab);
  const [profileTel, setProfileTel] = useState(userProfile.telefone);
  const [profileTribunal, setProfileTribunal] = useState(userProfile.tribunal);
  const [profileCidade, setProfileCidade] = useState(userProfile.cidade);

  const badge = (key: string) => {
    setSavedBadge(key);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSavedBadge(''), 2000);
  };

  const switchEditingProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id)!;
    setEditingProfileId(id);
    setLocalModel(p.model);
  };

  const saveProfile = () => {
    setProfile(editingProfileId, { model: localModel });
    badge('profile-' + editingProfileId);
  };

  const useThisProfile = () => {
    setProfile(editingProfileId, { model: localModel });
    setActiveProfileId(editingProfileId);
    badge('use-' + editingProfileId);
  };

  const resetProfile = () => {
    const defaults: Record<string, Partial<AIProfile>> = {
      principal: { provider: 'openai', model: 'gpt-4o' },
      rapido: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      especializado: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
      teste: { provider: 'gemini', model: 'gemini-2.0-flash' },
    };
    const d = defaults[editingProfileId];
    if (d) {
      setProfile(editingProfileId, d);
      setLocalModel(d.model ?? '');
    }
    badge('reset-' + editingProfileId);
  };

  const providerList = Object.entries(PROVIDERS);
  const activeColor = PROFILE_COLORS[editingProfileId] ?? PRIMARY;
  const activeProfileObj = profiles.find((p) => p.id === activeProfileId)!;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: Platform.OS === 'web' ? 54 : insets.top + 8 }]}>
        <View style={s.headerLeft}>
          <View style={[s.headerIcon, { backgroundColor: PRIMARY + '22', borderColor: PRIMARY + '44' }]}>
            <Feather name="sliders" size={18} color={PRIMARY} />
          </View>
          <View>
            <Text style={s.headerTitle}>Configurações</Text>
            <Text style={s.headerSub}>Configure seus perfis de IA e integrações</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingBottom: Platform.OS === 'web' ? 60 : insets.bottom + 24,
          gap: 16,
        }}
      >
        {/* ── Perfis de IA ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="layers" size={14} color={PRIMARY} />
            <Text style={s.blockTitle}>Perfis de IA</Text>
            <Text style={[s.activeBadge, { color: PROFILE_COLORS[activeProfileId] ?? PRIMARY, borderColor: PROFILE_COLORS[activeProfileId] ?? PRIMARY }]}>
              Ativo: {activeProfileObj?.name}
            </Text>
          </View>

          {/* Tabs de perfil */}
          <View style={s.profileTabs}>
            {profiles.map((p) => {
              const color = PROFILE_COLORS[p.id] ?? PRIMARY;
              const isEditing = editingProfileId === p.id;
              const isActive = activeProfileId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    s.profileTab,
                    isEditing && { backgroundColor: color + '18', borderColor: color },
                  ]}
                  onPress={() => switchEditingProfile(p.id)}
                >
                  <Feather
                    name={p.icon as any}
                    size={16}
                    color={isEditing ? color : MUTED}
                  />
                  <Text style={[s.profileTabText, { color: isEditing ? color : MUTED }]}>
                    {p.name}
                  </Text>
                  {isActive && (
                    <View style={[s.activeProfileDot, { backgroundColor: color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[s.editingLabel, { borderColor: activeColor + '30' }]}>
            <Feather name="edit-3" size={11} color={MUTED} />
            <Text style={s.editingLabelText}>Editando: {editingProfile.name}</Text>
          </View>

          {/* Provedor */}
          <Label>Provedor de IA</Label>
          <View style={s.chipRow}>
            {providerList.map(([key, info]) => {
              const sel = editingProfile.provider === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.chip, sel && { backgroundColor: activeColor + '22', borderColor: activeColor }]}
                  onPress={() => {
                    const model = PROVIDERS[key]?.models[0] ?? '';
                    setProfile(editingProfileId, { provider: key, model });
                    setLocalModel(model);
                  }}
                >
                  <Text style={[s.chipText, { color: sel ? activeColor : MUTED }]}>{info.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reset */}
          <TouchableOpacity style={s.resetBtn} onPress={resetProfile}>
            <Feather name="trash-2" size={13} color={DANGER} />
            <Text style={[s.resetBtnText]}>Resetar / Limpar este perfil</Text>
          </TouchableOpacity>

          {/* Chave de API do provedor ativo */}
          <Label>Chave de API — {PROVIDERS[editingProfile.provider]?.name}</Label>
          <ApiKeyRow
            providerKey={editingProfile.provider}
            value={apiKeys[editingProfile.provider] ?? ''}
            isSaved={savedBadge === 'key-' + editingProfile.provider}
            onSave={(k, v) => { setApiKey(k, v); badge('key-' + k); }}
          />

          {/* Modelo */}
          <Label>Modelo <Text style={{ color: MUTED, fontSize: 11 }}>(deixe vazio para automático)</Text></Label>
          <View style={s.modelRow}>
            <TextInput
              style={s.modelInput}
              value={localModel}
              onChangeText={setLocalModel}
              placeholder="Automático (deixe vazio)"
              placeholderTextColor="#484f58"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Modelos sugeridos */}
          {PROVIDERS[editingProfile.provider] && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {PROVIDERS[editingProfile.provider]!.models.map((m) => {
                  const sel = localModel === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.modelChip, sel && { backgroundColor: activeColor + '22', borderColor: activeColor }]}
                      onPress={() => setLocalModel(m)}
                    >
                      <Text style={[s.modelChipText, { color: sel ? activeColor : MUTED }]}>
                        {m.split('/').pop()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Botões salvar / usar */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={[s.saveProfileBtn, { flex: 1, borderColor: savedBadge === 'profile-' + editingProfileId ? SUCCESS : '#30363d' }]}
              onPress={saveProfile}
            >
              <View style={[s.saveDot, { backgroundColor: savedBadge === 'profile-' + editingProfileId ? SUCCESS : '#484f58' }]} />
              <Text style={[s.saveProfileBtnText, { color: savedBadge === 'profile-' + editingProfileId ? SUCCESS : MUTED }]}>
                {savedBadge === 'profile-' + editingProfileId ? 'Salvo!' : 'Salvar alterações'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.useProfileBtn, { backgroundColor: activeColor + '22', borderColor: activeColor }]}
              onPress={useThisProfile}
            >
              <Feather name="check-circle" size={13} color={activeColor} />
              <Text style={[s.useProfileBtnText, { color: activeColor }]}>
                Usar {editingProfile.name}
              </Text>
            </TouchableOpacity>
          </View>
        </Block>

        {/* ── Resumo de chaves ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="key" size={14} color="#f0c674" />
            <Text style={s.blockTitle}>Chaves de API</Text>
          </View>
          <View style={s.keyGrid}>
            {providerList.map(([key, info]) => {
              const k = apiKeys[key];
              const hasKey = k && k.length > 5;
              return (
                <View key={key} style={s.keyItem}>
                  <Text style={[s.keyLabel, { color: hasKey ? FG : MUTED }]}>{info.name}</Text>
                  <Text style={[s.keyVal, { color: hasKey ? '#3fb950' : '#484f58' }]} numberOfLines={1}>
                    {hasKey ? k!.slice(0, 8) + '...' : 'não configurada'}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={s.divider} />
          {providerList.map(([key, info]) => (
            <ApiKeyInput
              key={key}
              label={info.name}
              providerKey={key}
              value={apiKeys[key] ?? ''}
              isSaved={savedBadge === 'fullkey-' + key}
              onSave={(k, v) => { setApiKey(k, v); badge('fullkey-' + k); }}
            />
          ))}
        </Block>

        {/* ── Dados do Advogado ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="user" size={14} color="#79c0ff" />
            <Text style={s.blockTitle}>Dados do Advogado</Text>
          </View>
          <Text style={s.hint}>Preenchidos automaticamente em documentos exportados</Text>
          <View style={{ gap: 10, marginTop: 10 }}>
            {[
              { label: 'Nome completo', value: profileNome, set: setProfileNome, placeholder: 'Dr. João Silva' },
              { label: 'OAB', value: profileOab, set: setProfileOab, placeholder: 'OAB/SP 123.456' },
              { label: 'Telefone / WhatsApp', value: profileTel, set: setProfileTel, placeholder: '(11) 99999-9999' },
              { label: 'Tribunal / Comarca', value: profileTribunal, set: setProfileTribunal, placeholder: 'TJSP – Comarca de São Paulo' },
              { label: 'Cidade / Estado', value: profileCidade, set: setProfileCidade, placeholder: 'São Paulo – SP' },
            ].map((f) => (
              <View key={f.label}>
                <Label>{f.label}</Label>
                <TextInput
                  style={s.input}
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.placeholder}
                  placeholderTextColor="#484f58"
                  autoCapitalize="words"
                />
              </View>
            ))}
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: savedBadge === 'lawyer' ? SUCCESS : PRIMARY }]}
              onPress={() => {
                setUserProfile({ nome: profileNome, oab: profileOab, telefone: profileTel, tribunal: profileTribunal, cidade: profileCidade });
                badge('lawyer');
              }}
            >
              <Feather name={savedBadge === 'lawyer' ? 'check' : 'user'} size={15} color="#fff" />
              <Text style={s.bigBtnText}>{savedBadge === 'lawyer' ? 'Salvo!' : 'Salvar Dados Pessoais'}</Text>
            </TouchableOpacity>
          </View>
        </Block>

        {/* ── GitHub ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="github" size={14} color={FG} />
            <Text style={s.blockTitle}>GitHub</Text>
          </View>
          <View style={{ gap: 10, marginTop: 6 }}>
            {[
              { label: 'Token de acesso', value: ghToken, set: setGhToken, secure: true, placeholder: 'ghp_...' },
              { label: 'Usuário / Organização', value: ghOwner, set: setGhOwner, secure: false, placeholder: 'meu-usuario' },
              { label: 'Repositório', value: ghRepo, set: setGhRepo, secure: false, placeholder: 'meu-repo' },
              { label: 'Branch', value: ghBranch, set: setGhBranch, secure: false, placeholder: 'main' },
            ].map((f) => (
              <View key={f.label}>
                <Label>{f.label}</Label>
                <TextInput
                  style={s.input}
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.placeholder}
                  placeholderTextColor="#484f58"
                  secureTextEntry={f.secure}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: savedBadge === 'github' ? SUCCESS : '#21262d', borderWidth: 1, borderColor: '#30363d' }]}
              onPress={() => {
                setGithubConfig({ token: ghToken, owner: ghOwner, repo: ghRepo, branch: ghBranch });
                badge('github');
              }}
            >
              <Feather name={savedBadge === 'github' ? 'check' : 'save'} size={15} color={savedBadge === 'github' ? '#fff' : MUTED} />
              <Text style={[s.bigBtnText, { color: savedBadge === 'github' ? '#fff' : MUTED }]}>
                {savedBadge === 'github' ? 'Salvo!' : 'Salvar GitHub'}
              </Text>
            </TouchableOpacity>
          </View>
        </Block>

        {/* ── Neon DB ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="database" size={14} color={SUCCESS} />
            <Text style={s.blockTitle}>Banco de Dados Neon</Text>
          </View>
          <Text style={s.hint}>Conecte um banco Neon PostgreSQL para usar com a IA</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TextInput
              style={[s.input, { flex: 1, borderColor: neonInput.startsWith('postgresql') ? SUCCESS : BORDER }]}
              value={neonInput}
              onChangeText={setNeonInput}
              placeholder="postgresql://user:pass@host/dbname"
              placeholderTextColor="#484f58"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: savedBadge === 'neon' ? SUCCESS : PRIMARY }]}
              onPress={() => { setNeonUrl(neonInput); badge('neon'); }}
            >
              <Feather name={savedBadge === 'neon' ? 'check' : 'save'} size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          {neonInput.startsWith('postgresql') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SUCCESS }} />
              <Text style={{ fontSize: 12, color: SUCCESS }}>Conexão configurada</Text>
            </View>
          )}
          <Text style={[s.hint, { marginTop: 8 }]}>
            Obtenha a URL em console.neon.tech → seu projeto → Connection Details
          </Text>
        </Block>

        {/* ── Tokens ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="sliders" size={14} color="#f0c674" />
            <Text style={s.blockTitle}>Limite de Tokens</Text>
            <Text style={s.activeBadge}>atual: {maxTokens.toLocaleString()}</Text>
          </View>
          <View style={[s.chipRow, { marginTop: 10 }]}>
            {TOKEN_PRESETS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[s.chip, maxTokens === t.value && { backgroundColor: '#f0c67422', borderColor: '#f0c674' }]}
                onPress={() => setMaxTokens(t.value)}
              >
                <Text style={[s.chipText, { color: maxTokens === t.value ? '#f0c674' : MUTED }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.hint}>Valores altos usam mais créditos de API. "Máx" força o limite máximo do modelo.</Text>
        </Block>

        {/* ── Voz ── */}
        <Block>
          <View style={s.blockTitleRow}>
            <Feather name="mic" size={14} color="#79c0ff" />
            <Text style={s.blockTitle}>Voz</Text>
          </View>
          <Label>Idioma de transcrição</Label>
          <View style={[s.chipRow, { marginTop: 8 }]}>
            {VOICE_LANGS.map((l) => (
              <TouchableOpacity
                key={l.value}
                style={[s.chip, voiceLang === l.value && { backgroundColor: PRIMARY + '22', borderColor: PRIMARY }]}
                onPress={() => setVoiceLang(l.value)}
              >
                <Text style={[s.chipText, { color: voiceLang === l.value ? PRIMARY : MUTED }]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Block>

        {/* Status bar estilo CodeLens */}
        <View style={s.statusFooter}>
          <View style={[s.statusDot, { backgroundColor: SUCCESS }]} />
          <Text style={s.statusFooterText}>SK Code Ready</Text>
          <Text style={[s.statusFooterText, { color: '#484f58' }]}>·</Text>
          <Text style={s.statusFooterText}>{activeProfileObj?.name} ({PROVIDERS[activeProfileObj?.provider]?.name ?? activeProfileObj?.provider})</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return <View style={s.block}>{children}</View>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

function ApiKeyRow({
  providerKey, value, isSaved, onSave,
}: { providerKey: string; value: string; isSaved: boolean; onSave: (k: string, v: string) => void }) {
  const [local, setLocal] = useState(value);
  const [show, setShow] = useState(false);
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
      <TextInput
        style={[s.input, { flex: 1 }]}
        value={local}
        onChangeText={setLocal}
        placeholder="sk-... / gsk-... / AIza..."
        placeholderTextColor="#484f58"
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={[s.iconBtn, { backgroundColor: CARD }]} onPress={() => setShow((v) => !v)}>
        <Feather name={show ? 'eye-off' : 'eye'} size={16} color={MUTED} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.iconBtn, { backgroundColor: isSaved ? SUCCESS : PRIMARY }]}
        onPress={() => onSave(providerKey, local)}
      >
        <Feather name={isSaved ? 'check' : 'save'} size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function ApiKeyInput({
  label, providerKey, value, isSaved, onSave,
}: { label: string; providerKey: string; value: string; isSaved: boolean; onSave: (k: string, v: string) => void }) {
  const [local, setLocal] = useState(value);
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={local}
          onChangeText={setLocal}
          placeholder={`Chave ${label}`}
          placeholderTextColor="#484f58"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: CARD }]} onPress={() => setShow((v) => !v)}>
          <Feather name={show ? 'eye-off' : 'eye'} size={16} color={MUTED} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: isSaved ? SUCCESS : PRIMARY }]}
          onPress={() => onSave(providerKey, local)}
        >
          <Feather name={isSaved ? 'check' : 'save'} size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: FG },
  headerSub: { fontSize: 12, color: MUTED, marginTop: 2 },

  block: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  blockTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  blockTitle: { fontSize: 13, fontWeight: '700', color: FG, flex: 1 },
  activeBadge: {
    fontSize: 11, fontWeight: '600', color: PRIMARY,
    borderWidth: 1, borderColor: PRIMARY, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },

  profileTabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  profileTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: BORDER, gap: 5,
  },
  profileTabText: { fontSize: 11, fontWeight: '700' },
  activeProfileDot: { width: 5, height: 5, borderRadius: 3 },

  editingLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#0d1117', borderRadius: 6, borderWidth: 1,
    marginBottom: 12,
  },
  editingLabelText: { fontSize: 11, color: MUTED },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#0d1117',
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginVertical: 10, paddingVertical: 10, borderRadius: 8,
    backgroundColor: DANGER + '15', borderWidth: 1, borderColor: DANGER + '40',
  },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: DANGER },

  modelRow: { marginTop: 6 },
  modelInput: {
    backgroundColor: '#0d1117', color: FG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: MONO,
  },
  modelChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#0d1117',
  },
  modelChipText: { fontSize: 11, fontFamily: MONO },

  saveProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, borderRadius: 8, backgroundColor: '#0d1117', borderWidth: 1,
  },
  saveDot: { width: 8, height: 8, borderRadius: 4 },
  saveProfileBtnText: { fontSize: 13, fontWeight: '600' },
  useProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
  },
  useProfileBtnText: { fontSize: 13, fontWeight: '700' },

  keyGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10,
  },
  keyItem: {
    backgroundColor: '#0d1117', borderRadius: 8, borderWidth: 1,
    borderColor: BORDER, paddingHorizontal: 10, paddingVertical: 7,
    minWidth: '30%',
  },
  keyLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  keyVal: { fontSize: 10, fontFamily: MONO },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },

  label: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 4 },
  hint: { fontSize: 11, color: '#484f58', lineHeight: 16 },
  input: {
    backgroundColor: '#0d1117', color: FG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 4,
  },
  bigBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statusFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusFooterText: { fontSize: 12, color: MUTED, fontFamily: MONO },
});
