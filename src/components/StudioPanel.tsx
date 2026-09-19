import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Mic, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  Play, 
  Pause, 
  Copy, 
  Check, 
  BookmarkPlus, 
  Loader2,
  Volume2,
  VolumeX,
  Layers
} from 'lucide-react';
import Markdown from 'react-markdown';
import { NotebookDocument, AIProvider } from '../types';

interface StudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notebookTitle: string;
  documents: NotebookDocument[];
  activeProvider: AIProvider;
  geminiApiKey?: string;
  onSaveAsNote: (title: string, content: string) => void;
}

type StudioArtifactType = 'audio_overview' | 'study_guide' | 'briefing_doc' | 'faq';

export const StudioPanel: React.FC<StudioPanelProps> = ({
  isOpen,
  onClose,
  notebookTitle,
  documents,
  activeProvider,
  geminiApiKey,
  onSaveAsNote
}) => {
  const [activeArtifact, setActiveArtifact] = useState<StudioArtifactType>('audio_overview');
  const [artifactContents, setArtifactContents] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentContent = artifactContents[activeArtifact] || '';

  const generateArtifact = async (type: StudioArtifactType) => {
    setIsGenerating(true);
    setError(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }

    try {
      // Gather active document texts
      const enabledDocs = documents.filter(d => d.enabledInRag);
      const combinedText = enabledDocs
        .map(d => `--- Documento: ${d.name} ---\n${d.content || ''}`)
        .join('\n\n');

      if (!combinedText.trim()) {
        throw new Error('Nenhuma fonte com conteúdo de texto disponível no caderno.');
      }

      const resp = await fetch('/api/generate-studio-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          documentsText: combinedText,
          notebookTitle,
          provider: activeProvider,
          apiKey: geminiApiKey
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao gerar artefato do estúdio.');
      }

      const data = await resp.json();
      setArtifactContents(prev => ({
        ...prev,
        [type]: data.content
      }));
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar material.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Browser Speech synthesis for Audio Overview podcast simulation
  const toggleAudioSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Síntese de voz não suportada neste navegador.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!currentContent) return;

    // Clean text for speech
    const cleanSpeech = currentContent
      .replace(/\[Alex\]/gi, 'Alex diz: ')
      .replace(/\[Sam\]/gi, 'Sam diz: ')
      .replace(/[*#_]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanSpeech.slice(0, 3000));
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const handleCopy = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const artifactButtons = [
    { type: 'audio_overview' as const, label: 'Visão Geral em Áudio', icon: Mic, desc: 'Simulação de Podcast entre 2 debatedores' },
    { type: 'study_guide' as const, label: 'Guia de Estudos', icon: BookOpen, desc: 'Resumo, conceitos e quiz de fixação' },
    { type: 'briefing_doc' as const, label: 'Briefing Executivo', icon: FileText, desc: 'Memorando de síntese para decisões' },
    { type: 'faq' as const, label: 'Perguntas Frequentes', icon: HelpCircle, desc: 'Top 7 dúvidas fundamentadas nas fontes' }
  ];

  return (
    <aside className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-stone-50/80 border-l border-stone-200 select-none">
      {/* Studio Header */}
      <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 leading-tight">Estúdio NotebookLM</h3>
            <p className="text-[11px] text-stone-600">Sínteses automáticas das fontes</p>
          </div>
        </div>

        <button
          onClick={() => {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            onClose();
          }}
          className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Generator Cards / Tabs */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-stone-200 bg-white/50">
        {artifactButtons.map((btn) => {
          const Icon = btn.icon;
          const isSelected = activeArtifact === btn.type;
          return (
            <button
              key={btn.type}
              onClick={() => {
                setActiveArtifact(btn.type);
                if (!artifactContents[btn.type]) {
                  generateArtifact(btn.type);
                }
              }}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                  : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-amber-600' : 'text-stone-500'}`} />
              <div className="text-xs font-semibold truncate">{btn.label}</div>
            </button>
          );
        })}
      </div>

      {/* Artifact View Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-12">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            <p className="text-xs font-semibold text-stone-800">
              Sintetizando fontes com IA...
            </p>
            <p className="text-[11px] text-stone-600 max-w-[200px]">
              Analisando documentos e estruturando o material.
            </p>
          </div>
        ) : currentContent ? (
          <div className="space-y-4">
            {/* Artifact Actions Toolbar */}
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 text-xs">
              <div className="flex items-center gap-1.5">
                {activeArtifact === 'audio_overview' && (
                  <button
                    onClick={toggleAudioSpeech}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-xs transition-colors ${
                      isPlayingAudio
                        ? 'bg-amber-600 text-white animate-pulse'
                        : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        Pausar Áudio
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Ouvir Podcast
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  title="Copiar texto gerado"
                  className="p-1.5 text-stone-600 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => onSaveAsNote(`Estúdio: ${activeArtifact}`, currentContent)}
                  title="Salvar como Nota no Caderno"
                  className="p-1.5 text-stone-600 hover:text-amber-700 hover:bg-stone-200 rounded-lg transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => generateArtifact(activeArtifact)}
                  title="Gerar novamente"
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 pl-1"
                >
                  Regerar
                </button>
              </div>
            </div>

            {/* Rendered Content */}
            <div className="markdown-body prose prose-sm text-xs leading-relaxed text-stone-800 bg-white p-3.5 rounded-xl border border-stone-200/90 shadow-2xs">
              <Markdown>{currentContent}</Markdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Sparkles className="w-8 h-8 text-amber-400 mb-2" />
            <p className="text-xs font-semibold text-stone-800 mb-1">
              Gere material a partir das suas fontes
            </p>
            <p className="text-[11px] text-stone-600 mb-4 max-w-[220px]">
              Crie podcasts falados, resumos executivos ou questionários em poucos segundos.
            </p>
            <button
              onClick={() => generateArtifact(activeArtifact)}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              Gerar {activeArtifact.replace('_', ' ')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
