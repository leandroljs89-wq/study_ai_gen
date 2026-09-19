import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Globe, 
  Mic, 
  StickyNote, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Layers,
  Sparkles
} from 'lucide-react';
import { DocumentType, NotebookDocument } from '../types';
import { chunkDocument } from '../lib/ragEngine';
import { generateUUID } from '../lib/uuid';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebookId: string;
  onAddDocument: (doc: NotebookDocument) => void;
  geminiApiKey?: string;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  notebookId,
  onAddDocument,
  geminiApiKey
}) => {
  const [activeTab, setActiveTab] = useState<DocumentType>('pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [webUrl, setWebUrl] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  if (!isOpen) return null;

  // Process and embed chunks
  const finalizeDocument = async (name: string, content: string, type: DocumentType) => {
    setIsProcessing(true);
    setError(null);

    try {
      if (!content || content.trim().length === 0) {
        throw new Error('O conteúdo da fonte está vazio.');
      }

      const docId = generateUUID();
      const chunks = chunkDocument(content, docId, name, type);

      // Attempt to retrieve embeddings for the chunks
      let embeddedChunks = [...chunks];
      try {
        const chunkTexts = chunks.map(c => c.content);
        const resp = await fetch('/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: chunkTexts,
            provider: 'gemini',
            apiKey: geminiApiKey
          })
        });

        if (resp.ok) {
          const embData = await resp.json();
          if (embData.embeddings && embData.embeddings.length === chunks.length) {
            embeddedChunks = chunks.map((c, idx) => ({
              ...c,
              embedding: embData.embeddings[idx]
            }));
          }
        }
      } catch (embErr) {
        console.warn('Embedding fallback to deterministic vector:', embErr);
      }

      const newDoc: NotebookDocument = {
        id: docId,
        notebook_id: notebookId,
        name,
        file_type: type,
        content,
        charCount: content.length,
        chunksCount: embeddedChunks.length,
        enabledInRag: true,
        created_at: new Date().toISOString(),
        chunks: embeddedChunks
      };

      onAddDocument(newDoc);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar documento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file uploads (PDF, TXT, MD, CSV, JSON)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'pdf') {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const resp = await fetch('/api/parse-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Data, filename: file.name })
            });

            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              throw new Error(err.error || 'Falha ao extrair texto do PDF.');
            }

            const data = await resp.json();
            await finalizeDocument(file.name, data.text, 'pdf');
          } catch (pdfErr: any) {
            setError(pdfErr.message || 'Erro ao ler arquivo PDF.');
            setIsProcessing(false);
          }
        };
        reader.onerror = () => {
          setError('Erro na leitura do arquivo local.');
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } else {
        // Plain text, markdown, json, etc.
        const reader = new FileReader();
        reader.onload = async () => {
          const text = reader.result as string;
          await finalizeDocument(file.name, text, 'txt');
        };
        reader.onerror = () => {
          setError('Erro ao ler arquivo de texto.');
          setIsProcessing(false);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      setError(err.message || 'Falha no processamento.');
      setIsProcessing(false);
    }
  };

  // Handle Web URL Fetch
  const handleFetchWebUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl.trim()) return;

    setError(null);
    setIsProcessing(true);

    try {
      const resp = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webUrl.trim() })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao raspar URL.');
      }

      const data = await resp.json();
      await finalizeDocument(data.title || webUrl, data.text, 'web_link');
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar link da web.');
      setIsProcessing(false);
    }
  };

  // Handle speech-to-text recording in browser if supported
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado neste navegador. Você pode digitar ou colar a transcrição.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setAudioTranscript((prev) => (prev ? prev + ' ' : '') + transcript);
      };

      recognition.start();
    } catch (e) {
      console.warn('Speech recognition error', e);
      setIsListening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-stone-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Adicionar Fonte ao Caderno
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              O arquivo será processado em chunks com embeddings vetoriais para o RAG.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Type Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-50/70 px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('pdf'); setError(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'pdf'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-rose-500" />
            PDF & Arquivos
          </button>
          <button
            onClick={() => { setActiveTab('web_link'); setError(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'web_link'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            Link Web
          </button>
          <button
            onClick={() => { setActiveTab('note'); setError(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'note'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
            Texto / Nota
          </button>
          <button
            onClick={() => { setActiveTab('audio'); setError(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all shrink-0 ${
              activeTab === 'audio'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-purple-500" />
            Áudio & Voz
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isProcessing ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-stone-800">Processando documento...</p>
                <p className="text-xs text-stone-600 mt-1">
                  Extraindo texto, criando chunks com sobreposição e gerando embeddings vetoriais.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: PDF & TXT */}
              {activeTab === 'pdf' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-stone-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-stone-50/50 hover:bg-blue-50/20 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.csv,.json"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-stone-800 mb-1">
                      Clique para selecionar ou arraste o arquivo aqui
                    </p>
                    <p className="text-xs text-stone-600 max-w-sm">
                      Suporta PDFs com texto, arquivos de texto (.txt), Markdown (.md), CSV ou JSON.
                    </p>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      O motor RAG particiona documentos automaticamente em pedaços coerentes de 500 a 700 caracteres, permitindo consultas ultra rápidas e econômicas.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: LINK WEB */}
              {activeTab === 'web_link' && (
                <form onSubmit={handleFetchWebUrl} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      URL da Página Web ou Artigo
                    </label>
                    <input
                      type="url"
                      placeholder="https://exemplo.com/artigo-ou-documentacao"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-stone-600 mt-1">
                      O conteúdo textual será extraído sem scripts ou publicidades para compor o acervo.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={!webUrl.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                    >
                      Extrair & Adicionar ao RAG
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: TEXTO / NOTA */}
              {activeTab === 'note' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!noteTitle.trim() || !noteContent.trim()) return;
                    finalizeDocument(noteTitle.trim(), noteContent.trim(), 'note');
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Título da Fonte / Nota
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Anotações de Reunião ou Conceito Chave"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Conteúdo Textual
                    </label>
                    <textarea
                      rows={6}
                      placeholder="Cole ou redija o texto completo aqui..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={!noteTitle.trim() || !noteContent.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                    >
                      Criar & Indexar Fonte
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 4: ÁUDIO & VOZ */}
              {activeTab === 'audio' && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-purple-950">Ditado por Voz em Tempo Real</p>
                      <p className="text-[11px] text-purple-700">Fale para transcrever notas faladas diretamente.</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isListening
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      {isListening ? 'Gravando... (Clique para parar)' : 'Iniciar Ditado'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Transcrição ou Notas de Áudio
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Transcrição gerada ou colada de reuniões e áudios..."
                      value={audioTranscript}
                      onChange={(e) => setAudioTranscript(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!audioTranscript.trim()}
                      onClick={() => finalizeDocument(`Áudio_Transcrito_${new Date().toLocaleDateString('pt-BR')}`, audioTranscript, 'audio')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                    >
                      Indexar Transcrição no RAG
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
