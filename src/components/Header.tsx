import React, { useState } from 'react';
import { 
  BookOpen, 
  ChevronDown, 
  Plus, 
  Settings, 
  Sparkles, 
  Zap, 
  Trash2, 
  Edit3, 
  Check, 
  RefreshCw,
  Sliders,
  Layers,
  FileText,
  Key,
  PlugZap,
  CheckCircle2,
  AlertTriangle,
  Cloud
} from 'lucide-react';
import { AIProvider, ModelOption, Notebook } from '../types';
import { User } from '@supabase/supabase-js';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface HeaderProps {
  notebooks: Notebook[];
  activeNotebook: Notebook;
  onSelectNotebook: (id: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (id: string, newTitle: string) => void;
  onDeleteNotebook: (id: string) => void;
  
  activeProvider: AIProvider;
  onSelectProvider: (provider: AIProvider) => void;
  
  availableModels: ModelOption[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onRefreshModels: () => void;
  isLoadingModels: boolean;
  
  onOpenSettings: () => void;
  isStudioOpen: boolean;
  onToggleStudio: () => void;

  hasGeminiKey: boolean;
  hasOpenAiKey: boolean;
  hasAnthropicKey: boolean;
  hasGroqKey: boolean;

  currentUser?: User | null;
  onOpenAuthModal?: () => void;
  isSupabaseConnected?: boolean;
}

const PROVIDER_NAMES: Record<AIProvider, { label: string; badge: string; color: string }> = {
  gemini: { label: 'Google Gemini', badge: 'Gemini', color: 'bg-blue-600 text-white' },
  openai: { label: 'OpenAI', badge: 'GPT', color: 'bg-emerald-600 text-white' },
  anthropic: { label: 'Anthropic Claude', badge: 'Claude', color: 'bg-amber-600 text-white' },
  groq: { label: 'Groq LPUs', badge: 'Groq Fast', color: 'bg-orange-600 text-white' },
  ollama: { label: 'Ollama (Local)', badge: 'Local', color: 'bg-purple-600 text-white' },
};

export const Header: React.FC<HeaderProps> = ({
  notebooks,
  activeNotebook,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  activeProvider,
  onSelectProvider,
  availableModels,
  selectedModel,
  onSelectModel,
  onRefreshModels,
  isLoadingModels,
  onOpenSettings,
  isStudioOpen,
  onToggleStudio,
  hasGeminiKey,
  hasOpenAiKey,
  hasAnthropicKey,
  hasGroqKey,
  currentUser,
  onOpenAuthModal,
  isSupabaseConnected
}) => {
  const [isNotebookDropdownOpen, setIsNotebookDropdownOpen] = useState(false);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [notebookToDelete, setNotebookToDelete] = useState<Notebook | null>(null);

  const startRename = (nb: Notebook, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNotebookId(nb.id);
    setEditTitle(nb.title);
  };

  const saveRename = (id: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      onRenameNotebook(id, editTitle.trim());
    }
    setEditingNotebookId(null);
  };

  // Provider status indicator
  const isCurrentProviderConfigured = 
    (activeProvider === 'gemini' && hasGeminiKey) ||
    (activeProvider === 'openai' && hasOpenAiKey) ||
    (activeProvider === 'anthropic' && hasAnthropicKey) ||
    (activeProvider === 'groq' && hasGroqKey) ||
    activeProvider === 'ollama';

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand & Notebook Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-stone-200">
          <div className="w-9 h-9 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold shadow-sm">
            <BookOpen className="w-5 h-5 text-amber-300" />
          </div>
          <div className="hidden sm:block">
            <span className="font-semibold text-stone-900 tracking-tight text-base block leading-tight">NotebookLM</span>
            <span className="text-[10px] text-stone-600 font-medium uppercase tracking-wider">Multi-Provedor RAG</span>
          </div>
        </div>

        {/* Notebook Switcher Dropdown */}
        <div className="relative">
          <button
            id="btn-notebook-selector"
            onClick={() => setIsNotebookDropdownOpen(!isNotebookDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors text-stone-800 text-sm font-medium border border-stone-200"
          >
            <span className="max-w-[140px] md:max-w-[200px] truncate font-medium">
              {activeNotebook.title}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-normal">
              {activeNotebook.documents.length} fontes
            </span>
            <ChevronDown className="w-4 h-4 text-stone-600" />
          </button>

          {isNotebookDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-stone-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider border-b border-stone-100 mb-1">
                <span>Seus Cadernos</span>
                <button
                  onClick={() => {
                    setIsNotebookDropdownOpen(false);
                    onCreateNotebook();
                  }}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 normal-case font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo Caderno
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1">
                {notebooks.map((nb) => (
                  <div
                    key={nb.id}
                    onClick={() => {
                      onSelectNotebook(nb.id);
                      setIsNotebookDropdownOpen(false);
                    }}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      nb.id === activeNotebook.id
                        ? 'bg-amber-50 text-amber-950 font-medium border border-amber-200/60'
                        : 'hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    {editingNotebookId === nb.id ? (
                      <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="px-2 py-1 text-xs border border-stone-300 rounded focus:outline-hidden focus:ring-1 focus:ring-stone-800 w-full"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(nb.id);
                            if (e.key === 'Escape') setEditingNotebookId(null);
                          }}
                        />
                        <button
                          onClick={(e) => saveRename(nb.id, e)}
                          className="p-1 hover:bg-emerald-100 text-emerald-700 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 truncate">
                          <BookOpen className="w-4 h-4 text-stone-600 shrink-0" />
                          <span className="truncate">{nb.title}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Renomear caderno"
                            onClick={(e) => startRename(nb, e)}
                            className="p-1 text-stone-600 hover:text-stone-700 rounded hover:bg-stone-200 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Excluir caderno"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotebookToDelete(nb);
                            }}
                            className="p-1 text-stone-400 hover:text-red-700 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Dynamic AI Provider & Model Selector */}
      <div className="flex items-center gap-2 md:gap-3 bg-stone-100/90 p-1.5 rounded-xl border border-stone-200">
        {/* Provider Selector */}
        <div className="relative flex items-center">
          <select
            id="select-ai-provider"
            aria-label="Selecionar Provedor de IA"
            value={activeProvider}
            onChange={(e) => onSelectProvider(e.target.value as AIProvider)}
            className="appearance-none bg-white font-medium text-xs md:text-sm text-stone-800 pl-3 pr-7 py-1.5 rounded-lg border border-stone-200 shadow-2xs hover:border-stone-300 focus:outline-hidden focus:ring-1 focus:ring-stone-800 cursor-pointer"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="groq">Groq (LPUs Rápidas)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-stone-600 absolute right-2 pointer-events-none" />
        </div>

        {/* Model Selector */}
        <div className="relative flex items-center">
          <select
            id="select-ai-model"
            aria-label="Selecionar Modelo de IA"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className="appearance-none bg-white font-mono text-xs md:text-sm text-stone-800 pl-3 pr-7 py-1.5 rounded-lg border border-stone-200 shadow-2xs hover:border-stone-300 focus:outline-hidden focus:ring-1 focus:ring-stone-800 cursor-pointer max-w-[140px] md:max-w-[210px] truncate"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-stone-600 absolute right-2 pointer-events-none" />
        </div>

        {/* Dynamic Refresh Models Button */}
        <button
          id="btn-refresh-models"
          onClick={onRefreshModels}
          disabled={isLoadingModels}
          title="Atualizar modelos disponíveis via API do provedor"
          className="p-1.5 text-stone-600 hover:text-stone-800 hover:bg-white rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModels ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Status Indicator & Quick Connect Pill */}
        <button
          onClick={onOpenSettings}
          title={isCurrentProviderConfigured ? 'Provedor conectado. Clique para gerenciar chaves.' : 'Clique para inserir e conectar a chave deste provedor.'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
            isCurrentProviderConfigured
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
          }`}
        >
          {isCurrentProviderConfigured ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
              <span className="hidden sm:inline text-[11px]">Conectado</span>
            </>
          ) : (
            <>
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px]">Conectar Chave</span>
            </>
          )}
        </button>
      </div>

      {/* Right: Studio Toggle & Settings */}
      <div className="flex items-center gap-2">
        {/* Supabase Cloud & RLS Auth Pill */}
        <button
          id="btn-supabase-status"
          onClick={currentUser ? onOpenAuthModal : (isSupabaseConnected ? onOpenAuthModal : onOpenSettings)}
          title={
            currentUser
              ? `Supabase Conectado & Autenticado como ${currentUser.email}. Seus cadernos e mensagens estão persistindo na nuvem.`
              : isSupabaseConnected
              ? 'Supabase Conectado! Clique para Fazer Login e Ativar a Persistência de Dados (RLS).'
              : 'Configurar Supabase para Persistência em Nuvem'
          }
          className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-2xs ${
            currentUser
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
              : isSupabaseConnected
              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <Cloud className={`w-3.5 h-3.5 ${currentUser ? 'text-emerald-600' : isSupabaseConnected ? 'text-amber-600 animate-pulse' : 'text-stone-400'}`} />
          <span className="hidden sm:inline">
            {currentUser 
              ? (currentUser.email?.split('@')[0] || 'Nuvem Conectada') 
              : isSupabaseConnected 
              ? 'Entrar no Supabase (RLS)' 
              : 'Conectar Nuvem'}
          </span>
          {currentUser && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs hidden sm:inline-block" />
          )}
        </button>

        {/* Quick Connect Keys Button */}
        <button
          id="btn-quick-connect-keys"
          onClick={onOpenSettings}
          title="Inserir e Conectar Chaves de API (OpenAI, Anthropic, Gemini, Groq, Ollama)"
          className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
        >
          <Key className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Chaves & Conexões</span>
        </button>

        {/* Studio Panel Toggle */}
        <button
          id="btn-toggle-studio"
          onClick={onToggleStudio}
          title="Abrir Estúdio NotebookLM (Podcast, Guia de Estudos, FAQ)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
            isStudioOpen 
              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
              : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span className="hidden sm:inline">Estúdio</span>
        </button>

        {/* Settings Modal Button */}
        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          title="Configurações de API Keys, Supabase e RAG"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs md:text-sm font-medium rounded-lg transition-colors shadow-2xs"
        >
          <Settings className="w-4 h-4 text-stone-300" />
          <span className="hidden md:inline">Configurações & RAG</span>
        </button>
      </div>

      {/* Delete Notebook Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!notebookToDelete}
        onClose={() => setNotebookToDelete(null)}
        onConfirm={() => {
          if (notebookToDelete) {
            onDeleteNotebook(notebookToDelete.id);
            setNotebookToDelete(null);
            setIsNotebookDropdownOpen(false);
          }
        }}
        title="Excluir Caderno"
        itemName={notebookToDelete?.title}
        description="Tem certeza que deseja excluir este caderno? Todas as fontes, documentos, chunks vetoriais, notas e histórico de conversa deste caderno serão excluídos permanentemente."
      />
    </header>
  );
};
