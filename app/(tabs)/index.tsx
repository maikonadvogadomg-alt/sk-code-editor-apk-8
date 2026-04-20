import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import {
  VirtualFile,
  exportZip,
  githubPullRepo,
  githubPushFile,
  importZip,
} from '@/services/files';
import { speak } from '@/services/voice';

const CODE_SYSTEM =
  'Você é um assistente especialista em programação. Ajude a criar, debugar, revisar e melhorar código. Seja preciso, explique seu raciocínio e forneça código funcional completo. Use português do Brasil.';

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
  py: 'Python', html: 'HTML', css: 'CSS', json: 'JSON',
  md: 'Markdown', sh: 'Shell', txt: 'Texto', yml: 'YAML',
  yaml: 'YAML', xml: 'XML', sql: 'SQL', rs: 'Rust', go: 'Go',
  java: 'Java', cpp: 'C++', c: 'C', php: 'PHP', rb: 'Ruby',
};

const ICON_MAP: Record<string, string> = {
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code',
  py: 'code', html: 'globe', css: 'droplet', json: 'file-text',
  md: 'book', sh: 'terminal', txt: 'file-text', yml: 'settings',
  yaml: 'settings', xml: 'code', sql: 'database', rs: 'code',
  go: 'code', java: 'code', cpp: 'code', c: 'code',
};

const COLOR_MAP: Record<string, string> = {
  ts: '#3178c6', tsx: '#61dafb', js: '#f0db4f', jsx: '#61dafb',
  py: '#3572a5', html: '#e44d26', css: '#264de4', json: '#f5c518',
  md: '#7952b3', sh: '#4eaa25', txt: '#9e9e9e', yml: '#cb171e',
  yaml: '#cb171e', xml: '#f68314', sql: '#e38c00', rs: '#dea584',
  go: '#00acd7', java: '#b07219', cpp: '#f34b7d', c: '#555555',
  php: '#777bb4', rb: '#cc342d', vue: '#42b883', svelte: '#ff3e00',
  kt: '#a97bff', swift: '#f05138', dart: '#00b4ab',
};

