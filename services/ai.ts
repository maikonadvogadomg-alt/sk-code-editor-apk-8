export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
}

export interface ProviderInfo {
  name: string;
  baseUrl: string;
  models: string[];
  type: 'openai' | 'anthropic' | 'gemini';
  defaultMaxTokens: number;
}

export const PROVIDERS: Record<string, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-mini',
      'o3-mini',
    ],
    type: 'openai',
    defaultMaxTokens: 16384,
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-90b-vision-preview',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
      'deepseek-r1-distill-llama-70b',
    ],
    type: 'openai',
    defaultMaxTokens: 32768,
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    type: 'anthropic',
    defaultMaxTokens: 8192,
  },
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-thinking-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
    ],
    type: 'gemini',
    defaultMaxTokens: 8192,
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'mistralai/mistral-large',
      'cohere/command-r-plus',
      'x-ai/grok-2',
    ],
    type: 'openai',
    defaultMaxTokens: 16384,
  },
  xai: {
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-2', 'grok-2-mini', 'grok-beta'],
    type: 'openai',
    defaultMaxTokens: 131072,
  },
};

export async function sendMessage(
  messages: Message[],
  config: AIConfig,
  systemPrompt?: string,
): Promise<string> {
  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error('Provedor não encontrado. Configure nas Configurações.');
  if (!config.apiKey) throw new Error('Chave de API não configurada. Vá em Configurações.');

  const maxTok = config.maxTokens ?? provider.defaultMaxTokens;

  if (provider.type === 'openai') {
    const msgs: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    const isO1 = config.model.startsWith('o1') || config.model.startsWith('o3');
    const body: Record<string, unknown> = {
      model: config.model,
      messages: msgs,
    };
    if (!isO1) {
      body.max_tokens = maxTok;
      body.temperature = 0.7;
    }
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.provider === 'openrouter'
          ? { 'HTTP-Referer': 'https://skcode.app', 'X-Title': 'SK Code Mobile' }
          : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro API: ${err}`);
    }
    const data = await response.json();
    return data.choices[0].message.content as string;
  }

  if (provider.type === 'anthropic') {
    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTok,
        system: systemPrompt ?? 'Você é um assistente inteligente e prestativo.',
        messages: messages.filter((m) => m.role !== 'system'),
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro API: ${err}`);
    }
    const data = await response.json();
    return data.content[0].text as string;
  }

  if (provider.type === 'gemini') {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    const response = await fetch(
      `${provider.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemPrompt
            ? { parts: [{ text: systemPrompt }] }
            : undefined,
          generationConfig: {
            maxOutputTokens: maxTok,
            temperature: 0.7,
          },
        }),
      },
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erro API: ${err}`);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text as string;
  }

  throw new Error('Tipo de provedor não suportado');
}

export async function transcribeAudio(audioUri: string, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'audio.m4a',
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Erro ao transcrever áudio');
  const data = await response.json();
  return data.text as string;
}
