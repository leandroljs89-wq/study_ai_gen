import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Copy, 
  Check, 
  Layers, 
  Zap, 
  BookmarkPlus, 
  Trash2, 
  ExternalLink,
  ChevronDown,
  Info,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Key
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ChatMessage, ChatSourceCitation, NotebookDocument, AIProvider } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  activeNotebookTitle: string;
  activeDocuments: NotebookDocument[];
  activeProvider: AIProvider;
  selectedModel: string;
  onClearChat: () => void;
  onSaveAsNote: (title: string, content: string) => void;
  inputText: string;
  setInputText: (text: string) => void;
  onOpenSettings?: () => void;
  isCurrentProviderConnected?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeNotebookTitle,
  activeDocuments,
  activeProvider,
  selectedModel,
  onClearChat,
  onSaveAsNote,
  inputText,
  setInputText,
  onOpenSettings,
  isCurrentProviderConnected = true
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<ChatSourceCitation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enabledDocs = activeDocuments.filter(d => d.enabledInRag);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    'Faça um resumo executivo abrangente de todas as fontes ativas.',
    'Como a arquitetura RAG e o pgvector reduzem custos de tokens?',
    'Compare os pontos fortes dos modelos de IA citados (Gemini, Claude, GPT, Groq).',
    'Explique as tabelas do Supabase e o papel do índice HNSW.'
  ];

  return (
    <main className="flex-1 h-full flex flex-col bg-white overflow-hidden relative">
      {/* Top Chat Bar: RAG Context & Token Economy Indicator */}
      <div className="h-11 px-4 border-b border-stone-200/90 bg-stone-50/70 flex items-center justify-between text-xs text-stone-600 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <span className="flex items-center gap-1.5 font-medium text-stone-800">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Contexto RAG:</span>
          </span>
          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full font-medium border border-blue-200/60 truncate">
            {enabledDocs.length} de {activeDocuments.length} fontes ativas
          </span>
          <span className="hidden sm:inline text-stone-400">•</span>
          <span className="hidden sm:inline text-stone-600 truncate">
            {selectedModel} ({activeProvider})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={onClearChat}
              title="Limpar histórico de conversa deste caderno"
              className="text-stone-600 hover:text-red-700 transition-colors flex items-center gap-1 text-[11px]"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden md:inline">Limpar Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State: NotebookLM Style Guide */
          <div className="max-w-2xl mx-auto py-10 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Sparkles className="w-7 h-7 text-amber-600" />
            </div>
            
            <h2 className="text-xl font-bold text-stone-900 tracking-tight mb-2">
              {activeNotebookTitle}
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed max-w-lg mx-auto mb-8">
              Faça perguntas sobre os documentos do caderno. A busca semântica híbrida recuperará apenas os trechos exatos para alimentar o modelo de IA selecionado.
            </p>

            {/* Quick Prompt Cards */}
            <div className="text-left mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-600 mb-3 px-1">
                Sugestões de Perguntas Rápidas:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-3 text-left rounded-xl border border-stone-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-xs text-stone-800 font-medium group flex items-start justify-between gap-2 shadow-2xs"
                  >
                    <span className="leading-snug">{prompt}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-blue-600 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Token Economy Notice */}
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Economia Inteligente:</strong> Ao invés de enviar documentos inteiros, apenas chunks de alta similaridade são despachados, poupando até 95% de tokens.
              </span>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start w-full'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4 text-amber-300" />
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-2xl ${
                  msg.role === 'user'
                    ? 'bg-stone-900 text-white rounded-tr-xs'
                    : 'bg-stone-50/90 border border-stone-200/90 text-stone-800 rounded-tl-xs shadow-2xs w-full'
                }`}
              >
                {/* Assistant Message Header / Model info */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between text-[11px] text-stone-600 pb-2 mb-2 border-b border-stone-200/60">
                    <span className="font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      {msg.modelUsed || selectedModel}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="p-1 text-stone-600 hover:text-stone-800 hover:bg-stone-200/70 rounded transition-colors"
                        title="Copiar resposta"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onSaveAsNote(`Insight (${new Date().toLocaleTimeString()})`, msg.content)}
                        className="p-1 text-stone-600 hover:text-amber-700 hover:bg-stone-200/70 rounded transition-colors"
                        title="Salvar como Nota Rápida no Caderno"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Content */}
                <div className="markdown-body prose prose-sm max-w-none text-stone-800">
                  <Markdown>{msg.content}</Markdown>
                </div>

                {/* Sources Consulted Chips */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-stone-200/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 mb-2">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>{msg.sources.length} Fontes Consultadas (RAG):</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src) => (
                        <button
                          key={src.index}
                          onClick={() => setSelectedCitation(src)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-300 hover:border-blue-400 hover:bg-blue-50/40 text-stone-800 text-xs transition-all shadow-2xs font-medium group"
                        >
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                            {src.index}
                          </span>
                          <span className="truncate max-w-[150px]">{src.documentName}</span>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            {(src.similarity * 100).toFixed(0)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token Economy Stats Pill */}
                {msg.tokensStats && (
                  <div className="mt-3 flex items-center justify-between px-2.5 py-1 bg-stone-100/90 rounded-lg text-[11px] text-stone-600 font-mono">
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      <Zap className="w-3 h-3" />
                      Prompt: ~{msg.tokensStats.estimatedPromptTokens} tokens
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      Economia RAG: {msg.tokensStats.savingsPercentage}%
                    </span>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Bot className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs text-stone-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>Buscando chunks vetoriais relevantes & gerando resposta...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Citation Drawer / Inspector */}
      {selectedCitation && (
        <div className="absolute bottom-20 left-4 right-4 md:left-8 md:right-8 bg-white border border-blue-200 rounded-2xl shadow-xl p-4 z-20 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                {selectedCitation.index}
              </span>
              <span className="text-xs font-semibold text-stone-900">
                {selectedCitation.documentName}
              </span>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                Similaridade: {(selectedCitation.similarity * 100).toFixed(1)}%
              </span>
            </div>
            <button
              onClick={() => setSelectedCitation(null)}
              className="text-stone-400 hover:text-stone-700 text-xs font-semibold px-2 py-1 hover:bg-stone-100 rounded-md"
            >
              Fechar
            </button>
          </div>
          <p className="text-xs text-stone-800 leading-relaxed font-sans bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 max-h-36 overflow-y-auto whitespace-pre-wrap">
            "{selectedCitation.snippet}"
          </p>
        </div>
      )}

      {/* Bottom Input Box */}
      <div className="p-3 md:p-4 bg-white border-t border-stone-200">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
          {/* Missing Key Banner */}
          {!isCurrentProviderConnected && (
            <div className="mb-2 p-2.5 bg-amber-50 border border-amber-300/80 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-2xs">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  O provedor <strong>{activeProvider.toUpperCase()}</strong> ainda não está conectado com sua chave de API.
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-2xs"
              >
                Conectar Chave
              </button>
            </div>
          )}

          <div className="relative rounded-2xl border border-stone-300 focus-within:border-stone-800 focus-within:ring-1 focus-within:ring-stone-800 bg-stone-50/50 shadow-2xs transition-all">
            <textarea
              id="input-chat-query"
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Pergunte algo sobre "${activeNotebookTitle}"... (Enter para enviar)`}
              className="w-full bg-transparent px-4 pt-3 pb-10 text-sm text-stone-900 placeholder:text-stone-600 focus:outline-hidden resize-none"
            />

            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>RAG Híbrido Ativo</span>
              </div>

              <button
                id="btn-send-chat"
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
                title="Enviar pergunta"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
};
