import React, { useState, useEffect, useCallback } from 'react';
import { 
  AIProvider, 
  ModelOption, 
  Notebook, 
  NotebookDocument, 
  QuickNote, 
  ChatMessage, 
  UserApiKeys, 
  SupabaseConfig 
} from './types';
import { sampleNotebook } from './data/seedData';
import { hybridRetrieveChunks } from './lib/ragEngine';
import { 
  getSupabase, 
  searchChunksViaSupabase, 
  ensureUserProfile, 
  loadProfileApiKeys, 
  saveProfileApiKeys, 
  fetchUserNotebooks, 
  persistNotebookToSupabase, 
  deleteNotebookFromSupabase, 
  persistDocumentToSupabase, 
  deleteDocumentFromSupabase, 
  persistNoteAsDocument, 
  deleteNoteFromSupabase, 
  fetchChatMessagesFromSupabase, 
  persistChatMessageToSupabase, 
  clearChatMessagesFromSupabase, 
  syncFullNotebook 
} from './lib/supabaseClient';
import { generateUUID, ensureUUID } from './lib/uuid';
import { apiFetch } from './lib/apiHelper';
import { User } from '@supabase/supabase-js';
import { Header } from './components/Header';
import { SourcesPanel } from './components/SourcesPanel';
import { ChatPanel } from './components/ChatPanel';
import { StudioPanel } from './components/StudioPanel';
import { AddSourceModal } from './components/AddSourceModal';
import { AddNoteModal } from './components/AddNoteModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { SettingsModal } from './components/SettingsModal';
import { SupabaseAuthModal } from './components/SupabaseAuthModal';

const DEFAULT_MODELS: Record<AIProvider, ModelOption[]> = {
  gemini: [
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Rápido & Inteligente)', recommended: true },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Alta Capacidade)', recommended: false },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', recommended: false },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', recommended: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', recommended: true },
    { id: 'o3-mini', name: 'o3-mini', recommended: false },
    { id: 'o1', name: 'o1', recommended: false },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', recommended: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', recommended: true },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', recommended: false },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', recommended: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', recommended: true },
  ],
  ollama: [
    { id: 'llama3:latest', name: 'Llama 3 (Local)', recommended: true },
    { id: 'mistral:latest', name: 'Mistral (Local)', recommended: false },
    { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Local)', recommended: false },
  ],
};

