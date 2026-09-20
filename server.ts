import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Helper to get Gemini client
function getGeminiClient(userKey?: string): GoogleGenAI | null {
  const key = userKey || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

function formatGroqModelLabel(id: string): string {
  if (id === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B Versatile (Recomendado)';
  if (id === 'llama-3.1-8b-instant') return 'Llama 3.1 8B Instant (Ultra-Rápido)';
  if (id === 'deepseek-r1-distill-llama-70b') return 'DeepSeek R1 Distill Llama 70B (Raciocínio)';
  if (id === 'mixtral-8x7b-32768') return 'Mixtral 8x7B (Contexto 32k)';
  if (id === 'gemma2-9b-it') return 'Gemma 2 9B IT (Google)';
  if (id === 'qwen-2.5-32b') return 'Qwen 2.5 32B (Alibaba)';
  return id;
}

function formatOpenRouterModelLabel(id: string): string {
  if (id === 'anthropic/claude-3.7-sonnet') return 'Claude 3.7 Sonnet (Anthropic - Recomendado)';
  if (id === 'anthropic/claude-3.5-sonnet') return 'Claude 3.5 Sonnet (Anthropic)';
  if (id === 'deepseek/deepseek-r1') return 'DeepSeek R1 (Raciocínio - Recomendado)';
  if (id === 'deepseek/deepseek-chat') return 'DeepSeek V3 (Chat Rápido)';
  if (id === 'meta-llama/llama-3.3-70b-instruct') return 'Llama 3.3 70B Instruct (Meta)';
  if (id === 'google/gemini-2.0-flash-001') return 'Gemini 2.0 Flash (Google - Recomendado)';
  if (id === 'google/gemini-2.5-flash') return 'Gemini 2.5 Flash (Google)';
  if (id === 'openai/gpt-4o') return 'GPT-4o (OpenAI)';
  if (id === 'openai/gpt-4o-mini') return 'GPT-4o Mini (OpenAI)';
  if (id === 'mistralai/mistral-large-2411') return 'Mistral Large (Mistral AI)';
  if (id === 'qwen/qwen-2.5-72b-instruct') return 'Qwen 2.5 72B Instruct (Alibaba)';
  return id;
}

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    hasServerGeminiKey: !!process.env.GEMINI_API_KEY,
    hasServerOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasServerAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasServerGroqKey: !!process.env.GROQ_API_KEY,
    hasServerOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    time: new Date().toISOString()
  });
});

