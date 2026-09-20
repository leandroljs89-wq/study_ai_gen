import React, { useState } from 'react';
import { 
  X, 
  Key, 
  Database, 
  Sliders, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Save, 
  Copy, 
  CheckCircle2, 
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  PlugZap,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { UserApiKeys, SupabaseConfig, Notebook, AIProvider } from '../types';
import { testSupabaseConnection, saveProfileApiKeys } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { apiFetch } from '../lib/apiHelper';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: UserApiKeys;
  onSaveApiKeys: (keys: UserApiKeys) => void;
  supabaseConfig: SupabaseConfig;
  onSaveSupabaseConfig: (config: SupabaseConfig) => void;
  currentNotebook: Notebook;
  onSyncWithSupabase?: () => Promise<void>;
  ragParams: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    minThreshold: number;
  };
  onSaveRagParams: (params: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    minThreshold: number;
  }) => void;
  initialProvider?: AIProvider;
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

const SUPABASE_SCHEMA_SQL = `-- 1. HABILITAR EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. CRIAÇÃO DAS TABELAS

-- TABELA: profiles (Perfis de Usuários)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    -- Chaves de API salvas em formato JSONB unificado (Flexível, sem poluição de atributos)
    api_keys JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Migração não-destrutiva (garante a coluna api_keys caso a tabela já exista)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}'::jsonb;

-- TABELA: notebooks (Cadernos)
CREATE TABLE IF NOT EXISTS public.notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABELA: documents (Arquivos e Fontes do Caderno)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT, -- Caminho no Supabase Storage
    file_type TEXT NOT NULL, -- ex: 'pdf', 'txt', 'web_link', 'note'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- TABELA: document_chunks (Embeddings & RAG)
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- Suporta vetores de 1536 dimensões
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ÍNDICE VETORIAL (HNSW para busca rápida por similaridade de cosseno)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- TABELA: chat_messages (Histórico de Conversas)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. AUTOMAÇÃO (TRIGGER PARA CRIAR PROFILE AO REGISTRAR USUÁRIO)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. SEGURANÇA (ROW LEVEL SECURITY - RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: profiles
CREATE POLICY "Usuários podem ver seu próprio perfil" 
    ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seu próprio perfil" 
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- POLÍTICAS: notebooks
CREATE POLICY "Usuários podem gerenciar seus próprios cadernos" 
    ON public.notebooks FOR ALL USING (auth.uid() = user_id);

-- POLÍTICAS: documents
CREATE POLICY "Usuários podem gerenciar documentos dos seus cadernos" 
    ON public.documents FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = documents.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

-- POLÍTICAS: document_chunks
CREATE POLICY "Usuários podem acessar chunks de seus documentos" 
    ON public.document_chunks FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.documents
            JOIN public.notebooks ON notebooks.id = documents.notebook_id
            WHERE documents.id = document_chunks.document_id 
            AND notebooks.user_id = auth.uid()
        )
    );

-- POLÍTICAS: chat_messages
CREATE POLICY "Usuários podem gerenciar mensagens de seus cadernos" 
    ON public.chat_messages FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = chat_messages.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

-- 5. FUNÇÃO DE BUSCA VETORIAL PARA RAG
CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5,
    filter_notebook_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    JOIN public.notebooks n ON n.id = d.notebook_id
    WHERE n.user_id = auth.uid()
      AND (filter_notebook_id IS NULL OR d.notebook_id = filter_notebook_id)
      AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;`;

