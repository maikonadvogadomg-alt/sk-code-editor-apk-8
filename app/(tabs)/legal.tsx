import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoiceButton } from '@/components/VoiceButton';
import { useAI } from '@/contexts/AIContext';
import { importDocument } from '@/services/files';
import { speak, stopSpeaking } from '@/services/voice';

const BG = '#0d1117';
const CARD = '#161b22';
const BORDER = '#21262d';
const MUTED = '#8b949e';
const FG = '#e6edf3';
const PRIMARY = '#7c6ef0';
const SUCCESS = '#3fb950';

// ── Abas especializadas (igual novoversel) ────────────────────────────────────
const SPEC_TABS = [
  { key: 'consulta',      label: 'Consulta',      icon: 'message-circle', color: '#7c6ef0' },
  { key: 'auditoria',     label: 'Auditoria',     icon: 'search',         color: '#79c0ff' },
  { key: 'pdpj',          label: 'Token PDPJ',    icon: 'key',            color: '#f0c674' },
  { key: 'pdrj',          label: 'PDRJ',          icon: 'layers',         color: '#e3b341' },
  { key: 'comunicacoes',  label: 'Comunicações',  icon: 'mail',           color: '#58a6ff' },
  { key: 'tramitacao',    label: 'Tramitação',    icon: 'git-merge',      color: '#3fb950' },
  { key: 'codigos',       label: 'Códigos',       icon: 'code',           color: '#f85149' },
  { key: 'filtrador',     label: 'Filtrador',     icon: 'filter',         color: '#a855f7' },
  { key: 'previdenciario',label: 'Previdenciário',icon: 'shield',         color: '#06b6d4' },
  { key: 'livre',         label: 'Livre',         icon: 'zap',            color: '#22c55e' },
];

// ── Prompts por aba especializada ────────────────────────────────────────────
const SPEC_PROMPTS: Record<string, string> = {
  consulta:       'Você é um advogado sênior brasileiro especializado em consultoria jurídica. Analise a questão apresentada e forneça orientação jurídica clara, objetiva e fundamentada. Cite legislação, súmulas e jurisprudência relevantes. Responda em português do Brasil.',
  auditoria:      'Você é um auditor jurídico especializado. Analise o documento ou situação apresentada identificando irregularidades, riscos legais, inconformidades e pontos de atenção. Seja metódico e detalhado. Responda em português do Brasil.',
  pdpj:           'Você é um especialista no sistema PDPJ (Plataforma Digital do Poder Judiciário). Auxilie com questões relacionadas ao token PDPJ, integração de sistemas, certificados digitais e autenticação no PJe. Responda em português do Brasil.',
  pdrj:           'Você é um especialista em PDRJ (Programa de Desenvolvimento do Poder Judiciário do Rio de Janeiro). Auxilie com questões processuais e administrativas do TJRJ. Responda em português do Brasil.',
  comunicacoes:   'Você é um especialista em comunicações processuais judiciais. Auxilie com citações, intimações, publicações no DJe e comunicações oficiais. Responda em português do Brasil.',
  tramitacao:     'Você é um especialista em tramitação processual. Auxilie com análise de andamentos, prazos processuais, distribuição e movimentação de processos judiciais brasileiros. Responda em português do Brasil.',
  codigos:        'Você é um especialista em legislação brasileira. Consulte e explique dispositivos do Código Civil, Código de Processo Civil, Código Penal, CLT, Constituição Federal e demais legislações. Cite artigos precisamente. Responda em português do Brasil.',
  filtrador:      'Você é um especialista em análise e filtragem de documentos jurídicos. Extraia informações relevantes, identifique partes, prazos, valores, obrigações e pontos críticos do texto. Responda em português do Brasil.',
  previdenciario: 'Você é um advogado especialista em Direito Previdenciário brasileiro. Analise questões relacionadas a benefícios do INSS, aposentadoria, invalidez, pensão por morte, auxílios e outros benefícios previdenciários. Responda em português do Brasil.',
  livre:          'Você é um assistente jurídico brasileiro experiente e versátil. Responda perguntas gerais sobre direito, redija documentos, analise situações e forneça orientações jurídicas. Responda em português do Brasil.',
};

// ── Ações de processamento (igual novoversel) ────────────────────────────────
const MAIN_ACTIONS = [
  { key: 'corrigir',   label: 'Corrigir Texto',   icon: 'check-circle', color: '#3fb950' },
  { key: 'redacao',    label: 'Redação Jurídica',  icon: 'edit-2',       color: '#7c6ef0' },
  { key: 'lacunas',    label: 'Verificar Lacunas', icon: 'search',       color: '#f85149' },
];