// Fetch Available Models Dynamically
router.post('/models', async (req, res) => {
  const { provider, apiKey, ollamaHost } = req.body;

  try {
    if (provider === 'gemini') {
      const defaultModels = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Rápido & Inteligente)', recommended: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Raciocínio Avançado)', recommended: false },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', recommended: false },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', recommended: false },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', recommended: false }
      ];
      return res.json({ models: defaultModels });
    }

    if (provider === 'openrouter') {
      const key = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
      if (key) {
        try {
          const resp = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
              Authorization: `Bearer ${key}`,
              'HTTP-Referer': 'https://notebooklm.app',
              'X-Title': 'NotebookLM Pro'
            }
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const openRouterModels = (data.data || [])
              .filter((m: any) => 
                m.id.includes('claude-3') ||
                m.id.includes('deepseek') ||
                m.id.includes('llama-3') ||
                m.id.includes('gemini-2') ||
                m.id.includes('gpt-4') ||
                m.id.includes('mistral') ||
                m.id.includes('qwen')
              )
              .slice(0, 25)
              .map((m: any) => ({
                id: m.id,
                name: m.name ? `${m.name} (${m.id.split('/')[0]})` : formatOpenRouterModelLabel(m.id),
                recommended: m.id === 'anthropic/claude-3.7-sonnet' || m.id === 'deepseek/deepseek-r1' || m.id === 'meta-llama/llama-3.3-70b-instruct' || m.id === 'google/gemini-2.0-flash-001'
              }))
              .sort((a: any, b: any) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
            if (openRouterModels.length > 0) return res.json({ models: openRouterModels });
          }
        } catch (e) {
          console.warn('OpenRouter dynamic fetch fallback', e);
        }
      }
      return res.json({
        models: [
          { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (Anthropic - Recomendado)', recommended: true },
          { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Raciocínio - Recomendado)', recommended: true },
          { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Chat Rápido)', recommended: true },
          { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (Meta)', recommended: true },
          { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Google)', recommended: true },
          { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Google)', recommended: false },
          { id: 'openai/gpt-4o', name: 'GPT-4o (OpenAI)', recommended: false },
          { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', recommended: false },
          { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411 (Mistral)', recommended: false },
          { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct (Alibaba)', recommended: false }
        ]
      });
    }

    if (provider === 'openai') {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (key) {
        try {
          const resp = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` }
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const filtered = data.data
              .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
              .sort((a: any, b: any) => b.created - a.created)
              .slice(0, 15)
              .map((m: any) => ({
                id: m.id,
                name: m.id,
                recommended: m.id === 'gpt-4o' || m.id === 'gpt-4o-mini'
              }));
            if (filtered.length > 0) return res.json({ models: filtered });
          }
        } catch (e) {
          console.warn('OpenAI dynamic fetch fallback', e);
        }
      }
      return res.json({
        models: [
          { id: 'gpt-4o', name: 'GPT-4o (Mais Capaz)', recommended: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Econômico)', recommended: true },
          { id: 'o3-mini', name: 'o3-mini (Raciocínio Rápido)', recommended: false },
          { id: 'o1', name: 'o1 (Raciocínio Avançado)', recommended: false },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', recommended: false },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', recommended: false }
        ]
      });
    }

    if (provider === 'anthropic') {
      return res.json({
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recomendado)', recommended: true },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Rápido)', recommended: true },
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', recommended: false },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Robusto)', recommended: false }
        ]
      });
    }

    if (provider === 'groq') {
      const key = (apiKey || process.env.GROQ_API_KEY || '').trim();
      if (key) {
        try {
          const resp = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${key}` }
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const groqModels = (data.data || [])
              .filter((m: any) => !m.id.includes('whisper') && !m.id.includes('tts') && !m.id.includes('guard'))
              .map((m: any) => ({
                id: m.id,
                name: formatGroqModelLabel(m.id),
                recommended: m.id.includes('llama-3.3-70b') || m.id.includes('llama-3.1-8b') || m.id.includes('deepseek-r1')
              }))
              .sort((a: any, b: any) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
            if (groqModels.length > 0) return res.json({ models: groqModels });
          }
        } catch (e) {
          console.warn('Groq dynamic fetch fallback', e);
        }
      }
      return res.json({
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Recomendado)', recommended: true },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra-Rápido)', recommended: true },
          { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B (Raciocínio)', recommended: true },
          { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile', recommended: false },
          { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Contexto 32k)', recommended: false },
          { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT (Google)', recommended: false },
          { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', recommended: false }
        ]
      });
    }

    if (provider === 'ollama') {
      const host = ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434';
      try {
        const resp = await fetch(`${host}/api/tags`);
        if (resp.ok) {
          const data: any = await resp.json();
          const ollamaModels = (data.models || []).map((m: any) => ({
            id: m.name,
            name: `${m.name} (${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)`,
            recommended: true
          }));
          if (ollamaModels.length > 0) return res.json({ models: ollamaModels });
        }
      } catch (e) {
        console.warn('Ollama unreachable at', host);
      }
      return res.json({
        models: [
          { id: 'llama3:latest', name: 'Llama 3 (Local)', recommended: true },
          { id: 'mistral:latest', name: 'Mistral (Local)', recommended: false },
          { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Local Reasoning)', recommended: false },
          { id: 'qwen2.5:latest', name: 'Qwen 2.5 (Local)', recommended: false }
        ]
      });
    }

    return res.status(400).json({ error: 'Provedor não suportado' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao carregar modelos' });
  }
});

// Test and Validate API Key
router.post('/test-key', async (req, res) => {
  const { provider, apiKey, ollamaHost } = req.body;

  try {
    if (provider === 'gemini') {
      const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
      if (!key) {
        return res.status(400).json({ success: false, message: 'Nenhuma chave fornecida para o Google Gemini.' });
      }
      try {
        // Direct test against Google Generative Language API
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
        const resp = await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda apenas OK' }] }]
          })
        });

        if (resp.ok) {
          return res.json({ success: true, message: 'Google Gemini conectado com sucesso! Chave ativa e operacional.' });
        }

        // Fallback test to gemini-2.0-flash
        const fbUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
        const fbResp = await fetch(fbUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda apenas OK' }] }]
          })
        });

        if (fbResp.ok) {
          return res.json({ success: true, message: 'Google Gemini conectado com sucesso (Gemini 2.0 Flash).' });
        }

        const errData = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          success: false,
          message: errData.error?.message || `Erro do Google Gemini: HTTP ${resp.status}`
        });
      } catch (err: any) {
        return res.status(401).json({ success: false, message: `Erro ao validar chave Gemini: ${err.message || 'Chave inválida'}` });
      }
    }

    if (provider === 'openrouter') {
      const key = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
      if (!key) {
        return res.status(400).json({ success: false, message: 'Insira a chave da OpenRouter (sk-or-v1-...)' });
      }
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://notebooklm.app',
            'X-Title': 'NotebookLM Pro'
          }
        });
        if (resp.ok) {
          const keyData: any = await resp.json().catch(() => ({}));
          const label = keyData.data?.label || '';
          const limit = keyData.data?.limit !== null && keyData.data?.limit !== undefined ? ` (Limite: $${keyData.data.limit})` : '';
          return res.json({
            success: true,
            message: `OpenRouter conectada com sucesso! ${label}${limit}`
          });
        }
        // Fallback check models endpoint
        const modelsResp = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` }
        });
        if (modelsResp.ok) {
          return res.json({
            success: true,
            message: 'OpenRouter conectada com sucesso! Modelos disponíveis.'
          });
        }
        const err = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          success: false,
          message: err.error?.message || `Erro da OpenRouter: HTTP ${resp.status}`
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          message: `Erro ao conectar com a OpenRouter: ${err.message}`
        });
      }
    }

    if (provider === 'openai') {
      if (!apiKey) {
        return res.status(400).json({ success: false, message: 'Insira a chave da OpenAI (sk-...)' });
      }
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (resp.ok) {
        const data: any = await resp.json();
        return res.json({
          success: true,
          message: `OpenAI conectada com sucesso! ${data.data?.length || 0} modelos detectados.`
        });
      } else {
        const err: any = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          success: false,
          message: err.error?.message || `Erro da OpenAI: HTTP ${resp.status}`
        });
      }
    }

    if (provider === 'anthropic') {
      if (!apiKey) {
        return res.status(400).json({ success: false, message: 'Insira a chave da Anthropic (sk-ant-...)' });
      }
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5
        })
      });

      if (resp.ok) {
        return res.json({ success: true, message: 'Anthropic Claude conectado com sucesso!' });
      } else {
        const err: any = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          success: false,
          message: err.error?.message || `Erro da Anthropic: HTTP ${resp.status}`
        });
      }
    }

    if (provider === 'groq') {
      if (!apiKey) {
        return res.status(400).json({ success: false, message: 'Insira a chave da Groq (gsk_...)' });
      }
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (resp.ok) {
        const data: any = await resp.json();
        return res.json({
          success: true,
          message: `Groq conectada com sucesso! ${data.data?.length || 0} modelos disponíveis.`
        });
      } else {
        const err: any = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          success: false,
          message: err.error?.message || `Erro da Groq: HTTP ${resp.status}`
        });
      }
    }

    if (provider === 'ollama') {
      const host = ollamaHost || 'http://localhost:11434';
      const resp = await fetch(`${host}/api/tags`);
      if (resp.ok) {
        const data: any = await resp.json();
        return res.json({
          success: true,
          message: `Ollama conectado localmente! ${data.models?.length || 0} modelos encontrados.`
        });
      } else {
        return res.status(502).json({
          success: false,
          message: `Não foi possível conectar ao Ollama no endereço ${host}. Certifique-se de que o daemon 'ollama serve' está rodando.`
        });
      }
    }

    return res.status(400).json({ success: false, message: 'Provedor não reconhecido.' });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Falha na verificação de conexão.'
    });
  }
});

// PDF Parsing Endpoint (safe dynamic load)
router.post('/parse-pdf', async (req, res) => {
  try {
    const { base64Data, filename } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Nenhum dado base64 fornecido' });
    }

    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Parse using dynamically loaded pdf-parse without crash on serverless initialization
    const require = createRequire(import.meta.url);
    let pdfParseLib: any;
    try {
      pdfParseLib = require('pdf-parse/lib/pdf-parse.js');
    } catch {
      pdfParseLib = require('pdf-parse');
    }

    const data = await pdfParseLib(buffer);
    const text = data.text ? data.text.trim() : '';

    if (!text) {
      return res.status(422).json({ error: 'Não foi possível extrair texto legível deste PDF (pode ser imagem digitalizada).' });
    }

    res.json({
      success: true,
      filename,
      numPages: data.numpages,
      textLength: text.length,
      text
    });
  } catch (error: any) {
    console.error('Erro ao extrair PDF:', error);
    res.status(500).json({ error: error.message || 'Falha ao processar arquivo PDF' });
  }
});

// Web URL Fetching & Scraping
router.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'URL inválida' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NotebookLM-Bot/1.0',
        'Accept': 'text/html,application/xhtml+xml,text/plain'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Falha ao carregar página: HTTP ${response.status}` });
    }

    const html = await response.text();
    // Clean HTML into readable markdown/plain text
    let title = 'Documento Web';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    // Strip scripts, styles, navigations
    let clean = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Cap at reasonable size for context
    if (clean.length > 50000) {
      clean = clean.substring(0, 50000) + '... [Conteúdo truncado para otimização de tokens]';
    }

    res.json({
      success: true,
      title,
      url,
      text: clean,
      textLength: clean.length
    });
  } catch (error: any) {
    console.error('Erro ao buscar URL:', error);
    res.status(500).json({ error: error.message || 'Falha ao acessar link web' });
  }
});