interface ProviderStatus {
  testing: boolean;
  connected?: boolean;
  message?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onSaveApiKeys,
  supabaseConfig,
  onSaveSupabaseConfig,
  currentNotebook,
  onSyncWithSupabase,
  ragParams,
  onSaveRagParams,
  initialProvider,
  currentUser,
  onOpenAuthModal
}) => {
  const [activeTab, setActiveTab] = useState<'apikeys' | 'supabase' | 'rag'>('apikeys');

  // Form states
  const [keysForm, setKeysForm] = useState<UserApiKeys>({ ...apiKeys });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  
  // Connection states per provider
  const [statusByProvider, setStatusByProvider] = useState<Record<string, ProviderStatus>>({
    openrouter: { testing: false, connected: !!apiKeys.openrouter_api_key },
    gemini: { testing: false, connected: true, message: 'Google Gemini ativo e pronto.' },
    openai: { testing: false, connected: !!apiKeys.openai_api_key },
    anthropic: { testing: false, connected: !!apiKeys.anthropic_api_key },
    groq: { testing: false, connected: !!apiKeys.groq_api_key },
    ollama: { testing: false, connected: !!apiKeys.ollama_host }
  });

  // Supabase states
  const [sbUrl, setSbUrl] = useState(supabaseConfig.url || '');
  const [sbKey, setSbKey] = useState(supabaseConfig.anonKey || '');
  const [isTestingSb, setIsTestingSb] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // RAG params
  const [chunkSize, setChunkSize] = useState(ragParams.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(ragParams.chunkOverlap);
  const [topK, setTopK] = useState(ragParams.topK);
  const [minThreshold, setMinThreshold] = useState(ragParams.minThreshold);
  const [savedRagNotification, setSavedRagNotification] = useState(false);
  const [isSavingProfileKeys, setIsSavingProfileKeys] = useState(false);
  const [profileKeysSaveMsg, setProfileKeysSaveMsg] = useState<{ success: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const toggleShowKey = (field: string) => {
    setShowKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSaveAllToProfile = async () => {
    setIsSavingProfileKeys(true);
    setProfileKeysSaveMsg(null);
    onSaveApiKeys(keysForm);

    if (currentUser) {
      const ok = await saveProfileApiKeys(currentUser.id, keysForm);
      setIsSavingProfileKeys(false);
      if (ok) {
        setProfileKeysSaveMsg({ success: true, text: 'Chaves salvas no seu perfil do Supabase com sucesso!' });
      } else {
        setProfileKeysSaveMsg({ success: false, text: 'Falha ao salvar chaves no Supabase. Verifique suas tabelas ou permissões RLS.' });
      }
    } else {
      setIsSavingProfileKeys(false);
      setProfileKeysSaveMsg({ success: true, text: 'Chaves salvas localmente neste navegador.' });
    }
    setTimeout(() => setProfileKeysSaveMsg(null), 4000);
  };

  // Connect & Test Single Provider Key
  const handleConnectProvider = async (provider: AIProvider) => {
    setStatusByProvider(prev => ({
      ...prev,
      [provider]: { testing: true, message: 'Verificando conexão...' }
    }));

    let keyToSend = '';
    if (provider === 'openrouter') keyToSend = (keysForm.openrouter_api_key || '').trim();
    if (provider === 'gemini') keyToSend = (keysForm.gemini_api_key || '').trim();
    if (provider === 'openai') keyToSend = (keysForm.openai_api_key || '').trim();
    if (provider === 'anthropic') keyToSend = (keysForm.anthropic_api_key || '').trim();
    if (provider === 'groq') keyToSend = (keysForm.groq_api_key || '').trim();

    if (provider !== 'ollama' && !keyToSend) {
      setStatusByProvider(prev => ({
        ...prev,
        [provider]: {
          testing: false,
          connected: false,
          message: 'Por favor, insira a chave da API antes de testar.'
        }
      }));
      return;
    }

    // Direct Browser Client Validation for OpenRouter
    if (provider === 'openrouter' && keyToSend) {
      try {
        const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            Authorization: `Bearer ${keyToSend}`,
            'HTTP-Referer': 'https://notebooklm.app',
            'X-Title': 'NotebookLM Pro'
          }
        });
        if (resp.ok) {
          const keyData: any = await resp.json().catch(() => ({}));
          const label = keyData.data?.label || '';
          const limit = keyData.data?.limit !== null && keyData.data?.limit !== undefined ? ` (Crédito: $${keyData.data.limit})` : '';
          setStatusByProvider(prev => ({
            ...prev,
            openrouter: {
              testing: false,
              connected: true,
              message: `OpenRouter conectada com sucesso! ${label}${limit}`
            }
          }));
          onSaveApiKeys(keysForm);
          if (currentUser) {
            saveProfileApiKeys(currentUser.id, keysForm);
          }
          return;
        } else {
          // Fallback to checking models endpoint
          const modelsResp = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { Authorization: `Bearer ${keyToSend}` }
          });
          if (modelsResp.ok) {
            setStatusByProvider(prev => ({
              ...prev,
              openrouter: {
                testing: false,
                connected: true,
                message: 'OpenRouter conectada com sucesso! Modelos liberados.'
              }
            }));
            onSaveApiKeys(keysForm);
            if (currentUser) {
              saveProfileApiKeys(currentUser.id, keysForm);
            }
            return;
          }
          const err = await resp.json().catch(() => ({}));
          setStatusByProvider(prev => ({
            ...prev,
            openrouter: {
              testing: false,
              connected: false,
              message: err.error?.message || `Chave OpenRouter inválida (HTTP ${resp.status})`
            }
          }));
          return;
        }
      } catch (directErr) {
        console.warn('Direct OpenRouter validation fallback to server:', directErr);
      }
    }

    // Direct Browser Client Validation for Groq (Instant, 0 Latency)
    if (provider === 'groq' && keyToSend) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${keyToSend}` }
        });
        if (resp.ok) {
          const data: any = await resp.json();
          setStatusByProvider(prev => ({
            ...prev,
            groq: {
              testing: false,
              connected: true,
              message: `Groq conectada com sucesso! ${data.data?.length || 0} modelos detectados.`
            }
          }));
          onSaveApiKeys(keysForm);
          if (currentUser) {
            saveProfileApiKeys(currentUser.id, keysForm);
          }
          return;
        } else {
          const err = await resp.json().catch(() => ({}));
          setStatusByProvider(prev => ({
            ...prev,
            groq: {
              testing: false,
              connected: false,
              message: err.error?.message || `Chave Groq inválida (HTTP ${resp.status})`
            }
          }));
          return;
        }
      } catch (directErr) {
        console.warn('Direct Groq validation fallback to server:', directErr);
      }
    }

    // Direct Browser Client Validation for OpenAI
    if (provider === 'openai' && keyToSend) {
      try {
        const resp = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${keyToSend}` }
        });
        if (resp.ok) {
          const data: any = await resp.json();
          setStatusByProvider(prev => ({
            ...prev,
            openai: {
              testing: false,
              connected: true,
              message: `OpenAI conectada com sucesso! ${data.data?.length || 0} modelos detectados.`
            }
          }));
          onSaveApiKeys(keysForm);
          if (currentUser) {
            saveProfileApiKeys(currentUser.id, keysForm);
          }
          return;
        } else {
          const err = await resp.json().catch(() => ({}));
          setStatusByProvider(prev => ({
            ...prev,
            openai: {
              testing: false,
              connected: false,
              message: err.error?.message || `Chave OpenAI inválida (HTTP ${resp.status})`
            }
          }));
          return;
        }
      } catch (directErr) {
        console.warn('Direct OpenAI validation fallback to server:', directErr);
      }
    }

    // Server-side fallback validation via /api/test-key
    try {
      const data = await apiFetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: keyToSend,
          ollamaHost: keysForm.ollama_host
        })
      });

      if (data.success) {
        setStatusByProvider(prev => ({
          ...prev,
          [provider]: {
            testing: false,
            connected: true,
            message: data.message || 'Conectado com sucesso!'
          }
        }));

        // Automatically persist in parent & local storage & Supabase profile
        onSaveApiKeys(keysForm);
        if (currentUser) {
          saveProfileApiKeys(currentUser.id, keysForm);
        }
      } else {
        setStatusByProvider(prev => ({
          ...prev,
          [provider]: {
            testing: false,
            connected: false,
            message: data.message || 'Falha na validação da chave.'
          }
        }));
      }
    } catch (err: any) {
      setStatusByProvider(prev => ({
        ...prev,
        [provider]: {
          testing: false,
          connected: false,
          message: err.message || 'Erro ao validar chave.'
        }
      }));
    }
  };

  const handleClearKey = (field: keyof UserApiKeys, provider: string) => {
    const updated = { ...keysForm, [field]: '' };
    setKeysForm(updated);
    onSaveApiKeys(updated);
    setStatusByProvider(prev => ({
      ...prev,
      [provider]: { testing: false, connected: false, message: 'Chave desconectada.' }
    }));
  };

  const handleTestSupabase = async () => {
    if (!sbUrl || !sbKey) {
      setSbTestResult({ success: false, message: 'Preencha a URL e a Anon Key do Supabase.' });
      return;
    }
    setIsTestingSb(true);
    setSbTestResult(null);
    const res = await testSupabaseConnection(sbUrl, sbKey);
    setSbTestResult(res);
    setIsTestingSb(false);

    if (res.success) {
      onSaveSupabaseConfig({
        url: sbUrl,
        anonKey: sbKey,
        connected: true,
        autoSync: true
      });
    }
  };

  const handleSaveRag = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRagParams({
      chunkSize: Number(chunkSize),
      chunkOverlap: Number(chunkOverlap),
      topK: Number(topK),
      minThreshold: Number(minThreshold)
    });
    setSavedRagNotification(true);
    setTimeout(() => setSavedRagNotification(false), 2500);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-2xs">
              <PlugZap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 leading-tight">Painel de Chaves & Conexões</h3>
              <p className="text-xs text-stone-600">Conecte seus provedores de IA, banco de dados e calibre o RAG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 bg-stone-100/60 px-4 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'apikeys'
                ? 'border-stone-900 text-stone-900 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-blue-600" />
            1. Provedores de IA & Conectar Chaves
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'supabase'
                ? 'border-stone-900 text-stone-900 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            2. Supabase & Pgvector
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'rag'
                ? 'border-stone-900 text-stone-900 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            3. RAG & Economia de Tokens
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: API KEYS & DIRECT CONNECT */}
          {activeTab === 'apikeys' && (
            <div className="space-y-4">
              {/* Supabase Profile Sync Banner */}
              {currentUser ? (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-950">Sincronização em Nuvem (Supabase Profile)</span>
                        <span className="text-[10px] bg-emerald-200/70 text-emerald-900 font-semibold px-2 py-0.2 rounded-full">Ativo</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-tight mt-0.5">
                        Conectado como <strong className="font-mono">{currentUser.email}</strong>. As chaves são salvas na sua conta do banco de dados na nuvem.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAllToProfile}
                    disabled={isSavingProfileKeys}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {isSavingProfileKeys ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Salvar no Profile Supabase</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <p className="text-xs text-amber-900">
                      Você está em modo local. Para persistir suas chaves no seu perfil do Supabase e sincronizar em qualquer dispositivo:
                    </p>
                  </div>
                  {onOpenAuthModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuthModal();
                      }}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                    >
                      <span>Entrar / Criar Conta</span>
                    </button>
                  )}
                </div>
              )}

              {profileKeysSaveMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  profileKeysSaveMsg.success ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-red-100 text-red-900 border border-red-300'
                }`}>
                  {profileKeysSaveMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />}
                  <span>{profileKeysSaveMsg.text}</span>
                </div>
              )}

              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Digite sua chave de API e clique em <strong>"Testar & Conectar"</strong>. O sistema realiza um handshake instantâneo com o provedor via proxy seguro no backend, validando a autenticação e liberando os modelos imediatamente no cabeçalho.
                </p>
              </div>

              {/* Provider Card 0: OpenRouter (Multi-Model Hub) */}
              <div className="p-3.5 border border-indigo-200/80 rounded-xl bg-indigo-50/20 space-y-2 hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span className="text-xs font-bold text-stone-900">OpenRouter (Multi-Modelos)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                      Claude 3.7, DeepSeek R1/V3, Llama 3.3, Gemini 2.5
                    </span>
                  </div>
                  <div>
                    {statusByProvider['openrouter']?.connected ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-500">Chave necessária</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys['openrouter'] ? 'text' : 'password'}
                      placeholder="sk-or-v1-..."
                      value={keysForm.openrouter_api_key || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, openrouter_api_key: e.target.value })}
                      className="w-full px-3 py-1.5 pr-8 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('openrouter')}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    >
                      {showKeys['openrouter'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectProvider('openrouter')}
                    disabled={statusByProvider['openrouter']?.testing || !keysForm.openrouter_api_key}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {statusByProvider['openrouter']?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5 text-indigo-200" />
                    )}
                    Testar & Conectar
                  </button>

                  {keysForm.openrouter_api_key && (
                    <button
                      type="button"
                      onClick={() => handleClearKey('openrouter_api_key', 'openrouter')}
                      title="Desconectar chave"
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {statusByProvider['openrouter']?.message && (
                  <p className={`text-[11px] font-medium ${statusByProvider['openrouter']?.connected ? 'text-emerald-700' : 'text-red-600'}`}>
                    {statusByProvider['openrouter']?.message}
                  </p>
                )}
              </div>

              {/* Provider Card 1: Google Gemini */}
              <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 hover:border-stone-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-stone-900">Google Gemini</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      Flash 2.5 & Pro
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusByProvider['gemini']?.connected && (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys['gemini'] ? 'text' : 'password'}
                      placeholder="Chave customizada Gemini (opcional se configurada no ambiente)"
                      value={keysForm.gemini_api_key || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, gemini_api_key: e.target.value })}
                      className="w-full px-3 py-1.5 pr-8 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('gemini')}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    >
                      {showKeys['gemini'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectProvider('gemini')}
                    disabled={statusByProvider['gemini']?.testing}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {statusByProvider['gemini']?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    Testar & Conectar
                  </button>
                </div>

                {statusByProvider['gemini']?.message && (
                  <p className={`text-[11px] font-medium ${statusByProvider['gemini']?.connected ? 'text-emerald-700' : 'text-red-600'}`}>
                    {statusByProvider['gemini']?.message}
                  </p>
                )}
              </div>

              {/* Provider Card 2: OpenAI */}
              <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 hover:border-stone-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="text-xs font-bold text-stone-900">OpenAI</span>
                    <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-semibold">
                      GPT-4o, GPT-4o Mini, o1
                    </span>
                  </div>
                  <div>
                    {statusByProvider['openai']?.connected ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-500">Chave necessária</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys['openai'] ? 'text' : 'password'}
                      placeholder="sk-proj-..."
                      value={keysForm.openai_api_key || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, openai_api_key: e.target.value })}
                      className="w-full px-3 py-1.5 pr-8 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('openai')}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    >
                      {showKeys['openai'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectProvider('openai')}
                    disabled={statusByProvider['openai']?.testing || !keysForm.openai_api_key}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {statusByProvider['openai']?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    Testar & Conectar
                  </button>

                  {keysForm.openai_api_key && (
                    <button
                      type="button"
                      onClick={() => handleClearKey('openai_api_key', 'openai')}
                      title="Desconectar chave"
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {statusByProvider['openai']?.message && (
                  <p className={`text-[11px] font-medium ${statusByProvider['openai']?.connected ? 'text-emerald-700' : 'text-red-600'}`}>
                    {statusByProvider['openai']?.message}
                  </p>
                )}
              </div>

              {/* Provider Card 3: Anthropic */}
              <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 hover:border-stone-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                    <span className="text-xs font-bold text-stone-900">Anthropic (Claude)</span>
                    <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                      Claude 3.5 Sonnet & Haiku
                    </span>
                  </div>
                  <div>
                    {statusByProvider['anthropic']?.connected ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-500">Chave necessária</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys['anthropic'] ? 'text' : 'password'}
                      placeholder="sk-ant-api03-..."
                      value={keysForm.anthropic_api_key || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, anthropic_api_key: e.target.value })}
                      className="w-full px-3 py-1.5 pr-8 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('anthropic')}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    >
                      {showKeys['anthropic'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectProvider('anthropic')}
                    disabled={statusByProvider['anthropic']?.testing || !keysForm.anthropic_api_key}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {statusByProvider['anthropic']?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    Testar & Conectar
                  </button>

                  {keysForm.anthropic_api_key && (
                    <button
                      type="button"
                      onClick={() => handleClearKey('anthropic_api_key', 'anthropic')}
                      title="Desconectar chave"
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {statusByProvider['anthropic']?.message && (
                  <p className={`text-[11px] font-medium ${statusByProvider['anthropic']?.connected ? 'text-emerald-700' : 'text-red-600'}`}>
                    {statusByProvider['anthropic']?.message}
                  </p>
                )}
              </div>

              {/* Provider Card 4: Groq */}
              <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 hover:border-stone-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-bold text-stone-900">Groq (LPUs)</span>
                    <span className="text-[10px] bg-orange-50 text-orange-800 px-2 py-0.5 rounded-full font-semibold">
                      Llama 3.3 70B & 8B
                    </span>
                  </div>
                  <div>
                    {statusByProvider['groq']?.connected ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-500">Chave necessária</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys['groq'] ? 'text' : 'password'}
                      placeholder="gsk_..."
                      value={keysForm.groq_api_key || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, groq_api_key: e.target.value })}
                      className="w-full px-3 py-1.5 pr-8 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('groq')}
                      className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    >
                      {showKeys['groq'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectProvider('groq')}
                    disabled={statusByProvider['groq']?.testing || !keysForm.groq_api_key}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {statusByProvider['groq']?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    Testar & Conectar
                  </button>

                  {keysForm.groq_api_key && (
                    <button
                      type="button"
                      onClick={() => handleClearKey('groq_api_key', 'groq')}
                      title="Desconectar chave"
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {statusByProvider['groq']?.message && (
                  <p className={`text-[11px] font-medium ${statusByProvider['groq']?.connected ? 'text-emerald-700' : 'text-red-600'}`}>
                    {statusByProvider['groq']?.message}
                  </p>
                )}
              </div>

              {/* Provider Card 5: Ollama (Local) */}
              <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 hover:border-stone-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span className="text-xs font-bold text-stone-900">Ollama (Modelos Locais)</span>
                    <span className="text-[10px] bg-purple-50 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                      Llama 3, DeepSeek R1, Mistral
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="http://localhost:11434"
                    value={keysForm.ollama_host || 'http://localhost:11434'}
                    onChange={(e) => setKeysForm({ ...keysForm, ollama_host: e.target.value })}
                    className="flex-1 px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />

                  <button
                    type="button"
                    onClick={() => handleConnectProvider('ollama')}
                    disabled={statusByProvider['ollama']?.testing}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    {statusByProvider['ollama']?.testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    Testar Conexão Local
                  </button>
                </div>

                {statusByProvider['ollama']?.message && (
                  <p className={`text-[11px] font-medium ${statusByProvider['ollama']?.connected ? 'text-emerald-700' : 'text-stone-600'}`}>
                    {statusByProvider['ollama']?.message}
                  </p>
                )}
              </div>

              {/* Bottom Quick Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-stone-200">
                <span className="text-[11px] text-stone-500">
                  {currentUser ? 'Chaves salvas automaticamente no seu perfil do Supabase.' : 'Chaves salvas localmente neste navegador.'}
                </span>
                <div className="flex items-center gap-2 justify-end">
                  {currentUser && (
                    <button
                      type="button"
                      onClick={handleSaveAllToProfile}
                      disabled={isSavingProfileKeys}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      {isSavingProfileKeys ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Salvar no Supabase</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onSaveApiKeys(keysForm);
                      if (currentUser) {
                        saveProfileApiKeys(currentUser.id, keysForm);
                      }
                      onClose();
                    }}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Concluir & Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUPABASE & SQL */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Conecte seu projeto Supabase para persistência remota e execução de busca vetorial nativa via função <code className="font-mono bg-emerald-100/70 px-1 rounded">match_document_chunks</code> e pgvector.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://seu-projeto.supabase.co"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Supabase Anon / Public Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>
              </div>

              {/* User Session & RLS Status */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900">Sessão Supabase (RLS):</span>
                    {currentUser ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Autenticado: {currentUser.email}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                        Não autenticado (Login Obrigatório para RLS)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    O RLS exige <code className="font-mono bg-stone-200/70 px-1 rounded text-[10px]">auth.uid() = user_id</code> para salvar e listar cadernos.
                  </p>
                </div>

                {onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuthModal();
                    }}
                    className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shrink-0 shadow-2xs transition-colors"
                  >
                    {currentUser ? 'Gerenciar Conta / Sair' : 'Entrar / Criar Conta'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={isTestingSb || !sbUrl || !sbKey}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {isTestingSb ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Testar & Conectar Supabase
                </button>

                {supabaseConfig.connected && onSyncWithSupabase && (
                  <button
                    type="button"
                    onClick={onSyncWithSupabase}
                    className="px-3.5 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-medium transition-colors"
                  >
                    Sincronizar Caderno Atual
                  </button>
                )}
              </div>

              {sbTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    sbTestResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {sbTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  )}
                  <span>{sbTestResult.message}</span>
                </div>
              )}

              {/* SQL Schema Inspector */}
              <div className="pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-stone-800">
                    Script SQL do Banco (pgvector, tabelas, RLS e RPC)
                  </span>
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedSql ? 'Copiado!' : 'Copiar Script SQL'}
                  </button>
                </div>
                <pre className="bg-stone-900 text-stone-200 p-3 rounded-xl text-[11px] font-mono max-h-40 overflow-y-auto leading-relaxed">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: RAG PARAMETERS */}
          {activeTab === 'rag' && (
            <form onSubmit={handleSaveRag} className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Calibre a granularidade do particionamento textual e a quantidade de trechos injetados no prompt final para balancear precisão semântica e economia de tokens.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Tamanho do Chunk (Caracteres)
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={2000}
                    step={50}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Recomendado: 500 a 750 caracteres para preservar a coerência das frases.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Sobreposição (Overlap em Caracteres)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    step={20}
                    value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Garante que ideias entre parágrafos não sejam cortadas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Top K Chunks Recuperados
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Número máximo de trechos mais relevantes enviados ao LLM (Padrão: 5).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Limiar de Similaridade Mínima (0 a 1)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Trechos com pontuação abaixo deste limite são descartados para economizar tokens.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                {savedRagNotification ? (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Parâmetros de RAG atualizados!
                  </span>
                ) : (
                  <span className="text-[11px] text-stone-500">Afeta novos documentos e buscas.</span>
                )}

                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" /> Salvar Parâmetros
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