function getLang(name: string) {
  return LANG_MAP[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'Arquivo';
}
function getIcon(name: string) {
  return (ICON_MAP[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'file') as 'code';
}
function getFileColor(name: string, fallback: string) {
  return COLOR_MAP[name.split('.').pop()?.toLowerCase() ?? ''] ?? fallback;
}
function lineCount(content: string) {
  return content.split('\n').length;
}

interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}
interface FileNode {
  type: 'file';
  file: VirtualFile;
}
type TreeNode = FolderNode | FileNode;

function buildTree(files: VirtualFile[]): TreeNode[] {
  const root: FolderNode = { type: 'folder', name: '', path: '', children: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      let child = node.children.find((c): c is FolderNode => c.type === 'folder' && c.name === part);
      if (!child) {
        child = { type: 'folder', name: part, path: parts.slice(0, i + 1).join('/'), children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ type: 'file', file });
  }
  return root.children;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (f: VirtualFile) => void;
  onLongPress: (f: VirtualFile) => void;
  openFolders: Record<string, boolean>;
  toggleFolder: (path: string) => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}

function TreeItem({ node, depth, selectedPath, onSelect, onLongPress, openFolders, toggleFolder, colors }: TreeItemProps) {
  if (node.type === 'folder') {
    const open = openFolders[node.path] !== false;
    return (
      <View>
        <TouchableOpacity
          style={[styles.treeRow, { paddingLeft: 8 + depth * 12 }]}
          onPress={() => toggleFolder(node.path)}
        >
          <Feather name={open ? 'chevron-down' : 'chevron-right'} size={11} color={colors.mutedForeground} />
          <Feather name="folder" size={13} color="#f0c674" style={{ marginLeft: 2 }} />
          <Text style={[styles.treeName, { color: '#c9d1d9' }]} numberOfLines={1}>{node.name}</Text>
        </TouchableOpacity>
        {open && node.children.map((child, i) => (
          <TreeItem key={i} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} onLongPress={onLongPress} openFolders={openFolders} toggleFolder={toggleFolder} colors={colors} />
        ))}
      </View>
    );
  }
  const { file } = node;
  const selected = selectedPath === file.path;
  const fileColor = getFileColor(file.name, '#8b949e');
  return (
    <TouchableOpacity
      style={[styles.treeRow, { paddingLeft: 8 + depth * 12, backgroundColor: selected ? '#7c6ef020' : 'transparent' }]}
      onPress={() => onSelect(file)}
      onLongPress={() => onLongPress(file)}
      delayLongPress={500}
    >
      <Feather name={getIcon(file.name)} size={12} color={selected ? colors.primary : fileColor} />
      <Text style={[styles.treeName, { color: selected ? colors.primary : '#c9d1d9', fontWeight: selected ? '600' : '400' }]} numberOfLines={1}>
        {file.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function CodeHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chat, isConfigured, githubConfig } = useAI();

  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [openTabs, setOpenTabs] = useState<VirtualFile[]>([]);
  const [activeTab, setActiveTab] = useState<VirtualFile | null>(null);
  const [, setEditContent] = useState('');
  const [projectName, setProjectName] = useState('meu-projeto');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghStatus, setGhStatus] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingContent, setEditingContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState<Array<{ type: 'cmd' | 'out' | 'err'; text: string }>>([
    { type: 'out', text: '╔══════════════════════════════════════╗' },
    { type: 'out', text: '║     SK Code Terminal  v2.0           ║' },
    { type: 'out', text: '╚══════════════════════════════════════╝' },
    { type: 'out', text: 'Digite "help" para ver os comandos disponíveis' },
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [, setTerminalHistory] = useState<string[]>([]);
  const [, setHistoryIdx] = useState(-1);
  const terminalScrollRef = useRef<ScrollView>(null);
  const terminalInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  const [savedProjects, setSavedProjects] = useState<Array<{ name: string; fileCount: number; date: string }>>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectsTab, setProjectsTab] = useState<'tudo' | 'recente' | 'criar'>('tudo');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('@sk_saved_projects').then((v) => {
      if (v) setSavedProjects(JSON.parse(v));
    }).catch(() => {});
  }, []);

  const saveProjectToList = useCallback((name: string, count: number) => {
    setSavedProjects((prev) => {
      const filtered = prev.filter((p) => p.name !== name);
      const next = [{ name, fileCount: count, date: new Date().toLocaleDateString('pt-BR') }, ...filtered].slice(0, 20);
      AsyncStorage.setItem('@sk_saved_projects', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const tree = useMemo(() => buildTree(files), [files]);

  const toggleFolder = useCallback((path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: prev[path] === false }));
  }, []);

  const execTerminal = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setTerminalLines((prev) => [...prev, { type: 'cmd', text: `$ ${trimmed}` }]);
    setTerminalHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setTerminalInput('');
    const args = trimmed.split(/\s+/);
    const command = args[0]?.toLowerCase() ?? '';

    const out = (text: string) => setTerminalLines((prev) => [...prev, { type: 'out', text }]);
    const err = (text: string) => setTerminalLines((prev) => [...prev, { type: 'err', text }]);

    setTimeout(() => {
      switch (command) {
        case 'help':
          out('');
          out('  ══════════════════════════════════════════');
          out('   SK Code Terminal — Comandos');
          out('  ══════════════════════════════════════════');
          out('');
          out('  ── Projeto (local) ───────────────────────');
          out('  ls              lista arquivos do projeto');
          out('  cat <arquivo>   exibe conteúdo de um arquivo');
          out('  head <arquivo>  primeiras 20 linhas');
          out('  wc <arquivo>    conta linhas, palavras e chars');
          out('  find <termo>    busca texto nos arquivos');
          out('  grep <texto>    busca em todos os arquivos');
          out('  stat            info geral do projeto');
          out('  tree            árvore de pastas/arquivos');
          out('  mv <a> <b>      renomeia arquivo');
          out('  rm <arquivo>    remove arquivo');
          out('  touch <nome>    cria arquivo vazio');
          out('  echo <texto>    imprime texto');
          out('  pwd             diretório atual');
          out('  whoami          usuário atual');
          out('  clear           limpa o terminal');
          out('');
          out('  ── Servidor real (execução remota) ───────');
          out('  npm install     instala pacotes Node.js');
          out('  npm run <cmd>   executa script do package.json');
          out('  node <arquivo>  executa arquivo JavaScript');
          out('  npx <pacote>    executa pacote sem instalar');
          out('  git status      status do repositório');
          out('  git log         histórico de commits');
          out('  python <arq>    executa Python');
          out('  pip install     instala pacotes Python');
          out('  <qualquer cmd>  executa no servidor Linux');
          out('');
          break;
        case 'ls':
        case 'dir':
          if (files.length === 0) { out('Nenhum arquivo. Importe um ZIP ou baixe do GitHub.'); break; }
          out(`\n  ${projectName}/`);
          files.forEach((f) => out(`    ${f.path.padEnd(40)}  ${f.content.length} chars`));
          out(`\n  Total: ${files.length} arquivo(s)`);
          break;
        case 'tree': {
          if (files.length === 0) { out('Nenhum arquivo.'); break; }
          out(`\n  ${projectName}/`);
          const printTree = (nodes: TreeNode[], prefix = '  ') => {
            nodes.forEach((node, i) => {
              const isLast = i === nodes.length - 1;
              const connector = isLast ? '└── ' : '├── ';
              if (node.type === 'folder') {
                out(`${prefix}${connector}${node.name}/`);
                printTree(node.children, prefix + (isLast ? '    ' : '│   '));
              } else {
                out(`${prefix}${connector}${node.file.name}`);
              }
            });
          };
          printTree(tree);
          out('');
          break;
        }
        case 'cat': {
          const target = args[1];
          if (!target) { err('Uso: cat <nome-do-arquivo>'); break; }
          const file = files.find((f) => f.path.includes(target) || f.name === target);
          if (!file) { err(`Arquivo não encontrado: ${target}`); break; }
          out(`\n  ── ${file.path} ──`);
          file.content.split('\n').slice(0, 100).forEach((line, i) => out(`  ${String(i + 1).padStart(4, ' ')}  ${line}`));
          if (file.content.split('\n').length > 100) out('  ... (truncado em 100 linhas)');
          out('');
          break;
        }
        case 'head': {
          const target = args[1];
          if (!target) { err('Uso: head <nome-do-arquivo>'); break; }
          const file = files.find((f) => f.path.includes(target) || f.name === target);
          if (!file) { err(`Arquivo não encontrado: ${target}`); break; }
          out('');
          file.content.split('\n').slice(0, 20).forEach((line, i) => out(`  ${String(i + 1).padStart(4, ' ')}  ${line}`));
          out('');
          break;
        }
        case 'wc': {
          const target = args[1];
          if (!target) { err('Uso: wc <nome-do-arquivo>'); break; }
          const file = files.find((f) => f.path.includes(target) || f.name === target);
          if (!file) { err(`Arquivo não encontrado: ${target}`); break; }
          const lines = file.content.split('\n').length;
          const words = file.content.split(/\s+/).filter(Boolean).length;
          out(`\n  Linhas: ${lines}  |  Palavras: ${words}  |  Chars: ${file.content.length}`);
          out(`  Arquivo: ${file.path}\n`);
          break;
        }
        case 'find':
        case 'grep': {
          const term = args.slice(1).join(' ');
          if (!term) { err('Uso: grep <termo>'); break; }
          let found = 0;
          out('');
          files.forEach((f) => {
            f.content.split('\n').forEach((line, i) => {
              if (line.toLowerCase().includes(term.toLowerCase())) {
                out(`  ${f.path}:${i + 1}  ${line.trim()}`);
                found++;
              }
            });
          });
          out(found > 0 ? `\n  ${found} ocorrência(s) encontrada(s)\n` : `\n  Nenhuma ocorrência de "${term}"\n`);
          break;
        }
        case 'stat': {
          const totalChars = files.reduce((s, f) => s + f.content.length, 0);
          const totalLines = files.reduce((s, f) => s + f.content.split('\n').length, 0);
          out('');
          out(`  Projeto : ${projectName}`);
          out(`  Arquivos: ${files.length}`);
          out(`  Linhas  : ${totalLines.toLocaleString()}`);
          out(`  Tamanho : ${(totalChars / 1024).toFixed(2)} KB`);
          if (files.length > 0) {
            out('');
            const exts = files.reduce((acc: Record<string, number>, f) => {
              const ext = f.name.split('.').pop() ?? '?';
              acc[ext] = (acc[ext] ?? 0) + 1;
              return acc;
            }, {});
            Object.entries(exts).forEach(([ext, count]) => out(`  .${ext.padEnd(8)} ${count} arquivo(s)`));
          }
          out('');
          break;
        }
        case 'touch': {
          const name = args[1];
          if (!name) { err('Uso: touch <nome>'); break; }
          if (files.find((f) => f.path === name)) { err(`Arquivo já existe: ${name}`); break; }
          const newFile: VirtualFile = { name: name.split('/').pop() ?? name, path: name, content: '' };
          setFiles((prev) => [...prev, newFile]);
          out(`  Arquivo criado: ${name}`);
          break;
        }
        case 'mv': {
          const from = args[1];
          const to = args[2];
          if (!from || !to) { err('Uso: mv <origem> <destino>'); break; }
          const f = files.find((f) => f.path === from || f.name === from);
          if (!f) { err(`Não encontrado: ${from}`); break; }
          setFiles((prev) => prev.map((x) => x.path === f.path ? { ...x, name: to.split('/').pop() ?? to, path: to } : x));
          out(`  Renomeado: ${from} → ${to}`);
          break;
        }
        case 'rm': {
          const name = args[1];
          if (!name) { err('Uso: rm <arquivo>'); break; }
          const f = files.find((x) => x.path === name || x.name === name);
          if (!f) { err(`Não encontrado: ${name}`); break; }
          setFiles((prev) => prev.filter((x) => x.path !== f.path));
          out(`  Removido: ${f.path}`);
          break;
        }
        case 'clear':
          setTerminalLines([{ type: 'out', text: 'Terminal limpo. Digite "help" para ajuda.' }]);
          break;
        case 'pwd':
          out(`  /${projectName}`);
          break;
        case 'whoami':
          out('  sk-code-user');
          break;
        case 'echo':
          out(`  ${args.slice(1).join(' ')}`);
          break;
        default: {
          const apiBase = process.env.EXPO_PUBLIC_DOMAIN
            ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
            : 'http://localhost:8080';
          out(`  ⟳ Executando no servidor...`);
          setTimeout(() => terminalScrollRef.current?.scrollToEnd({ animated: true }), 80);
          fetch(`${apiBase}/api/terminal/exec`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: trimmed, project: projectName || 'default' }),
          })
            .then((r) => r.json())
            .then((data: { stdout: string; stderr: string; exitCode: number; cwd?: string }) => {
              if (data.stdout) {
                data.stdout.split('\n').forEach((line) => {
                  if (line.trim()) out(`  ${line}`);
                });
              }
              if (data.stderr) {
                data.stderr.split('\n').forEach((line) => {
                  if (line.trim()) err(`  ${line}`);
                });
              }
              if (data.exitCode === 0) {
                out(`  ✓ Concluído (exit 0)`);
              } else {
                err(`  ✗ Exit code: ${data.exitCode}`);
              }
              setTimeout(() => terminalScrollRef.current?.scrollToEnd({ animated: true }), 100);
            })
            .catch((e: unknown) => {
              err(`  Erro de conexão: ${e instanceof Error ? e.message : 'Servidor indisponível'}`);
              setTimeout(() => terminalScrollRef.current?.scrollToEnd({ animated: true }), 100);
            });
          break;
        }
      }
      setTimeout(() => terminalScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 60);
  }, [files, projectName, tree]);

  const openTab = useCallback((file: VirtualFile) => {
    setActiveTab(file);
    setEditContent(file.content);
    setIsEditing(false);
    setOpenTabs((prev) => {
      if (prev.find((t) => t.path === file.path)) return prev;
      return [...prev, file];
    });
  }, []);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (activeTab?.path === path) {
        setActiveTab(next[next.length - 1] ?? null);
        setEditContent(next[next.length - 1]?.content ?? '');
        setIsEditing(false);
      }
      return next;
    });
  }, [activeTab]);

  const saveEdit = useCallback(() => {
    if (!activeTab) return;
    const updated = files.map((f) => f.path === activeTab.path ? { ...f, content: editingContent } : f);
    setFiles(updated);
    const updatedFile = { ...activeTab, content: editingContent };
    setActiveTab(updatedFile);
    setEditContent(editingContent);
    setOpenTabs((prev) => prev.map((t) => t.path === activeTab.path ? updatedFile : t));
    setIsEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeTab, editingContent, files]);

  const startEdit = useCallback(() => {
    setEditingContent(activeTab?.content ?? '');
    setIsEditing(true);
  }, [activeTab]);

  const generatePlan = useCallback(() => {
    if (files.length === 0) {
      Alert.alert('Gerar Plano', 'Importe um projeto primeiro.');
      return;
    }
    const now = new Date().toLocaleString('pt-BR');
    const totalChars = files.reduce((s, f) => s + f.content.length, 0);
    const totalLines = files.reduce((s, f) => s + f.content.split('\n').length, 0);
    const exts = files.reduce((acc: Record<string, number>, f) => {
      const ext = f.name.split('.').pop() ?? '?';
      acc[ext] = (acc[ext] ?? 0) + 1;
      return acc;
    }, {});
    const buildTreeText = (nodes: TreeNode[], prefix = '') => {
      let result = '';
      nodes.forEach((node, i) => {
        const isLast = i === nodes.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        if (node.type === 'folder') {
          result += `${prefix}${connector}${node.name}/\n`;
          result += buildTreeText(node.children, childPrefix);
        } else {
          result += `${prefix}${connector}${node.file.name}\n`;
        }
      });
      return result;
    };
    const stackInfo = Object.entries(exts)
      .map(([ext, count]) => `${LANG_MAP[ext] ?? ext.toUpperCase()}: ${count} arquivo(s)`)
      .join('\n- ');
    const plan = [
      `# PLANO DO PROJETO: ${projectName}`,
      ``,
      `> Gerado pelo SK Code Mobile em ${now}`,
      `> **${files.length} arquivo(s)** | **~${totalLines.toLocaleString()} linhas** | **${(totalChars / 1024).toFixed(1)} KB**`,
      ``,
      `---`,
      ``,
      `## ESTRUTURA DE ARQUIVOS`,
      ``,
      `\`\`\``,
      `${projectName}/`,
      buildTreeText(tree),
      `\`\`\``,
      ``,
      `---`,
      ``,
      `## TECNOLOGIAS DETECTADAS`,
      ``,
      `- ${stackInfo}`,
      ``,
      `---`,
      ``,
      `## ARQUIVOS DO PROJETO`,
      ``,
      ...files.map((f) => [
        `### ${f.path}`,
        `- Linhas: ${f.content.split('\n').length}`,
        `- Tamanho: ${(f.content.length / 1024).toFixed(1)} KB`,
        ``,
      ].join('\n')),
    ].join('\n');
    const planFile: VirtualFile = { name: 'PLANO.md', path: 'PLANO.md', content: plan };
    setFiles((prev) => {
      const exists = prev.findIndex((f) => f.path === 'PLANO.md');
      if (exists >= 0) return prev.map((f) => f.path === 'PLANO.md' ? planFile : f);
      return [...prev, planFile];
    });
    openTab(planFile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Plano Gerado', 'PLANO.md criado com a estrutura completa do projeto.');
  }, [files, projectName, tree, openTab]);

  const promptNewFile = () => {
    Alert.prompt(
      'Novo Arquivo',
      'Nome do arquivo (ex: app.ts, index.html)',
      (name) => {
        if (!name?.trim()) return;
        const trimmed = name.trim();
        const newFile: VirtualFile = { name: trimmed.split('/').pop() ?? trimmed, path: trimmed, content: '' };
        setFiles((prev) => [...prev, newFile]);
        openTab(newFile);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      'plain-text',
      '',
    );
  };

  const promptNewFileAndroid = () => {
    if (Platform.OS === 'ios') {
      promptNewFile();
      return;
    }
    Alert.alert('Novo Arquivo', 'Um arquivo vazio será criado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Criar',
        onPress: () => {
          const name = `arquivo_${Date.now()}.ts`;
          const newFile: VirtualFile = { name, path: name, content: '' };
          setFiles((prev) => [...prev, newFile]);
          openTab(newFile);
        },
      },
    ]);
  };

  const fileContextMenu = (file: VirtualFile) => {
    Alert.alert(file.name, 'O que deseja fazer?', [
      {
        text: 'Renomear',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Alert.prompt('Renomear', 'Novo nome:', (name) => {
              if (!name?.trim()) return;
              const updated = files.map((f) =>
                f.path === file.path ? { ...f, name: name.trim(), path: name.trim() } : f,
              );
              setFiles(updated);
              if (activeTab?.path === file.path) {
                const upd = { ...file, name: name.trim(), path: name.trim() };
                setActiveTab(upd);
                setOpenTabs((prev) => prev.map((t) => (t.path === file.path ? upd : t)));
              }
            }, 'plain-text', file.name);
          } else {
            Alert.alert('Renomear', 'Use a versão iOS ou edite via terminal (mv).');
          }
        },
      },
      {
        text: 'Duplicar',
        onPress: () => {
          const parts = file.name.split('.');
          const ext = parts.length > 1 ? '.' + parts.pop() : '';
          const newName = `${parts.join('.')}_copia${ext}`;
          const copy: VirtualFile = { ...file, name: newName, path: newName };
          setFiles((prev) => [...prev, copy]);
          openTab(copy);
        },
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Excluir', `Excluir "${file.name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: () => {
                setFiles((prev) => prev.filter((f) => f.path !== file.path));
                closeTab(file.path);
              },
            },
          ]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleImportZip = async () => {
    const imported = await importZip();
    if (imported.length > 0) {
      setFiles(imported);
      setOpenTabs([]);
      setActiveTab(null);
      if (imported[0]) openTab(imported[0]);
      saveProjectToList(projectName, imported.length);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCreateNewProject = () => {
    const name = newProjectName.trim() || 'novo-projeto';
    const initial: VirtualFile = { name: 'index.js', path: 'index.js', content: '// ' + name + '\nconsole.log("Olá, mundo!");\n' };
    setProjectName(name);
    setFiles([initial]);
    setOpenTabs([initial]);
    setActiveTab(initial);
    setIsEditing(false);
    setShowNewProject(false);
    setNewProjectName('');
    saveProjectToList(name, 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleExportZip = async () => {
    if (files.length === 0) return;
    await exportZip(files, projectName);
  };

  const githubPull = async () => {
    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
      Alert.alert('GitHub', 'Configure o token, owner e repositório em Configurações.');
      return;
    }
    setGhLoading(true);
    setGhStatus('Baixando repositório...');
    try {
      const pulled = await githubPullRepo(githubConfig);
      setFiles(pulled);
      setProjectName(githubConfig.repo);
      setOpenTabs([]);
      setActiveTab(null);
      if (pulled[0]) openTab(pulled[0]);
      setGhStatus(`✓ ${pulled.length} arquivo(s) baixados`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setGhStatus(`✗ ${e instanceof Error ? e.message : 'Falhou'}`);
    } finally {
      setGhLoading(false);
      setTimeout(() => setGhStatus(''), 4000);
    }
  };

  const githubPush = async () => {
    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
      Alert.alert('GitHub', 'Configure o token, owner e repositório em Configurações.');
      return;
    }
    if (files.length === 0) { Alert.alert('GitHub', 'Nenhum arquivo para enviar.'); return; }
    Alert.alert('Enviar para GitHub', `Enviar ${files.length} arquivo(s) para ${githubConfig.owner}/${githubConfig.repo}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar',
        onPress: async () => {
          setGhLoading(true);
          setGhStatus('Enviando para GitHub...');
          try {
            for (let i = 0; i < files.length; i++) {
              setGhStatus(`Enviando ${i + 1}/${files.length}...`);
              await githubPushFile(githubConfig, files[i]!.path, files[i]!.content);
            }
            setGhStatus(`✓ ${files.length} arquivo(s) enviados`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: unknown) {
            setGhStatus(`✗ ${e instanceof Error ? e.message : 'Falhou'}`);
          } finally {
            setGhLoading(false);
            setTimeout(() => setGhStatus(''), 4000);
          }
        },
      },
    ]);
  };

  const sendChat = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    const context = activeTab
      ? `Arquivo: ${activeTab.path}\n\`\`\`\n${activeTab.content.slice(0, 3000)}\n\`\`\`\n\n`
      : files.length > 0
      ? `Projeto: ${projectName}\nArquivos: ${files.map((f) => f.path).slice(0, 20).join(', ')}\n\n`
      : '';
    const userMsg: Message = { role: 'user', content: context + content };
    const displayMsg: Message = { role: 'user', content };
    setMessages((prev) => [...prev, displayMsg]);
    setLoading(true);
    try {
      const reply = await chat([...messages, userMsg], CODE_SYSTEM);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Erro: ${e instanceof Error ? e.message : 'Falhou'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const filteredProjects = savedProjects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()),
  );

  if (files.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: '#0d1117' }]}>
        {/* ── Header ── */}
        <View style={[phStyles.header, { paddingTop: topPad }]}>
          <View style={phStyles.logoRow}>
            <View style={phStyles.logoBadge}>
              <Text style={phStyles.logoText}>&lt;/&gt;</Text>
            </View>
            <Text style={phStyles.headerTitle}>Projetos</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={[phStyles.pill, { borderColor: '#e3b341' }]}>
              <Feather name="briefcase" size={11} color="#e3b341" />
              <Text style={[phStyles.pillText, { color: '#e3b341' }]}>Jurídico</Text>
            </View>
            <View style={[phStyles.pill, { borderColor: '#3fb950' }]}>
              <Feather name="message-circle" size={11} color="#3fb950" />
              <Text style={[phStyles.pillText, { color: '#3fb950' }]}>Chat Livre</Text>
            </View>
            <TouchableOpacity>
              <Feather name="settings" size={18} color="#8b949e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Busca ── */}
        <View style={phStyles.searchRow}>
          <Feather name="search" size={14} color="#484f58" />
          <TextInput
            style={phStyles.searchInput}
            value={projectSearch}
            onChangeText={setProjectSearch}
            placeholder="Procurar Nome do Projeto"
            placeholderTextColor="#484f58"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {projectSearch.length > 0 && (
            <TouchableOpacity onPress={() => setProjectSearch('')}>
              <Feather name="x" size={14} color="#484f58" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={phStyles.tabs}>
          {(['tudo', 'recente', 'criar'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[phStyles.tabItem, projectsTab === t && phStyles.tabItemActive]}
              onPress={() => setProjectsTab(t)}
            >
              <Text style={[phStyles.tabText, projectsTab === t && phStyles.tabTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Ações rápidas ── */}
        {(projectsTab === 'tudo' || projectsTab === 'criar') && (
          <View style={phStyles.actionCards}>
            <TouchableOpacity style={[phStyles.actionCard, { borderColor: '#e3b341', backgroundColor: '#e3b34110' }]} onPress={handleImportZip}>
              <Feather name="upload" size={20} color="#e3b341" />
              <View>
                <Text style={[phStyles.actionCardTitle, { color: '#e3b341' }]}>Importar ZIP</Text>
                <Text style={phStyles.actionCardSub}>Abrir arquivo .zip</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[phStyles.actionCard, { borderColor: '#3fb950', backgroundColor: '#3fb95010' }]} onPress={() => setShowNewProject(true)}>
              <Feather name="plus-square" size={20} color="#3fb950" />
              <View>
                <Text style={[phStyles.actionCardTitle, { color: '#3fb950' }]}>Novo Projeto</Text>
                <Text style={phStyles.actionCardSub}>Criar ou clonar</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Lista de projetos ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: bottomPad + 20 }}>
          {filteredProjects.length === 0 ? (
            <View style={phStyles.empty}>
              <Feather name="folder" size={48} color="#21262d" />
              <Text style={phStyles.emptyTitle}>Nenhum projeto ainda</Text>
              <Text style={phStyles.emptySub}>Importe um ZIP ou crie um novo projeto acima</Text>
              <TouchableOpacity style={phStyles.emptyBtn} onPress={handleImportZip}>
                <Text style={phStyles.emptyBtnText}>Criar Projeto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredProjects.map((p, i) => (
              <TouchableOpacity key={i} style={phStyles.projectCard} onPress={handleImportZip}>
                <View style={phStyles.projectCardIcon}>
                  <Feather name="folder" size={20} color="#f0c674" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={phStyles.projectCardName}>{p.name}</Text>
                  <Text style={phStyles.projectCardMeta}>{p.fileCount} arquivos · {p.date}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#484f58" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* ── Modal novo projeto ── */}
        <Modal visible={showNewProject} transparent animationType="fade">
          <TouchableOpacity style={phStyles.modalOverlay} activeOpacity={1} onPress={() => setShowNewProject(false)}>
            <TouchableOpacity activeOpacity={1} style={phStyles.modalCard}>
              <Text style={phStyles.modalTitle}>Novo Projeto</Text>
              <TextInput
                style={phStyles.modalInput}
                value={newProjectName}
                onChangeText={setNewProjectName}
                placeholder="nome-do-projeto"
                placeholderTextColor="#484f58"
                autoCapitalize="none"
                autoFocus
                onSubmitEditing={handleCreateNewProject}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[phStyles.modalBtn, { backgroundColor: '#21262d', flex: 1 }]} onPress={() => setShowNewProject(false)}>
                  <Text style={{ color: '#8b949e', fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[phStyles.modalBtn, { backgroundColor: '#3fb950', flex: 1 }]} onPress={handleCreateNewProject}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Criar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Status bar SK Code */}
        <View style={[phStyles.statusBar, { paddingBottom: bottomPad + 4 }]}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#3fb950' }} />
          <Text style={phStyles.statusText}>SK Code v2.0  Ready</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#0d1117' }]}>

      {/* ── Barra de título estilo IDE ── */}
      <View style={[styles.titleBar, { paddingTop: topPad }]}>
        <TouchableOpacity
          onPress={() => { setFiles([]); setOpenTabs([]); setActiveTab(null); }}
          style={[styles.sidebarToggle, { marginRight: 2 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="home" size={15} color='#8b949e' />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSidebarOpen((v) => !v)} style={styles.sidebarToggle}>
          <Feather name={sidebarOpen ? 'sidebar' : 'menu'} size={16} color='#8b949e' />
        </TouchableOpacity>

        <View style={styles.titleBrand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>SK Code</Text>
          <Text style={styles.brandVersion}>v2</Text>
        </View>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          {activeTab ? (
            <Text style={styles.titleFile} numberOfLines={1}>
              {activeTab.path}
            </Text>
          ) : (
            <Text style={styles.titleProject} numberOfLines={1}>{projectName}</Text>
          )}
        </View>

        <View style={styles.titleActions}>
          <ActionBtn icon="upload" label="ZIP" onPress={handleImportZip} />
          <ActionBtn icon="download" label="EXP" onPress={handleExportZip} disabled={files.length === 0} />
          <ActionBtn icon="git-pull-request" label="PULL" onPress={githubPull} loading={ghLoading} />
          <ActionBtn icon="upload-cloud" label="PUSH" onPress={githubPush} disabled={ghLoading || files.length === 0} accent />
        </View>
      </View>

      {ghStatus !== '' && (
        <View style={[styles.statusNotice, { backgroundColor: ghStatus.startsWith('✓') ? '#1a2e1a' : ghStatus.startsWith('✗') ? '#2e1a1a' : '#1a1f2e' }]}>
          <Text style={{ fontSize: 12, color: ghStatus.startsWith('✓') ? '#3fb950' : ghStatus.startsWith('✗') ? '#f85149' : '#79c0ff', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {ghStatus}
          </Text>
        </View>
      )}

      {!isConfigured && (
        <View style={styles.alertBar}>
          <Feather name="alert-triangle" size={12} color="#e3b341" />
          <Text style={styles.alertText}>Nenhuma chave de API configurada — vá em Configurações</Text>
        </View>
      )}

      {/* ── Abas abertas ── */}
      {openTabs.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {openTabs.map((tab) => {
            const active = activeTab?.path === tab.path;
            const fc = getFileColor(tab.name, '#8b949e');
            return (
              <TouchableOpacity
                key={tab.path}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => {
                  setActiveTab(tab);
                  setEditContent(tab.content);
                  setIsEditing(false);
                }}
              >
                <Feather name={getIcon(tab.name)} size={11} color={active ? fc : '#484f58'} />
                <Text style={[styles.tabName, { color: active ? '#e6edf3' : '#8b949e' }]}>
                  {tab.name}
                </Text>
                <Pressable
                  onPress={() => closeTab(tab.path)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Feather name="x" size={10} color={active ? '#8b949e' : '#30363d'} />
                </Pressable>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Corpo ── */}
      <View style={styles.body}>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <View style={styles.sidebar}>
            {/* Cabeçalho sidebar */}
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>EXPLORER</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {files.length > 0 && (
                  <TouchableOpacity onPress={generatePlan} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Feather name="file-text" size={14} color="#7952b3" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={promptNewFileAndroid} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Feather name="plus" size={14} color='#3fb950' />
                </TouchableOpacity>
              </View>
            </View>

            {files.length === 0 ? (
              <View style={styles.sidebarEmpty}>
                <Feather name="folder" size={26} color="#21262d" />
                <Text style={styles.sidebarEmptyText}>Importe um ZIP{'\n'}ou baixe do GitHub</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                <View style={styles.projectRow}>
                  <Feather name="folder" size={12} color="#f0c674" />
                  <Text style={styles.projectLabel} numberOfLines={1}>{projectName}</Text>
                </View>
                {tree.map((node, i) => (
                  <TreeItem
                    key={i}
                    node={node}
                    depth={0}
                    selectedPath={activeTab?.path ?? null}
                    onSelect={openTab}
                    onLongPress={fileContextMenu}
                    openFolders={openFolders}
                    toggleFolder={toggleFolder}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Editor ── */}
        <View style={styles.editorCol}>
          <View style={{ flex: 1 }}>
            {activeTab ? (
              isEditing ? (
                <View style={{ flex: 1 }}>
                  <View style={styles.editorToolbar}>
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.toolbarBtnSmall}>
                      <Text style={{ fontSize: 11, color: '#8b949e' }}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={styles.toolbarFileName} numberOfLines={1}>✏ {activeTab.name}</Text>
                    <TouchableOpacity onPress={saveEdit} style={[styles.toolbarBtnSmall, { backgroundColor: '#7c6ef0' }]}>
                      <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Salvar</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.codeInput}
                    value={editingContent}
                    onChangeText={setEditingContent}
                    multiline
                    scrollEnabled
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    textAlignVertical="top"
                    selectionColor="#7c6ef0"
                  />
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <View style={styles.editorToolbar}>
                    <Feather name={getIcon(activeTab.name)} size={12} color={getFileColor(activeTab.name, '#8b949e')} />
                    <Text style={styles.toolbarFileName} numberOfLines={1}>{activeTab.path}</Text>
                    {['html', 'htm', 'svg'].includes(activeTab.name.split('.').pop()?.toLowerCase() ?? '') && (
                      <TouchableOpacity onPress={() => setShowPreview(true)} style={[styles.toolbarBtnSmall, { backgroundColor: '#1a2e1a', borderWidth: 1, borderColor: '#2d4a2d' }]}>
                        <Feather name="eye" size={11} color='#3fb950' />
                        <Text style={{ fontSize: 11, color: '#3fb950', marginLeft: 4 }}>Preview</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={startEdit} style={[styles.toolbarBtnSmall, { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' }]}>
                      <Feather name="edit-2" size={11} color='#79c0ff' />
                      <Text style={{ fontSize: 11, color: '#79c0ff', marginLeft: 4 }}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ flex: 1 }}>
                    <View style={styles.codeWithLines}>
                      {activeTab.content.split('\n').map((line, i) => (
                        <View key={i} style={styles.codeLine}>
                          <Text style={styles.lineNum}>{(i + 1).toString().padStart(3, ' ')}</Text>
                          <Text style={styles.lineCode}>{line}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )
            ) : (
              <View style={styles.welcome}>
                <View style={styles.welcomeIcon}>
                  <Feather name="code" size={32} color='#7c6ef0' />
                </View>
                <Text style={styles.welcomeTitle}>SK Code Hub</Text>
                <Text style={styles.welcomeSub}>IDE portátil com IA integrada</Text>
                <View style={styles.welcomeBtns}>
                  <TouchableOpacity style={styles.welcomeBtnPrimary} onPress={handleImportZip}>
                    <Feather name="upload" size={14} color="#fff" />
                    <Text style={styles.welcomeBtnText}>Importar ZIP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.welcomeBtnSecondary} onPress={githubPull}>
                    <Feather name="github" size={14} color='#e6edf3' />
                    <Text style={[styles.welcomeBtnText, { color: '#e6edf3' }]}>GitHub</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.welcomeStats}>
                  <WelcomeStat icon="cpu" label="IA Multi-Provedor" color="#7c6ef0" />
                  <WelcomeStat icon="git-branch" label="GitHub Integrado" color="#3fb950" />
                  <WelcomeStat icon="terminal" label="Terminal Embutido" color="#58a6ff" />
                  <WelcomeStat icon="file-text" label="Gerar Plano.md" color="#e3b341" />
                </View>
              </View>
            )}
          </View>

        </View>
      </View>

      {/* ── FAB Terminal (canto inferior esquerdo) ── */}
      <TouchableOpacity
        style={[styles.termFab, { bottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 16 }]}
        onPress={() => {
          setTerminalOpen(true);
          setTimeout(() => terminalInputRef.current?.focus(), 300);
        }}
      >
        <Feather name="terminal" size={16} color="#58a6ff" />
      </TouchableOpacity>

      {/* ── Modal Preview (tela cheia) ── */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: '#0d1117' }}>
          <View style={[styles.termModalHeader, { paddingTop: Platform.OS === 'web' ? 20 : insets.top + 8 }]}>
            <Feather name="eye" size={14} color="#3fb950" />
            <Text style={[styles.termModalTitle, { color: '#3fb950' }]}>
              Preview — {activeTab?.name}
            </Text>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.termAction}>
              <Feather name="x" size={18} color="#8b949e" />
            </TouchableOpacity>
          </View>
          {activeTab && Platform.OS === 'web' ? (
            <iframe
              srcDoc={activeTab.content}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%', backgroundColor: '#fff' }}
              title="preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={{ color: '#8b949e', fontSize: 13, lineHeight: 22, fontFamily: MONO }}>
                {activeTab?.content ?? ''}
              </Text>
              <View style={{ height: 60 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Modal Terminal (tela cheia) ── */}
      <Modal visible={terminalOpen} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.termModal}>
          {/* Header */}
          <View style={[styles.termModalHeader, { paddingTop: Platform.OS === 'web' ? 20 : insets.top + 8 }]}>
            <View style={styles.termDots}>
              <View style={[styles.termDot, { backgroundColor: '#ff5f57' }]} />
              <View style={[styles.termDot, { backgroundColor: '#febc2e' }]} />
              <View style={[styles.termDot, { backgroundColor: '#28c840' }]} />
            </View>
            <Text style={styles.termModalTitle}>Terminal — {projectName}</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity
                onPress={() => setTerminalLines([
                  { type: 'out', text: '╔══════════════════════════════════════╗' },
                  { type: 'out', text: '║     SK Code Terminal  v2.0           ║' },
                  { type: 'out', text: '╚══════════════════════════════════════╝' },
                  { type: 'out', text: 'Terminal limpo. Digite "help" para ajuda.' },
                ])}
                style={styles.termAction}
              >
                <Feather name="trash-2" size={15} color="#8b949e" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTerminalOpen(false)} style={styles.termAction}>
                <Feather name="x" size={18} color="#8b949e" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Saída */}
          <ScrollView
            ref={terminalScrollRef}
            style={styles.termOutput}
            contentContainerStyle={{ padding: 14, paddingBottom: 4 }}
            onContentSizeChange={() => terminalScrollRef.current?.scrollToEnd({ animated: false })}
          >
            {terminalLines.map((line, i) => (
              <Text
                key={i}
                selectable
                style={[
                  styles.termLine,
                  line.type === 'cmd' ? { color: '#58a6ff' } :
                  line.type === 'err' ? { color: '#f85149' } :
                  { color: '#c9d1d9' },
                ]}
              >{line.text}</Text>
            ))}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Entrada */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.termInputBar, { paddingBottom: Platform.OS === 'web' ? 16 : insets.bottom + 10 }]}>
              <Text style={styles.termPrompt}>{projectName}$</Text>
              <TextInput
                ref={terminalInputRef}
                style={styles.termInput}
                value={terminalInput}
                onChangeText={setTerminalInput}
                placeholder="comando..."
                placeholderTextColor="#484f58"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="send"
                onSubmitEditing={() => {
                  execTerminal(terminalInput);
                  setTimeout(() => terminalInputRef.current?.focus(), 100);
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  execTerminal(terminalInput);
                  setTimeout(() => terminalInputRef.current?.focus(), 100);
                }}
                style={[styles.termRunBtn, { opacity: terminalInput.trim() ? 1 : 0.4 }]}
                disabled={!terminalInput.trim()}
              >
                <Feather name="play" size={15} color="#3fb950" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Status bar inferior ── */}
      <View style={[styles.statusBar, { paddingBottom: Platform.OS === 'web' ? 4 : 0 }]}>
        {activeTab ? (
          <>
            <View style={[styles.statusLang, { backgroundColor: getFileColor(activeTab.name, '#484f58') + '33' }]}>
              <Text style={[styles.statusLangText, { color: getFileColor(activeTab.name, '#8b949e') }]}>
                {getLang(activeTab.name)}
              </Text>
            </View>
            <Text style={styles.statusItem}>{lineCount(activeTab.content)} linhas</Text>
            <Text style={styles.statusSep}>·</Text>
            <Text style={styles.statusItem}>{activeTab.content.length} chars</Text>
            <Text style={styles.statusSep}>·</Text>
            <Text style={styles.statusItem}>UTF-8</Text>
          </>
        ) : (
          <>
            <View style={[styles.statusLang, { backgroundColor: '#7c6ef033' }]}>
              <Text style={[styles.statusLangText, { color: '#7c6ef0' }]}>SK Code</Text>
            </View>
            <Text style={styles.statusItem}>{files.length > 0 ? `${files.length} arquivo(s)` : 'Sem projeto'}</Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => setShowChat(true)} style={styles.statusAiBtn}>
          <Feather name="cpu" size={11} color="#7c6ef0" />
          <Text style={styles.statusAiText}>IA {messages.length > 0 ? `(${messages.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Modal Chat IA ── */}
      <Modal visible={showChat} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: '#0d1117' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)}>
              <Feather name="x" size={22} color="#e6edf3" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.modalTitle}>Assistente de Código</Text>
              {activeTab && <Text style={styles.modalSub}>{activeTab.name}</Text>}
            </View>
            <TouchableOpacity onPress={() => {
              const last = [...messages].reverse().find((m) => m.role === 'assistant');
              if (last) speak(last.content);
            }}>
              <Feather name="volume-2" size={20} color="#8b949e" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => <ChatMessage message={item} />}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.chatEmpty}>
                <Feather name="cpu" size={44} color="#21262d" />
                <Text style={styles.chatEmptyTitle}>Assistente de Código</Text>
                <Text style={styles.chatEmptyText}>
                  {activeTab
                    ? `Arquivo: ${activeTab.name}\nPergunte sobre o código, peça melhorias ou debug`
                    : 'Selecione um arquivo ou faça uma pergunta sobre programação'}
                </Text>
              </View>
            }
          />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
              <VoiceButton onTranscript={(t) => sendChat(t)} disabled={loading} />
              <TextInput
                style={styles.chatInput}
                value={input}
                onChangeText={setInput}
                placeholder="Pergunte sobre código..."
                placeholderTextColor="#484f58"
                multiline
                maxLength={2000}
                onSubmitEditing={() => sendChat()}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: loading || !input.trim() ? '#21262d' : '#7c6ef0' }]}
                onPress={() => sendChat()}
                disabled={loading || !input.trim()}
              >
                {loading ? <ActivityIndicator size="small" color="#7c6ef0" /> : <Feather name="send" size={17} color={!input.trim() ? '#484f58' : '#fff'} />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, disabled, loading, accent }: {
  icon: string; label: string; onPress: () => void;
  disabled?: boolean; loading?: boolean; accent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading
        ? <ActivityIndicator size="small" color="#79c0ff" />
        : <Feather name={icon as 'code'} size={13} color={accent ? '#3fb950' : '#79c0ff'} />
      }
      <Text style={[styles.actionBtnText, { color: accent ? '#3fb950' : '#8b949e' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function WelcomeStat({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.welcomeStatItem}>
      <View style={[styles.welcomeStatDot, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <Feather name={icon as 'code'} size={13} color={color} />
      </View>
      <Text style={styles.welcomeStatLabel}>{label}</Text>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  container: { flex: 1 },

  titleBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingBottom: 8,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  sidebarToggle: { padding: 4 },
  titleBrand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c6ef0' },
  brandText: { fontSize: 13, fontWeight: '700', color: '#e6edf3', letterSpacing: 0.5 },
  brandVersion: { fontSize: 10, color: '#484f58', fontFamily: MONO },
  titleFile: { fontSize: 12, color: '#8b949e', fontFamily: MONO },
  titleProject: { fontSize: 13, fontWeight: '600', color: '#c9d1d9' },
  titleActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: '#21262d', borderRadius: 6, borderWidth: 1, borderColor: '#30363d',
  },
  actionBtnText: { fontSize: 10, fontWeight: '600', fontFamily: MONO },

  statusNotice: { paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#21262d' },
  alertBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#2e2200', borderBottomWidth: 1, borderBottomColor: '#3d2e00',
  },
  alertText: { fontSize: 11, color: '#e3b341', flex: 1 },

  tabBar: { maxHeight: 36, backgroundColor: '#0d1117', borderBottomWidth: 1, borderBottomColor: '#21262d' },
  tabBarContent: { paddingHorizontal: 4, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, height: 35, marginHorizontal: 1,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    borderTopWidth: 2, borderTopColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#7c6ef0', backgroundColor: '#161b22' },
  tabName: { fontSize: 11, maxWidth: 90 },

  body: { flex: 1, flexDirection: 'row' },

  sidebar: { width: 185, backgroundColor: '#161b22', borderRightWidth: 1, borderRightColor: '#21262d' },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  sidebarTitle: { fontSize: 10, fontWeight: '700', color: '#484f58', letterSpacing: 1.2 },
  sidebarEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  sidebarEmptyText: { fontSize: 11, color: '#484f58', textAlign: 'center', lineHeight: 16 },
  projectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  projectLabel: { fontSize: 11, fontWeight: '700', color: '#8b949e', flex: 1 },
  treeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingRight: 8 },
  treeName: { fontSize: 11, flex: 1, fontFamily: MONO },

  editorCol: { flex: 1, flexDirection: 'column' },

  editorToolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  toolbarFileName: { flex: 1, fontSize: 11, color: '#8b949e', fontFamily: MONO },
  toolbarBtnSmall: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5,
    backgroundColor: '#21262d',
  },
  codeInput: {
    flex: 1, padding: 12, fontSize: 12, lineHeight: 20,
    fontFamily: MONO, color: '#e6edf3', backgroundColor: '#0d1117',
    textAlignVertical: 'top',
  },
  codeWithLines: { padding: 8 },
  codeLine: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 19 },
  lineNum: {
    width: 30, fontSize: 11, fontFamily: MONO,
    lineHeight: 19, textAlign: 'right', marginRight: 12,
    color: '#484f58',
  } as object,
  lineCode: { flex: 1, fontSize: 12, fontFamily: MONO, lineHeight: 19, color: '#e6edf3' },

  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  welcomeIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#7c6ef015', borderWidth: 1, borderColor: '#7c6ef030',
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: '#e6edf3' },
  welcomeSub: { fontSize: 12, color: '#8b949e', marginTop: -6 },
  welcomeBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  welcomeBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#7c6ef0',
  },
  welcomeBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d',
  },
  welcomeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  welcomeStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  welcomeStatItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  welcomeStatDot: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeStatLabel: { fontSize: 11, color: '#8b949e' },

  termFab: {
    position: 'absolute', left: 18,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#161b22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#30363d',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  termModal: { flex: 1, backgroundColor: '#0d1117' },
  termModalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  termModalTitle: {
    flex: 1, fontSize: 13, fontWeight: '700',
    color: '#8b949e', fontFamily: MONO, letterSpacing: 0.8,
  },
  termDots: { flexDirection: 'row', gap: 5 },
  termDot: { width: 11, height: 11, borderRadius: 6 },
  termAction: { padding: 6 },
  termOutput: { flex: 1, backgroundColor: '#0d1117' },
  termLine: { fontSize: 13, lineHeight: 20, fontFamily: MONO },
  termInputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#21262d',
    backgroundColor: '#0d1117',
  },
  termPrompt: { fontSize: 14, color: '#3fb950', fontFamily: MONO, fontWeight: '700' },
  termInput: {
    flex: 1, fontSize: 14, color: '#e6edf3',
    fontFamily: MONO, paddingVertical: 4,
  },
  termRunBtn: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d',
  },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#21262d',
  },
  statusLang: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusLangText: { fontSize: 11, fontWeight: '600', fontFamily: MONO },
  statusItem: { fontSize: 11, color: '#8b949e', fontFamily: MONO },
  statusSep: { fontSize: 11, color: '#21262d' },
  statusAiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: '#7c6ef015', borderRadius: 5, borderWidth: 1, borderColor: '#7c6ef030',
  },
  statusAiText: { fontSize: 10, color: '#7c6ef0', fontWeight: '600' },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: 20,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#e6edf3' },
  modalSub: { fontSize: 11, color: '#8b949e', marginTop: 2 },
  chatEmpty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  chatEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#e6edf3' },
  chatEmptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20, color: '#8b949e' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#21262d',
    backgroundColor: '#161b22',
  },
  chatInput: {
    flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, maxHeight: 120,
    backgroundColor: '#21262d', color: '#e6edf3', borderColor: '#30363d',
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

const phStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#7c6ef022', borderWidth: 1.5, borderColor: '#7c6ef055',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 13, fontWeight: '900', color: '#7c6ef0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#e6edf3' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5,
    backgroundColor: '#0d1117',
  },
  pillText: { fontSize: 11, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 14, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#161b22', borderRadius: 12,
    borderWidth: 1, borderColor: '#21262d',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#e6edf3' },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  tabItem: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#7c6ef0' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#484f58' },
  tabTextActive: { color: '#e6edf3' },
  actionCards: {
    flexDirection: 'row', gap: 12, padding: 14,
  },
  actionCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1.5,
  },
  actionCardTitle: { fontSize: 13, fontWeight: '700' },
  actionCardSub: { fontSize: 11, color: '#8b949e', marginTop: 2 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#e6edf3' },
  emptySub: { fontSize: 13, color: '#8b949e', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 10, backgroundColor: '#7c6ef0',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  projectCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, marginBottom: 10,
    backgroundColor: '#161b22', borderRadius: 12,
    borderWidth: 1, borderColor: '#21262d',
  },
  projectCardIcon: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: '#f0c67415', borderWidth: 1, borderColor: '#f0c67430',
    alignItems: 'center', justifyContent: 'center',
  },
  projectCardName: { fontSize: 14, fontWeight: '700', color: '#e6edf3' },
  projectCardMeta: { fontSize: 11, color: '#8b949e', marginTop: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    width: '85%', backgroundColor: '#161b22',
    borderRadius: 16, borderWidth: 1, borderColor: '#30363d', padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#e6edf3', marginBottom: 12 },
  modalInput: {
    backgroundColor: '#0d1117', color: '#e6edf3',
    borderWidth: 1, borderColor: '#30363d', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  modalBtn: {
    paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 8,
    backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#21262d',
  },
  statusText: { fontSize: 12, color: '#8b949e', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