const OTHER_ACTIONS = [
  { key: 'resumir',    label: 'Resumir',          icon: 'align-left',   color: '#79c0ff' },
  { key: 'revisar',    label: 'Revisar',           icon: 'eye',          color: '#58a6ff' },
  { key: 'refinar',    label: 'Refinar',           icon: 'refresh-cw',   color: '#a855f7' },
  { key: 'simples',    label: 'Linguagem Simples', icon: 'type',         color: '#f0c674' },
  { key: 'minuta',     label: 'Gerar Minuta',      icon: 'file-text',    color: '#e3b341' },
  { key: 'analisar',   label: 'Analisar',          icon: 'bar-chart-2',  color: '#06b6d4' },
];

const ACTION_PROMPTS: Record<string, string> = {
  corrigir:  'Corrija o texto jurídico a seguir mantendo o conteúdo original. Ajuste ortografia, gramática, pontuação, concordância e estilo jurídico formal. Preserve a estrutura e os argumentos. Retorne apenas o texto corrigido:\n\n',
  redacao:   'Redija uma peça jurídica completa e bem fundamentada com base no seguinte:\n\n',
  lacunas:   'Analise o texto jurídico e identifique: (1) lacunas argumentativas, (2) fundamentos legais ausentes, (3) riscos não abordados, (4) pontos que precisam de complementação. Seja específico:\n\n',
  resumir:   'Faça um resumo jurídico claro e objetivo do seguinte texto, destacando os pontos principais, partes envolvidas, obrigações e conclusões:\n\n',
  revisar:   'Revise o seguinte texto jurídico identificando inconsistências, erros de argumentação, problemas formais e sugerindo melhorias específicas:\n\n',
  refinar:   'Refine e melhore o seguinte texto jurídico, tornando-o mais persuasivo, preciso e tecnicamente correto, mantendo a essência do conteúdo:\n\n',
  simples:   'Reescreva o seguinte texto jurídico em linguagem mais simples e acessível, sem perder o sentido jurídico essencial:\n\n',
  minuta:    'Com base nas informações fornecidas, gere uma minuta completa de documento jurídico adequado:\n\n',
  analisar:  'Analise juridicamente o seguinte texto/situação e forneça: (1) análise dos fatos, (2) fundamentos legais aplicáveis, (3) riscos identificados, (4) recomendações práticas:\n\n',
};