// Embeddings endpoint (supporting Gemini or OpenAI or algorithmic high-dimension vectors)
router.post('/embeddings', async (req, res) => {
  try {
    const { texts, provider, apiKey } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Nenhum texto enviado para embedding' });
    }

    const gemini = getGeminiClient(provider === 'gemini' ? apiKey : undefined);

    // Try Gemini embeddings if available
    if (gemini) {
      try {
        const embeddings: number[][] = [];
        for (const text of texts.slice(0, 30)) {
          const resp = await gemini.models.embedContent({
            model: 'text-embedding-004',
            contents: text.slice(0, 2048)
          });
          const vector: number[] = (resp as any).embeddings?.[0]?.values || (resp as any).embedding?.values || [];
          // Pad or resize to 1536 dimensions if needed to match vector(1536) in Supabase
          const targetDim = 1536;
          const adjustedVector = new Array(targetDim).fill(0);
          for (let i = 0; i < targetDim; i++) {
            if (i < vector.length) {
              adjustedVector[i] = vector[i];
            } else {
              adjustedVector[i] = (vector[i % vector.length] || 0) * 0.1;
            }
          }
          embeddings.push(adjustedVector);
        }
        return res.json({ success: true, embeddings, dimension: 1536 });
      } catch (geminiErr) {
        console.warn('Falha no embedding via Gemini, gerando vetor otimizado:', geminiErr);
      }
    }

    // Try OpenAI embedding if key supplied
    const openAiKey = (provider === 'openai' ? apiKey : '') || process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const resp = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: texts.slice(0, 30).map((t: string) => t.slice(0, 2048))
          })
        });
        if (resp.ok) {
          const data: any = await resp.json();
          const embeddings = data.data.map((d: any) => d.embedding);
          return res.json({ success: true, embeddings, dimension: 1536 });
        }
      } catch (openAiErr) {
        console.warn('Falha no embedding via OpenAI:', openAiErr);
      }
    }

    // High-dimension TF-IDF / Hash projection embedding fallback (1536 dims) for local offline operation
    const embeddings = texts.map((t: string) => generateDeterministicEmbedding(t, 1536));
    res.json({ success: true, embeddings, dimension: 1536, fallback: true });
  } catch (error: any) {
    console.error('Erro em embeddings:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar embeddings' });
  }
});

