import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { Alert, Platform } from 'react-native';

export interface VirtualFile {
  name: string;
  content: string;
  path: string;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export async function importZip(): Promise<VirtualFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return [];
  const asset = result.assets[0];

  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let bytes: Uint8Array;
    if (Platform.OS === 'web') {
      const binaryStr = atob(base64);
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
    } else {
      const binaryStr = atob(base64);
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
    }

    const zip = await JSZip.loadAsync(bytes.buffer);
    const files: VirtualFile[] = [];
    const promises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && !relativePath.startsWith('__MACOSX')) {
        promises.push(
          zipEntry
            .async('string')
            .then((content) => {
              files.push({
                name: relativePath.split('/').pop() ?? relativePath,
                path: relativePath,
                content,
              });
            })
            .catch(() => {
              zipEntry.async('base64').then((b64) => {
                files.push({
                  name: relativePath.split('/').pop() ?? relativePath,
                  path: relativePath,
                  content: `[arquivo binário — base64]\n${b64.slice(0, 200)}...`,
                });
              });
            }),
        );
      }
    });

    await Promise.all(promises);
    return files.sort((a, b) => a.path.localeCompare(b.path));
  } catch (err) {
    Alert.alert('Erro', `Não foi possível ler o arquivo ZIP.\n${err instanceof Error ? err.message : ''}`);
    return [];
  }
}

export async function exportZip(files: VirtualFile[], projectName: string): Promise<void> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.path, f.content);
  }
  const base64 = await zip.generateAsync({ type: 'base64' });

  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${base64}`;
    link.download = `${projectName}.zip`;
    link.click();
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}${projectName}.zip`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/zip',
    dialogTitle: `Exportar ${projectName}.zip`,
  });
}

export async function importDocument(): Promise<{ name: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/*', 'application/pdf', 'application/json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  try {
    const content = await FileSystem.readAsStringAsync(asset.uri);
    return { name: asset.name, content };
  } catch {
    const b64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { name: asset.name, content: `[base64]\n${b64}` };
  }
}

export async function githubPullRepo(cfg: GitHubConfig): Promise<VirtualFile[]> {
  const headers = {
    Authorization: `token ${cfg.token}`,
    Accept: 'application/vnd.github.v3+json',
  };
  const baseUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}`;

  async function fetchTree(sha: string): Promise<VirtualFile[]> {
    const res = await fetch(`${baseUrl}/git/trees/${sha}?recursive=1`, { headers });
    if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const blobs = (data.tree as Array<{ type: string; path: string; sha: string }>).filter(
      (item) => item.type === 'blob',
    );
    const files: VirtualFile[] = [];
    const chunks = [];
    for (let i = 0; i < blobs.length; i += 5) chunks.push(blobs.slice(i, i + 5));
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (blob) => {
          const blobRes = await fetch(`${baseUrl}/git/blobs/${blob.sha}`, { headers });
          if (!blobRes.ok) return;
          const blobData = await blobRes.json();
          let content = blobData.content ?? '';
          if (blobData.encoding === 'base64') {
            try {
              content = atob(content.replace(/\n/g, ''));
            } catch {
              content = `[base64]\n${content}`;
            }
          }
          files.push({ name: blob.path.split('/').pop() ?? blob.path, path: blob.path, content });
        }),
      );
    }
    return files;
  }

  const branchRes = await fetch(`${baseUrl}/branches/${cfg.branch}`, { headers });
  if (!branchRes.ok) throw new Error(`Branch "${cfg.branch}" não encontrada`);
  const branchData = await branchRes.json();
  const treeSha = branchData.commit?.commit?.tree?.sha;
  if (!treeSha) throw new Error('Árvore do repositório não encontrada');
  return fetchTree(treeSha);
}

export async function githubPushFile(
  cfg: GitHubConfig,
  filePath: string,
  content: string,
): Promise<void> {
  const headers = {
    Authorization: `token ${cfg.token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;

  let sha: string | undefined;
  try {
    const existing = await fetch(`${url}?ref=${cfg.branch}`, { headers });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch {}

  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body: Record<string, unknown> = {
    message: `chore: update ${filePath}`,
    content: encoded,
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Erro ${res.status}`);
  }
}

export async function githubListFiles(cfg: GitHubConfig): Promise<VirtualFile[]> {
  return githubPullRepo(cfg);
}