interface SavedDoc {
  id: string;
  title: string;
  content: string;
  action: string;
  tab: string;
  date: string;
}

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const { chat, isConfigured, userProfile } = useAI();

  const [specTab, setSpecTab] = useState('consulta');
  const [inputText, setInputText] = useState('');
  const [resultText, setResultText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [voiceOn, setVoiceOn] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showNewModel, setShowNewModel] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>([]);
  const [copied, setCopied] = useState(false);
  const resultScrollRef = useRef<ScrollView>(null);

  const activeTabInfo = SPEC_TABS.find((t) => t.key === specTab)!;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    AsyncStorage.getItem('@sk_legal_docs').then((v) => {
      if (v) setSavedDocs(JSON.parse(v));
    }).catch(() => {});
  }, []);

  const saveDocs = (docs: SavedDoc[]) => {
    setSavedDocs(docs);
    AsyncStorage.setItem('@sk_legal_docs', JSON.stringify(docs)).catch(() => {});
  };

  const processText = async (actionKey: string) => {
    const text = inputText.trim();
    if (!text) { Alert.alert('Atenção', 'Cole ou escreva o texto para processar.'); return; }
    if (!isConfigured) { Alert.alert('API não configurada', 'Configure uma chave de API em Configurações.'); return; }

    setLoading(true);
    setLoadingAction(actionKey);
    setResultText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const actionPrompt = ACTION_PROMPTS[actionKey] ?? '';
    const specPrompt = SPEC_PROMPTS[specTab] ?? SPEC_PROMPTS.livre!;
    const fullPrompt = specPrompt + '\n\nSua tarefa agora: ' + actionPrompt;

    try {
      const result = await chat([{ role: 'user', content: text }], fullPrompt);
      setResultText(result);
      if (voiceOn) speak(result);
      setTimeout(() => resultScrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setResultText(`Erro: ${e instanceof Error ? e.message : 'Algo deu errado'}`);
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleImport = async () => {
    const doc = await importDocument();
    if (!doc) return;
    setInputText(doc.content.slice(0, 8000));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCopy = async () => {
    if (!resultText) return;
    await Clipboard.setStringAsync(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!resultText) return;
    const action = loadingAction || 'processado';
    const doc: SavedDoc = {
      id: Date.now().toString(),
      title: inputText.slice(0, 60).trim() || 'Documento',
      content: resultText,
      action,
      tab: specTab,
      date: new Date().toLocaleDateString('pt-BR'),
    };
    saveDocs([doc, ...savedDocs]);
    Alert.alert('Salvo', 'Documento salvo com sucesso!');
  };

  const handleShare = async () => {
    if (!resultText) return;
    try {
      const { default: Sharing } = await import('expo-sharing');
      const { default: FileSystem } = await import('expo-file-system');
      let content = resultText;
      if (userProfile.nome) {
        const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        content += `\n\n${'─'.repeat(40)}\n${userProfile.cidade ? userProfile.cidade + ', ' : ''}${date}\n\n${userProfile.nome}`;
        if (userProfile.oab) content += `\n${userProfile.oab}`;
        if (userProfile.tribunal) content += `\n${userProfile.tribunal}`;
        if (userProfile.telefone) content += `\nTel: ${userProfile.telefone}`;
      }
      const uri = `${FileSystem.cacheDirectory}juridico_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(uri, content);
      await Sharing.shareAsync(uri);
    } catch (e) { Alert.alert('Erro', String(e)); }
  };

  const toggleVoice = () => {
    if (voiceOn) { stopSpeaking(); setVoiceOn(false); }
    else { setVoiceOn(true); if (resultText) speak(resultText); }
  };

  // ── Tela de documentos salvos ──────────────────────────────────────────────
  if (showDocs) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <TouchableOpacity onPress={() => setShowDocs(false)} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={FG} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Documentos Salvos</Text>
            <Text style={s.headerSub}>{savedDocs.length} documento(s)</Text>
          </View>
          {savedDocs.length > 0 && (
            <TouchableOpacity onPress={() => Alert.alert('Apagar tudo?', '', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => saveDocs([]) },
            ])}>
              <Feather name="trash-2" size={18} color="#f85149" />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: bottomPad + 20 }}>
          {savedDocs.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Feather name="bookmark" size={48} color={BORDER} />
              <Text style={{ color: FG, fontSize: 17, fontWeight: '700' }}>Nenhum documento</Text>
              <Text style={{ color: MUTED, textAlign: 'center', lineHeight: 20 }}>Salve resultados do processamento</Text>
            </View>
          )}
          {savedDocs.map((d) => (
            <View key={d.id} style={s.docCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: FG, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{d.title}</Text>
                  <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{d.action} · {d.tab} · {d.date}</Text>
                </View>
                <TouchableOpacity onPress={() => saveDocs(savedDocs.filter((x) => x.id !== d.id))}>
                  <Feather name="x" size={16} color="#f85149" />
                </TouchableOpacity>
              </View>
              <Text style={{ color: MUTED, fontSize: 12, lineHeight: 18 }} numberOfLines={4}>{d.content}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={[s.docBtn, { borderColor: BORDER }]} onPress={() => { setResultText(d.content); setShowDocs(false); }}>
                  <Feather name="eye" size={12} color={MUTED} />
                  <Text style={[s.docBtnText, { color: MUTED }]}>Ver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.docBtn, { borderColor: PRIMARY + '60' }]} onPress={() => speak(d.content)}>
                  <Feather name="volume-2" size={12} color={PRIMARY} />
                  <Text style={[s.docBtnText, { color: PRIMARY }]}>Ouvir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Tela principal ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <View style={s.headerLogo}>
          <Feather name="briefcase" size={16} color={activeTabInfo.color} />
          <Text style={s.headerTitle}>Assistente Jurídico</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity style={[s.headerBtn, { borderColor: BORDER }]} onPress={handleImport}>
            <Feather name="upload" size={13} color={MUTED} />
            <Text style={[s.headerBtnText, { color: MUTED }]}>Arquivo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.headerBtn, { borderColor: BORDER }]} onPress={() => setShowDocs(true)}>
            <Feather name="bookmark" size={13} color={MUTED} />
            <Text style={[s.headerBtnText, { color: MUTED }]}>Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.headerBtn, { borderColor: voiceOn ? SUCCESS + '80' : BORDER, backgroundColor: voiceOn ? SUCCESS + '15' : 'transparent' }]}
            onPress={toggleVoice}
          >
            <Feather name="volume-2" size={13} color={voiceOn ? SUCCESS : MUTED} />
            <Text style={[s.headerBtnText, { color: voiceOn ? SUCCESS : MUTED }]}>{voiceOn ? 'Voz ON' : 'Voz OFF'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Abas especializadas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBar}
        contentContainerStyle={s.tabBarContent}
      >
        {SPEC_TABS.map((t) => {
          const active = t.key === specTab;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.specTab, active && { borderBottomColor: t.color }]}
              onPress={() => setSpecTab(t.key)}
            >
              <Feather name={t.icon as any} size={11} color={active ? t.color : MUTED} />
              <Text style={[s.specTabText, { color: active ? t.color : MUTED, fontWeight: active ? '700' : '400' }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!isConfigured && (
        <View style={s.alertBar}>
          <Feather name="alert-triangle" size={12} color="#e3b341" />
          <Text style={s.alertText}>Configure uma chave de API em Configurações</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad + 16 }}>

          {/* Área de entrada */}
          <View style={s.inputCard}>
            <View style={s.inputCardHeader}>
              <Text style={s.inputCardLabel}>Entrada de texto:</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {inputText.length > 0 && (
                  <TouchableOpacity onPress={() => setInputText('')} style={s.inputAction}>
                    <Feather name="x" size={13} color={MUTED} />
                  </TouchableOpacity>
                )}
                <VoiceButton onTranscript={(t) => setInputText((prev) => prev + t)} disabled={loading} compact />
              </View>
            </View>
            <TextInput
              style={s.textArea}
              value={inputText}
              onChangeText={setInputText}
              placeholder={'Cole aqui o texto do documento, petição, sentença, contrato ou qualquer outro texto jurídico que deseja processar...'}
              placeholderTextColor="#484f58"
              multiline
              scrollEnabled
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{inputText.length} caracteres</Text>
          </View>

          {/* Modos de operação */}
          <View style={s.sectionCard}>
            <Text style={s.sectionLabel}>Modos de operação:</Text>
            <View style={s.actionGrid}>
              {MAIN_ACTIONS.map((a) => {
                const isRunning = loading && loadingAction === a.key;
                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[s.mainActionBtn, { borderColor: a.color + '60', backgroundColor: a.color + '12' }]}
                    onPress={() => processText(a.key)}
                    disabled={loading}
                  >
                    {isRunning ? (
                      <ActivityIndicator size="small" color={a.color} />
                    ) : (
                      <Feather name={a.icon as any} size={15} color={a.color} />
                    )}
                    <Text style={[s.mainActionText, { color: a.color }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Outras ações */}
          <View style={s.sectionCard}>
            <Text style={s.sectionLabel}>Outras ações:</Text>
            <View style={s.actionGrid}>
              {OTHER_ACTIONS.map((a) => {
                const isRunning = loading && loadingAction === a.key;
                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[s.otherActionBtn, { borderColor: BORDER }]}
                    onPress={() => processText(a.key)}
                    disabled={loading}
                  >
                    {isRunning ? (
                      <ActivityIndicator size="small" color={a.color} />
                    ) : (
                      <Feather name={a.icon as any} size={13} color={a.color} />
                    )}
                    <Text style={[s.otherActionText, { color: isRunning ? a.color : MUTED }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Botão Novo Modelo */}
          <TouchableOpacity style={s.newModelBtn} onPress={() => setShowNewModel(true)}>
            <Feather name="plus" size={14} color={MUTED} />
            <Text style={s.newModelBtnText}>+ Novo Modelo</Text>
          </TouchableOpacity>

          {/* Resultado */}
          {(resultText !== '' || loading) && (
            <View style={s.resultCard}>
              <View style={s.resultHeader}>
                <Text style={s.resultLabel}>Resultado aqui</Text>
                {loading && <ActivityIndicator size="small" color={PRIMARY} />}
                {resultText !== '' && !loading && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={s.resultAction} onPress={handleCopy}>
                      <Feather name={copied ? 'check' : 'copy'} size={14} color={copied ? SUCCESS : MUTED} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.resultAction} onPress={handleSave}>
                      <Feather name="bookmark" size={14} color={MUTED} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.resultAction} onPress={handleShare}>
                      <Feather name="download" size={14} color={MUTED} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.resultAction, voiceOn && { backgroundColor: SUCCESS + '20' }]} onPress={toggleVoice}>
                      <Feather name="volume-2" size={14} color={voiceOn ? SUCCESS : MUTED} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {loading && resultText === '' ? (
                <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator size="large" color={PRIMARY} />
                  <Text style={{ color: MUTED, fontSize: 13 }}>Processando...</Text>
                </View>
              ) : (
                <ScrollView ref={resultScrollRef} style={s.resultScroll} nestedScrollEnabled>
                  <Text selectable style={s.resultText}>{resultText}</Text>
                </ScrollView>
              )}
            </View>
          )}

          {/* Estado vazio */}
          {resultText === '' && !loading && (
            <View style={s.emptyResult}>
              <Feather name="tool" size={32} color={BORDER} />
              <Text style={s.emptyResultText}>Cole o texto no campo acima e escolha uma ação para começar</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal novo modelo personalizado */}
      <Modal visible={showNewModel} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowNewModel(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>Novo Modelo</Text>
            <Text style={[s.modalHint, { color: MUTED }]}>Defina um prompt personalizado para processar o texto</Text>
            <TextInput
              style={[s.modalInput, { height: 120 }]}
              value={newModelName}
              onChangeText={setNewModelName}
              placeholder="Ex: Analise como advogado previdenciário especializado em aposentadoria por invalidez..."
              placeholderTextColor="#484f58"
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#21262d', flex: 1 }]}
                onPress={() => { setShowNewModel(false); setNewModelName(''); }}
              >
                <Text style={{ color: MUTED, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: PRIMARY, flex: 1 }]}
                onPress={async () => {
                  if (!newModelName.trim()) return;
                  setShowNewModel(false);
                  const text = inputText.trim();
                  if (!text) { Alert.alert('Atenção', 'Adicione texto de entrada primeiro.'); return; }
                  setLoading(true);
                  setLoadingAction('custom');
                  setResultText('');
                  try {
                    const result = await chat([{ role: 'user', content: text }], newModelName);
                    setResultText(result);
                    if (voiceOn) speak(result);
                  } catch (e) {
                    setResultText(`Erro: ${e instanceof Error ? e.message : 'Falhou'}`);
                  } finally {
                    setLoading(false);
                    setLoadingAction('');
                    setNewModelName('');
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Processar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: FG },
  headerSub: { fontSize: 11, color: MUTED, marginTop: 1 },
  backBtn: { marginRight: 12, padding: 4 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1,
  },
  headerBtnText: { fontSize: 11, fontWeight: '600' },
  tabBar: { maxHeight: 42, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBarContent: { paddingHorizontal: 8, alignItems: 'center' },
  specTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  specTabText: { fontSize: 12 },
  alertBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#e3b34118', borderBottomWidth: 1, borderBottomColor: '#e3b34133',
  },
  alertText: { fontSize: 12, color: '#e3b341', flex: 1 },
  inputCard: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  inputCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  inputCardLabel: { fontSize: 12, color: MUTED, fontWeight: '600' },
  inputAction: { padding: 4 },
  textArea: {
    color: FG, fontSize: 13, lineHeight: 20,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 160, maxHeight: 280,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  charCount: { fontSize: 10, color: '#484f58', textAlign: 'right', paddingHorizontal: 12, paddingBottom: 6 },
  sectionCard: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    padding: 12,
  },
  sectionLabel: { fontSize: 12, color: MUTED, fontWeight: '600', marginBottom: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mainActionBtn: {
    flex: 1, minWidth: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1,
  },
  mainActionText: { fontSize: 12, fontWeight: '700' },
  otherActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: '#0d1117',
  },
  otherActionText: { fontSize: 12, fontWeight: '600' },
  newModelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed',
  },
  newModelBtnText: { fontSize: 13, color: MUTED, fontWeight: '600' },
  resultCard: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 8,
  },
  resultLabel: { flex: 1, fontSize: 12, color: MUTED, fontWeight: '600' },
  resultAction: { padding: 5 },
  resultScroll: { maxHeight: 360 },
  resultText: {
    color: FG, fontSize: 13, lineHeight: 22,
    padding: 12,
  },
  emptyResult: {
    alignItems: 'center', gap: 10, paddingVertical: 30,
  },
  emptyResultText: { fontSize: 13, color: '#484f58', textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  docCard: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    padding: 14,
  },
  docBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
  },
  docBtnText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000bb',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    width: '90%', backgroundColor: CARD,
    borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: FG, marginBottom: 6 },
  modalHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  modalInput: {
    backgroundColor: BG, color: FG,
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
  },
  modalBtn: {
    paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
});