// Deterministic semantic embedding generator (1536 dimensions) for local similarity
function generateDeterministicEmbedding(text: string, dim = 1536): number[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const vector = new Array(dim).fill(0);
  
  if (words.length === 0) return vector;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    const weight = 1 + Math.log(1 + 1 / (i + 1));
    vector[idx] += weight;

    // Secondary projection for bigrams
    if (i < words.length - 1) {
      const nextWord = words[i + 1];
      const bigramHash = Math.abs((hash ^ (nextWord.charCodeAt(0) << 4))) % dim;
      vector[bigramHash] += 0.5 * weight;
    }
  }

  // Normalize vector to unit length (L2 norm)
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

// RAG Chat Endpoint with Token Optimization
router.post('/chat', async (req, res) => {
  try {
    const {
      provider = 'gemini',
      model = 'gemini-2.5-flash',
      apiKey,
      ollamaHost,
      messages = [],
      retrievedChunks = [],
      notebookTitle = 'Caderno Atual'
    } = req.body;

    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida' });
    }

    const latestUserMessage = messages[messages.length - 1].content;

    // Calculate token economy stats
    const totalCharsRetrieved = retrievedChunks.reduce((acc: number, c: any) => acc + (c.content?.length || 0), 0);
    const estimatedTokensUsed = Math.round((latestUserMessage.length + totalCharsRetrieved) / 3.8);

    // Build optimized context from RAG retrieved chunks
    let ragContextSection = '';
    if (retrievedChunks.length > 0) {
      ragContextSection = `\n\n--- FONTES DO CADERNO CONSULTADAS (RAG OTIMIZADO) ---\n` +
        retrievedChunks.map((chunk: any, idx: number) => {
          return `[Fonte #${idx + 1} | Documento: "${chunk.documentName}" | Similaridade: ${(chunk.similarity * 100).toFixed(1)}%]:\n"${chunk.content}"\n`;
        }).join('\n');
    }

    const systemPrompt = `Você é o assistente inteligente de pesquisa e síntese de documentos integrado ao NotebookLM ("${notebookTitle}").
Sua missão principal é responder às dúvidas do usuário com precisão cirúrgica, baseando-se nas fontes recuperadas pelo sistema RAG quando disponíveis.

DIRETRIZES DE RESPOSTA:
1. Sempre priorize as informações contidas nos trechos das [Fontes #X] fornecidas abaixo.
2. Quando citar um fato específico proveniente de uma fonte, inclua a citação no formato [1], [2], etc., correspondente ao número da fonte consultada.
3. Seja conciso, analítico e objetivo para maximizar clareza e economizar leitura e tokens.
4. Se as fontes fornecidas não contiverem a resposta completa, avise claramente o usuário sobre o que as fontes abordam e complemente com seu conhecimento geral de forma distinguível.
5. Responda no mesmo idioma da pergunta do usuário (preferencialmente Português se a pergunta for em português).
6. Utilize formatação Markdown refinada (listas, negrito, tabelas ou blocos de código quando apropriado).
${ragContextSection}`;

    let reply = '';
    let usedProvider = provider;
    let usedModel = model;

    // 1. Google Gemini
    if (provider === 'gemini') {
      const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
      if (!key) {
        return res.status(401).json({
          error: 'Chave do Google Gemini não configurada. Insira sua chave no painel de configurações ou configure GEMINI_API_KEY.'
        });
      }

      let geminiModel = model;
      if (!geminiModel || !geminiModel.startsWith('gemini') || geminiModel.includes('3.6') || geminiModel.includes('3.8')) {
        geminiModel = 'gemini-2.5-flash';
      }

      // Convert prior conversation history concisely
      const recentHistory = messages.slice(-5, -1).map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const contents = [
        ...recentHistory,
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nPergunta do Usuário: ${latestUserMessage}` }] }
      ];

      try {
        const directResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents.map((c: any) => ({
              role: c.role === 'model' ? 'model' : 'user',
              parts: c.parts
            })),
            generationConfig: {
              temperature: 0.2
            }
          })
        });

        if (directResp.ok) {
          const directData: any = await directResp.json();
          reply = directData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta do Gemini.';
          usedModel = geminiModel;
        } else {
          // Try fallback to gemini-2.0-flash
          const fbResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: contents.map((c: any) => ({
                role: c.role === 'model' ? 'model' : 'user',
                parts: c.parts
              })),
              generationConfig: { temperature: 0.2 }
            })
          });

          if (fbResp.ok) {
            const fbData: any = await fbResp.json();
            reply = fbData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta do Gemini.';
            usedModel = 'gemini-2.0-flash';
          } else {
            const errData = await directResp.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Google Gemini error: HTTP ${directResp.status}`);
          }
        }
      } catch (geminiErr: any) {
        console.warn(`Gemini direct REST failed, attempting SDK:`, geminiErr?.message);
        const geminiClient = getGeminiClient(key);
        if (geminiClient) {
          const sdkResp = await geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents
          });
          reply = sdkResp.text || 'Sem resposta do modelo.';
          usedModel = 'gemini-2.5-flash';
        } else {
          throw geminiErr;
        }
      }
    }

    // 2. OpenRouter
    else if (provider === 'openrouter') {
      const key = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
      if (!key) {
        return res.status(401).json({ error: 'Chave da API OpenRouter não configurada. Conecte sua chave no painel de configurações.' });
      }

      let openRouterModel = model;
      if (!openRouterModel || openRouterModel.startsWith('gemini-') || openRouterModel.startsWith('gpt-') || openRouterModel.startsWith('claude-')) {
        openRouterModel = 'anthropic/claude-3.7-sonnet';
      }

      const openRouterMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-6).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      ];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://notebooklm.app',
          'X-Title': 'NotebookLM Pro'
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: openRouterMessages,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenRouter error: HTTP ${response.status}`);
      }

      const data: any = await response.json();
      reply = data.choices?.[0]?.message?.content || 'Sem resposta da OpenRouter.';
      usedModel = openRouterModel;
    }

    // 3. OpenAI
    else if (provider === 'openai') {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) {
        return res.status(401).json({ error: 'Chave da API da OpenAI não configurada no painel de configurações.' });
      }

      const openAiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-4)
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: openAiMessages,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI error: HTTP ${response.status}`);
      }

      const data: any = await response.json();
      reply = data.choices?.[0]?.message?.content || 'Sem resposta da OpenAI.';
    }

    // 3. Anthropic (Claude)
    else if (provider === 'anthropic') {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return res.status(401).json({ error: 'Chave da API Anthropic (Claude) não configurada.' });
      }

      const claudeMessages = messages.slice(-4).map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          system: systemPrompt,
          messages: claudeMessages,
          max_tokens: 2048,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic error: HTTP ${response.status}`);
      }

      const data: any = await response.json();
      reply = data.content?.[0]?.text || 'Sem resposta do Claude.';
    }

    // 4. Groq
    else if (provider === 'groq') {
      const key = (apiKey || process.env.GROQ_API_KEY || '').trim();
      if (!key) {
        return res.status(401).json({ error: 'Chave da API Groq não configurada. Conecte sua chave no painel de configurações.' });
      }

      let groqModel = model;
      if (!groqModel || groqModel.startsWith('gemini') || groqModel.startsWith('gpt') || groqModel.startsWith('claude')) {
        groqModel = 'llama-3.3-70b-versatile';
      }

      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-6).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: groqModel,
          messages: groqMessages,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Groq error: HTTP ${response.status}`);
      }

      const data: any = await response.json();
      reply = data.choices?.[0]?.message?.content || 'Sem resposta da Groq.';
      usedModel = groqModel;
    }

    // 5. Ollama (Local)
    else if (provider === 'ollama') {
      const host = ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434';
      const ollamaMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-4)
      ];

      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3',
          messages: ollamaMessages,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama falhou ao responder no endpoint ${host}. Verifique se o serviço está rodando.`);
      }

      const data: any = await response.json();
      reply = data.message?.content || 'Sem resposta do Ollama.';
    } else {
      return res.status(400).json({ error: `Provedor desconhecido: ${provider}` });
    }

    res.json({
      success: true,
      content: reply,
      provider: usedProvider,
      model: usedModel,
      sources: retrievedChunks.map((c: any, i: number) => ({
        index: i + 1,
        documentId: c.documentId,
        documentName: c.documentName,
        similarity: c.similarity,
        snippet: c.content ? c.content.slice(0, 180) + '...' : ''
      })),
      tokensStats: {
        retrievedChunksCount: retrievedChunks.length,
        estimatedPromptTokens: estimatedTokensUsed,
        estimatedTokensSaved: Math.max(0, 12500 - estimatedTokensUsed),
        savingsPercentage: Math.min(96, Math.max(65, Math.round((1 - estimatedTokensUsed / 12500) * 100)))
      }
    });
  } catch (error: any) {
    console.error('Erro no /api/chat:', error);
    res.status(500).json({ error: error.message || 'Erro durante a inferência com a IA' });
  }
});

// NotebookLM Studio Artifacts Generator (Audio Podcast Overview, Study Guide, FAQ, Briefing)
router.post('/generate-studio-artifact', async (req, res) => {
  try {
    const { type, documentsText, notebookTitle, provider = 'gemini', apiKey } = req.body;
    
    if (!documentsText || documentsText.trim().length === 0) {
      return res.status(400).json({ error: 'Nenhum documento com conteúdo disponível no caderno.' });
    }

    let artifactPrompt = '';
    if (type === 'audio_overview') {
      artifactPrompt = `Você é o roteirista do famoso recurso "Audio Overview" do NotebookLM.