export default function App() {
  // Notebooks state (with UUID sanitization)
  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    try {
      const saved = localStorage.getItem('notebooklm_notebooks');
      if (saved) {
        const parsed: Notebook[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(nb => ({
            ...nb,
            id: ensureUUID(nb.id),
            documents: (nb.documents || []).map(d => ({
              ...d,
              id: ensureUUID(d.id),
              notebook_id: ensureUUID(nb.id),
              chunks: (d.chunks || []).map(c => ({
                ...c,
                id: ensureUUID(c.id),
                document_id: ensureUUID(d.id)
              }))
            })),
            notes: (nb.notes || []).map(n => ({
              ...n,
              id: ensureUUID(n.id),
              notebook_id: ensureUUID(nb.id)
            }))
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to load notebooks from localStorage', e);
    }
    return [sampleNotebook];
  });

  const [activeNotebookId, setActiveNotebookId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem('notebooklm_active_id');
      if (savedId && notebooks.some(n => n.id === savedId)) return savedId;
    } catch (e) {}
    return notebooks[0]?.id || sampleNotebook.id;
  });

  // Active notebook helper
  const activeNotebook = notebooks.find(n => n.id === activeNotebookId) || notebooks[0] || sampleNotebook;

  // Save notebooks to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('notebooklm_notebooks', JSON.stringify(notebooks));
      localStorage.setItem('notebooklm_active_id', activeNotebookId);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [notebooks, activeNotebookId]);

  // Supabase Auth & User state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncingWithSupabase, setIsSyncingWithSupabase] = useState(false);

  // AI Providers & Models state
  const [activeProvider, setActiveProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem('notebooklm_provider') as AIProvider) || 'gemini';
  });
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(DEFAULT_MODELS[activeProvider]);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODELS[activeProvider][0]?.id || 'gemini-3.6-flash');
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<UserApiKeys>(() => {
    try {
      const saved = localStorage.getItem('notebooklm_api_keys');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      ollama_host: 'http://localhost:11434'
    };
  });

  // Supabase Config state
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => {
    try {
      const saved = localStorage.getItem('notebooklm_supabase_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      url: (typeof window !== 'undefined' ? localStorage.getItem('notebooklm_supabase_url') : '') || '',
      anonKey: (typeof window !== 'undefined' ? localStorage.getItem('notebooklm_supabase_anon_key') : '') || '',
      connected: false,
      autoSync: false
    };
  });

  // RAG parameters state
  const [ragParams, setRagParams] = useState({
    chunkSize: 650,
    chunkOverlap: 100,
    topK: 5,
    minThreshold: 0.20
  });

  // Chat messages per notebook
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('notebooklm_chat_histories');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const activeMessages = chatHistories[activeNotebook.id] || [];

  useEffect(() => {
    try {
      localStorage.setItem('notebooklm_chat_histories', JSON.stringify(chatHistories));
    } catch (e) {}
  }, [chatHistories]);

  // UI state
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<NotebookDocument | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInputText, setChatInputText] = useState('');

  // Supabase Auth listener & auto-sync
  const handleUserAuthenticated = useCallback(async (user: User) => {
    try {
      setIsSyncingWithSupabase(true);
      await ensureUserProfile(user);

      // 1. Load and sync saved API keys with profile
      const savedKeys = await loadProfileApiKeys(user.id);
      if (savedKeys && (savedKeys.openai_api_key || savedKeys.anthropic_api_key || savedKeys.gemini_api_key || savedKeys.groq_api_key || savedKeys.ollama_host)) {
        setApiKeys(prev => {
          const merged: UserApiKeys = {
            openai_api_key: savedKeys.openai_api_key || prev.openai_api_key,
            anthropic_api_key: savedKeys.anthropic_api_key || prev.anthropic_api_key,
            gemini_api_key: savedKeys.gemini_api_key || prev.gemini_api_key,
            groq_api_key: savedKeys.groq_api_key || prev.groq_api_key,
            ollama_host: savedKeys.ollama_host || prev.ollama_host
          };
          try {
            localStorage.setItem('notebooklm_api_keys', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      } else {
        // If profile didn't have keys yet, persist current active local keys to profile
        setApiKeys(currentKeys => {
          if (currentKeys.openai_api_key || currentKeys.anthropic_api_key || currentKeys.gemini_api_key || currentKeys.groq_api_key) {
            saveProfileApiKeys(user.id, currentKeys);
          }
          return currentKeys;
        });
      }

      // 2. Fetch remote notebooks from Supabase
      const remoteNotebooks = await fetchUserNotebooks(user.id);
      if (remoteNotebooks.length > 0) {
        setNotebooks(remoteNotebooks);
        setActiveNotebookId(remoteNotebooks[0].id);

        // Fetch chat messages for active notebook
        const msgs = await fetchChatMessagesFromSupabase(remoteNotebooks[0].id);
        if (msgs && msgs.length > 0) {
          setChatHistories(prev => ({ ...prev, [remoteNotebooks[0].id]: msgs }));
        }
      } else {
        // User has no notebooks in Supabase yet.
        // Persist the current local notebook(s) so their initial workspace is in the database!
        for (const nb of notebooks) {
          await persistNotebookToSupabase(nb, user.id);
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar com usuário autenticado:', err);
    } finally {
      setIsSyncingWithSupabase(false);
    }
  }, [notebooks]);

  // Listen to Supabase Auth State
  useEffect(() => {
    const sb = getSupabase(supabaseConfig.url, supabaseConfig.anonKey);
    if (!sb) {
      setCurrentUser(null);
      return;
    }

    // Check existing session
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        await handleUserAuthenticated(session.user);
      } else {
        setCurrentUser(null);
      }
    }).catch(e => console.warn('Supabase getSession error:', e));

    // Subscribe to auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          await handleUserAuthenticated(session.user);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseConfig.url, supabaseConfig.anonKey, handleUserAuthenticated]);

  // Load chat messages when active notebook changes and user is logged in
  useEffect(() => {
    if (currentUser && activeNotebookId) {
      fetchChatMessagesFromSupabase(activeNotebookId).then(msgs => {
        if (msgs && msgs.length > 0) {
          setChatHistories(prev => ({ ...prev, [activeNotebookId]: msgs }));
        }
      }).catch(e => console.warn('Erro ao carregar mensagens do Supabase:', e));
    }
  }, [activeNotebookId, currentUser]);

  // Update available models when provider changes
  const refreshModelsForProvider = useCallback(async (provider: AIProvider, currentKeys: UserApiKeys) => {
    setIsLoadingModels(true);
    let keyToUse = '';
    if (provider === 'gemini') keyToUse = currentKeys.gemini_api_key || '';
    if (provider === 'openai') keyToUse = currentKeys.openai_api_key || '';
    if (provider === 'anthropic') keyToUse = currentKeys.anthropic_api_key || '';
    if (provider === 'groq') keyToUse = currentKeys.groq_api_key || '';

    try {
      const data = await apiFetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: keyToUse,
          ollamaHost: currentKeys.ollama_host
        })
      });

      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        // Set recommended or first model
        const recommended = data.models.find((m: ModelOption) => m.recommended) || data.models[0];
        setSelectedModel(recommended.id);
        return;
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic models, using defaults:', err);
    } finally {
      setIsLoadingModels(false);
    }

    // Fallback to defaults
    const fallback = DEFAULT_MODELS[provider];
    setAvailableModels(fallback);
    setSelectedModel(fallback[0]?.id || '');
  }, []);

  const handleSelectProvider = (provider: AIProvider) => {
    setActiveProvider(provider);
    localStorage.setItem('notebooklm_provider', provider);
    refreshModelsForProvider(provider, apiKeys);
  };

  // Notebook operations
  const handleCreateNotebook = async () => {
    const newId = generateUUID();
    const newNotebook: Notebook = {
      id: newId,
      title: `Novo Caderno #${notebooks.length + 1}`,
      description: 'Caderno de anotações e documentos para RAG.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      documents: [],
      notes: []
    };
    setNotebooks(prev => [newNotebook, ...prev]);
    setActiveNotebookId(newId);

    if (currentUser) {
      persistNotebookToSupabase(newNotebook, currentUser.id).catch(err => {
        console.warn('Erro ao persistir novo caderno no Supabase:', err);
      });
    }
  };

  const handleRenameNotebook = async (id: string, newTitle: string) => {
    const now = new Date().toISOString();
    let updatedNb: Notebook | null = null;
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === id) {
        updatedNb = { ...nb, title: newTitle, updated_at: now };
        return updatedNb;
      }
      return nb;
    }));

    if (currentUser && updatedNb) {
      persistNotebookToSupabase(updatedNb, currentUser.id).catch(err => {
        console.warn('Erro ao atualizar nome do caderno no Supabase:', err);
      });
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    let remaining = notebooks.filter(nb => nb.id !== id);
    
    // Se o usuário deletou todos os cadernos, cria um novo vazio
    if (remaining.length === 0) {
      const freshNotebook: Notebook = {
        id: generateUUID(),
        title: 'Meu Caderno',
        description: 'Caderno de anotações e documentos para RAG.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        documents: [],
        notes: []
      };
      remaining = [freshNotebook];
      if (currentUser) {
        persistNotebookToSupabase(freshNotebook, currentUser.id).catch(err => {
          console.warn('Erro ao criar caderno inicial no Supabase:', err);
        });
      }
    }

    setNotebooks(remaining);
    if (activeNotebookId === id) {
      setActiveNotebookId(remaining[0].id);
    }

    if (currentUser) {
      deleteNotebookFromSupabase(id).catch(err => {
        console.warn('Erro ao deletar caderno no Supabase:', err);
      });
    }
  };

  // Document operations
  const handleAddDocument = async (newDoc: NotebookDocument) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebook.id) {
        return {
          ...nb,
          documents: [newDoc, ...nb.documents],
          updated_at: new Date().toISOString()
        };
      }
      return nb;
    }));

    if (currentUser) {
      persistDocumentToSupabase(newDoc, activeNotebook.id).catch(err => {
        console.warn('Erro ao persistir documento no Supabase:', err);
      });
    }
  };

  const handleToggleDocumentRag = (docId: string) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebook.id) {
        return {
          ...nb,
          documents: nb.documents.map(d => d.id === docId ? { ...d, enabledInRag: !d.enabledInRag } : d)
        };
      }
      return nb;
    }));
  };

  const handleToggleAllDocumentsRag = (enable: boolean) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebook.id) {
        return {
          ...nb,
          documents: nb.documents.map(d => ({ ...d, enabledInRag: enable }))
        };
      }
      return nb;
    }));
  };

  const handleDeleteDocument = async (docId: string) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebook.id) {
        return {
          ...nb,
          documents: nb.documents.filter(d => d.id !== docId)
        };
      }
      return nb;
    }));

    if (currentUser) {
      deleteDocumentFromSupabase(docId).catch(err => {
        console.warn('Erro ao deletar documento no Supabase:', err);
      });
    }
  };

  // Quick Notes operations
  const handleAddNote = async (newNote: QuickNote) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebook.id) {
        return {
          ...nb,
          notes: [newNote, ...nb.notes],
          updated_at: new Date().toISOString()
        };
      }
      return nb;
    }));

    if (currentUser) {
      persistNoteAsDocument(newNote, activeNotebook.id).catch(err => {
        console.warn('Erro ao persistir nota no Supabase:', err);
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebook.id) {
        return {
          ...nb,
          notes: nb.notes.filter(n => n.id !== noteId)
        };
      }
      return nb;
    }));

    if (currentUser) {
      deleteNoteFromSupabase(noteId).catch(err => {
        console.warn('Erro ao deletar nota no Supabase:', err);
      });
    }
  };

  // Save AI response as Quick Note
  const handleSaveAsNote = (title: string, content: string) => {
    const note: QuickNote = {
      id: generateUUID(),
      notebook_id: activeNotebook.id,
      title,
      content,
      created_at: new Date().toISOString()
    };
    handleAddNote(note);
    alert('Resposta salva com sucesso nas Notas Rápidas do caderno!');
  };

  // RAG Chat Send Handler
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: generateUUID(),
      notebook_id: activeNotebook.id,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };

    // Append user message immediately
    const updatedMessages = [...activeMessages, userMsg];
    setChatHistories(prev => ({ ...prev, [activeNotebook.id]: updatedMessages }));
    setIsChatLoading(true);

    if (currentUser) {
      persistChatMessageToSupabase(activeNotebook.id, userMsg).catch(err => {
        console.warn('Erro ao persistir mensagem do usuário no Supabase:', err);
      });
    }

    try {
      // 1. STEP 1: Generate Embedding for the query (or hybrid fallback)
      let queryVector: number[] | undefined = undefined;
      try {
        const embData = await apiFetch('/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: [userText],
            provider: activeProvider === 'gemini' ? 'gemini' : 'openai',
            apiKey: activeProvider === 'gemini' ? apiKeys.gemini_api_key : apiKeys.openai_api_key
          })
        });
        if (embData.embeddings && embData.embeddings[0]) {
          queryVector = embData.embeddings[0];
        }
      } catch (embErr) {
        console.warn('Embeddings error, falling back to keyword hybrid search:', embErr);
      }

      // 2. STEP 2: Pre-query Hybrid Retrieval from Active Enabled Documents
      let retrievedResults = hybridRetrieveChunks(
        userText,
        activeNotebook.documents,
        queryVector,
        ragParams.topK,
        ragParams.minThreshold
      );

      // If Supabase RPC is configured and returns results, blend or use them
      if (supabaseConfig.connected && queryVector) {
        try {
          const sbResults = await searchChunksViaSupabase(
            queryVector,
            activeNotebook.id,
            ragParams.minThreshold,
            ragParams.topK
          );
          if (sbResults && sbResults.length > 0) {
            console.log('Retrieved chunks from Supabase RPC:', sbResults.length);
          }
        } catch (sbErr) {
          console.warn('Supabase search warning:', sbErr);
        }
      }

      const formattedChunks = retrievedResults.map(r => ({
        id: r.chunk.id,
        documentId: r.document.id,
        documentName: r.document.name,
        content: r.chunk.content,
        similarity: r.similarity
      }));

      // 3. STEP 3: Dispatch to Server with Context Optimization
      let activeKey = '';
      if (activeProvider === 'gemini') activeKey = apiKeys.gemini_api_key || '';
      if (activeProvider === 'openai') activeKey = apiKeys.openai_api_key || '';
      if (activeProvider === 'anthropic') activeKey = apiKeys.anthropic_api_key || '';
      if (activeProvider === 'groq') activeKey = apiKeys.groq_api_key || '';

      const data = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          model: selectedModel,
          apiKey: activeKey,
          ollamaHost: apiKeys.ollama_host,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          retrievedChunks: formattedChunks,
          notebookTitle: activeNotebook.title
        })
      });

      const assistantMsg: ChatMessage = {
        id: generateUUID(),
        notebook_id: activeNotebook.id,
        role: 'assistant',
        content: data.content,
        sources: data.sources || [],
        tokensStats: data.tokensStats,
        providerUsed: data.provider || activeProvider,
        modelUsed: data.model || selectedModel,
        created_at: new Date().toISOString()
      };

      setChatHistories(prev => ({
        ...prev,
        [activeNotebook.id]: [...updatedMessages, assistantMsg]
      }));

      if (currentUser) {
        persistChatMessageToSupabase(activeNotebook.id, assistantMsg).catch(err => {
          console.warn('Erro ao persistir resposta da IA no Supabase:', err);
        });
      }
    } catch (chatError: any) {
      console.error('Chat error:', chatError);
      const errorMsg: ChatMessage = {
        id: generateUUID(),
        notebook_id: activeNotebook.id,
        role: 'assistant',
        content: `⚠️ **Erro durante a resposta da IA:**\n\n${chatError.message || 'Falha na conexão com o modelo.'}\n\n*Dica: Verifique no painel de Configurações se a chave de API do provedor selecionado (${activeProvider.toUpperCase()}) foi informada corretamente.*`,
        created_at: new Date().toISOString()
      };
      setChatHistories(prev => ({
        ...prev,
        [activeNotebook.id]: [...updatedMessages, errorMsg]
      }));
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Deseja limpar todo o histórico de mensagens deste caderno?')) {
      setChatHistories(prev => ({ ...prev, [activeNotebook.id]: [] }));
      if (currentUser) {
        clearChatMessagesFromSupabase(activeNotebook.id).catch(err => {
          console.warn('Erro ao limpar mensagens no Supabase:', err);
        });
      }
    }
  };

  const handleSaveApiKeys = async (newKeys: UserApiKeys) => {
    setApiKeys(newKeys);
    localStorage.setItem('notebooklm_api_keys', JSON.stringify(newKeys));
    refreshModelsForProvider(activeProvider, newKeys);

    if (currentUser) {
      await saveProfileApiKeys(currentUser.id, newKeys);
    }
  };

  const handleSaveSupabaseConfig = (newConfig: SupabaseConfig) => {
    setSupabaseConfig(newConfig);
    localStorage.setItem('notebooklm_supabase_config', JSON.stringify(newConfig));
    localStorage.setItem('notebooklm_supabase_url', newConfig.url);
    localStorage.setItem('notebooklm_supabase_anon_key', newConfig.anonKey);
  };

  // Sync active notebook to Supabase
  const handleSyncWithSupabase = async () => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      alert('Configure a URL e a Anon Key do Supabase nas configurações primeiro.');
      setIsSettingsOpen(true);
      return;
    }

    if (!currentUser) {
      setIsSettingsOpen(false);
      setIsAuthModalOpen(true);
      alert('Atenção: Seu banco possui políticas RLS (Row Level Security) ativas.\n\nPara salvar ou sincronizar os cadernos na tabela public.notebooks, é necessário fazer Login ou Criar uma Conta no Supabase. Abrindo a tela de autenticação...');
      return;
    }

    try {
      setIsSyncingWithSupabase(true);
      const success = await syncFullNotebook(activeNotebook, currentUser.id);
      if (success) {
        alert('Caderno, documentos e chunks sincronizados com sucesso no Supabase!');
      } else {
        alert('Ocorreu uma falha ao sincronizar o caderno com o Supabase. Verifique o console ou a conexão.');
      }
    } catch (err: any) {
      alert(`Falha na sincronização com Supabase: ${err.message}`);
    } finally {
      setIsSyncingWithSupabase(false);
    }
  };

  const isCurrentProviderConnected = 
    activeProvider === 'gemini' 
      ? true 
      : activeProvider === 'openai' 
      ? !!apiKeys.openai_api_key 
      : activeProvider === 'anthropic' 
      ? !!apiKeys.anthropic_api_key 
      : activeProvider === 'groq' 
      ? !!apiKeys.groq_api_key 
      : !!apiKeys.ollama_host;

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-stone-900 font-sans overflow-hidden antialiased">
      {/* 1. TOP FIXED HEADER */}
      <Header
        notebooks={notebooks}
        activeNotebook={activeNotebook}
        onSelectNotebook={(id) => setActiveNotebookId(id)}
        onCreateNotebook={handleCreateNotebook}
        onRenameNotebook={handleRenameNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        activeProvider={activeProvider}
        onSelectProvider={handleSelectProvider}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onSelectModel={(m) => setSelectedModel(m)}
        onRefreshModels={() => refreshModelsForProvider(activeProvider, apiKeys)}
        isLoadingModels={isLoadingModels}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isStudioOpen={isStudioOpen}
        onToggleStudio={() => setIsStudioOpen(!isStudioOpen)}
        hasGeminiKey={true} // Server has GEMINI_API_KEY
        hasOpenAiKey={!!apiKeys.openai_api_key}
        hasAnthropicKey={!!apiKeys.anthropic_api_key}
        hasGroqKey={!!apiKeys.groq_api_key}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isSupabaseConnected={supabaseConfig.connected || !!(supabaseConfig.url && supabaseConfig.anonKey)}
      />

      {/* RLS Persist Notification Banner when Supabase is configured but user is not logged in */}
      {!currentUser && (supabaseConfig.connected || (supabaseConfig.url && supabaseConfig.anonKey)) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0 z-10 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>
              <strong>Persistência no Supabase:</strong> Seu banco possui Row Level Security (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-950">auth.uid() = user_id</code>). Para que seus cadernos, fontes e notas fiquem gravados permanentemente na nuvem, faça login com sua conta.
            </span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="ml-3 px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-md font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
          >
            Entrar ou Criar Conta
          </button>
        </div>
      )}

      {/* 2. THREE COLUMNS MAIN BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Sources & Notes */}
        <div className="w-72 md:w-80 lg:w-88 shrink-0 h-full border-r border-stone-200">
          <SourcesPanel
            documents={activeNotebook.documents}
            notes={activeNotebook.notes}
            onToggleDocumentRag={handleToggleDocumentRag}
            onToggleAllDocumentsRag={handleToggleAllDocumentsRag}
            onOpenAddSource={() => setIsAddSourceOpen(true)}
            onOpenAddNote={() => setIsAddNoteOpen(true)}
            onViewDocument={(doc) => setViewingDocument(doc)}
            onDeleteDocument={handleDeleteDocument}
            onDeleteNote={handleDeleteNote}
            onInsertNoteToChat={(text) => {
              setChatInputText(text);
            }}
          />
        </div>

        {/* Central Column: Interactive RAG Chat */}
        <ChatPanel
          messages={activeMessages}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
          activeNotebookTitle={activeNotebook.title}
          activeDocuments={activeNotebook.documents}
          activeProvider={activeProvider}
          selectedModel={selectedModel}
          onClearChat={handleClearChat}
          onSaveAsNote={handleSaveAsNote}
          inputText={chatInputText}
          setInputText={setChatInputText}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isCurrentProviderConnected={isCurrentProviderConnected}
        />

        {/* Right Column: Studio Panel (NotebookLM Audio Overview, Study Guide, FAQ) */}
        {isStudioOpen && (
          <StudioPanel
            isOpen={isStudioOpen}
            onClose={() => setIsStudioOpen(false)}
            notebookTitle={activeNotebook.title}
            documents={activeNotebook.documents}
            activeProvider={activeProvider}
            apiKey={
              activeProvider === 'groq'
                ? apiKeys.groq_api_key
                : activeProvider === 'openai'
                ? apiKeys.openai_api_key
                : activeProvider === 'anthropic'
                ? apiKeys.anthropic_api_key
                : apiKeys.gemini_api_key
            }
            geminiApiKey={apiKeys.gemini_api_key}
            onSaveAsNote={handleSaveAsNote}
          />
        )}
      </div>

      {/* 3. MODALS */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        notebookId={activeNotebook.id}
        onAddDocument={handleAddDocument}
        geminiApiKey={apiKeys.gemini_api_key}
      />

      <AddNoteModal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        notebookId={activeNotebook.id}
        onAddNote={handleAddNote}
      />

      <DocumentViewerModal
        document={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveApiKeys={handleSaveApiKeys}
        supabaseConfig={supabaseConfig}
        onSaveSupabaseConfig={handleSaveSupabaseConfig}
        currentNotebook={activeNotebook}
        onSyncWithSupabase={handleSyncWithSupabase}
        ragParams={ragParams}
        onSaveRagParams={setRagParams}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <SupabaseAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={async (user) => {
          setCurrentUser(user);
          await handleUserAuthenticated(user);
        }}
        onSignOut={() => {
          setCurrentUser(null);
        }}
        onSyncLocalData={handleSyncWithSupabase}
      />
    </div>
  );
}