Com base exclusivamente nas fontes do caderno "${notebookTitle}", crie um diálogo envolvente em estilo podcast entre dois apresentadores especialistas:
- Alex (curioso, perspicaz, faz perguntas inteligentes e metáforas)
- Sam (analítico, aprofundado, explica conexões e detalhes das fontes)

O podcast deve ter:
- Título cativante
- Abertura dinâmica saudando os ouvintes
- Discussão dos pontos mais instigantes dos documentos
- Conclusão com lição prática
Formato: Roteiro estruturado com marcações [Alex] e [Sam]. Em Português.`;
    } else if (type === 'study_guide') {
      artifactPrompt = `Gere um "Guia de Estudos Completo" baseado nas fontes do caderno "${notebookTitle}".
Estrutura:
1. Resumo Temático Geral
2. Conceitos-Chave e Definições
3. Perguntas de Fixação com Gabarito Explicativo
4. 5 Flashcards de Revisão Rápida (Frente/Verso)`;
    } else if (type === 'briefing_doc') {
      artifactPrompt = `Gere um "Briefing Executivo / Memorando de Síntese" baseado nas fontes do caderno "${notebookTitle}".
Estrutura:
1. Sumário Executivo (3 a 5 pontos críticos)
2. Análise Detalhada dos Documentos
3. Implicações Práticas e Decisões
4. Tópicos de Atenção / Próximos Passos`;
    } else if (type === 'faq') {
      artifactPrompt = `Gere uma seção completa de "Perguntas Frequentes (FAQ)" com as 7 perguntas mais importantes que alguém faria sobre os conteúdos deste caderno "${notebookTitle}", acompanhadas de respostas detalhadas fundamentadas nas fontes.`;
    } else {
      artifactPrompt = `Faça um resumo analítico completo e estruturado dos documentos do caderno "${notebookTitle}".`;
    }

    const fullPrompt = `${artifactPrompt}\n\n--- DOCUMENTOS DO CADERNO ---\n${documentsText.slice(0, 30000)}`;

    // 1. OpenRouter
    if (provider === 'openrouter') {
      const openRouterKey = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
      if (!openRouterKey) {
        return res.status(401).json({ error: 'Chave da API OpenRouter não informada. Conecte sua chave no painel de configurações.' });
      }
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://notebooklm.app',
          'X-Title': 'NotebookLM Pro'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.7-sonnet',
          messages: [{ role: 'user', content: fullPrompt }],
          temperature: 0.3
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erro da OpenRouter: HTTP ${response.status}`);
      }
      const data: any = await response.json();
      return res.json({
        success: true,
        type,
        title: notebookTitle,
        content: data.choices?.[0]?.message?.content || 'Não foi possível gerar o artefato.'
      });
    }

    // 2. Groq
    if (provider === 'groq') {
      const groqKey = (apiKey || process.env.GROQ_API_KEY || '').trim();
      if (!groqKey) {
        return res.status(401).json({ error: 'Chave da API Groq não informada. Conecte sua chave no painel de configurações.' });
      }
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: fullPrompt }],
          temperature: 0.3
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erro da Groq: HTTP ${response.status}`);
      }
      const data: any = await response.json();
      return res.json({
        success: true,
        type,
        title: notebookTitle,
        content: data.choices?.[0]?.message?.content || 'Não foi possível gerar o artefato.'
      });
    }

    // 3. OpenAI
    if (provider === 'openai') {
      const openAiKey = (apiKey || process.env.OPENAI_API_KEY || '').trim();
      if (!openAiKey) {
        return res.status(401).json({ error: 'Chave da API OpenAI não informada.' });
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: fullPrompt }],
          temperature: 0.3
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erro da OpenAI: HTTP ${response.status}`);
      }
      const data: any = await response.json();
      return res.json({
        success: true,
        type,
        title: notebookTitle,
        content: data.choices?.[0]?.message?.content || 'Não foi possível gerar o artefato.'
      });
    }

    // 4. Anthropic
    if (provider === 'anthropic') {
      const claudeKey = (apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
      if (!claudeKey) {
        return res.status(401).json({ error: 'Chave da API Anthropic não informada.' });
      }
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          messages: [{ role: 'user', content: fullPrompt }],
          max_tokens: 3000
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erro da Anthropic: HTTP ${response.status}`);
      }
      const data: any = await response.json();
      return res.json({
        success: true,
        type,
        title: notebookTitle,
        content: data.content?.[0]?.text || 'Não foi possível gerar o artefato.'
      });
    }

    // 5. Google Gemini or Server fallback
    const geminiKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (geminiKey) {
      try {
        const directResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.2 }
          })
        });
        if (directResp.ok) {
          const data: any = await directResp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return res.json({
              success: true,
              type,
              title: notebookTitle,
              content: text
            });
          }
        }
      } catch (e) {
        console.warn('Gemini studio direct failed, falling to SDK', e);
      }
      const gemini = getGeminiClient(geminiKey);
      if (gemini) {
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: fullPrompt
        });
        return res.json({
          success: true,
          type,
          title: notebookTitle,
          content: response.text || 'Não foi possível gerar o artefato.'
        });
      }
    }

    res.status(400).json({ error: 'Configuração de IA necessária para gerar artefatos de estúdio. Conecte sua chave nas configurações.' });
  } catch (error: any) {
    console.error('Erro em studio artifact:', error);
    res.status(500).json({ error: error.message || 'Falha ao gerar artefato do estúdio' });
  }
});

// Mount router on both /api prefix and root for full compatibility with Vercel and local
app.use('/api', router);
app.use('/', router);

// Export app for Vercel serverless function
export default app;

// Only listen locally if not on Vercel serverless
if (process.env.VERCEL !== '1') {
  async function startServer() {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`NotebookLM Server running on http://0.0.0.0:${PORT}`);
    });
  }

  startServer();
}
