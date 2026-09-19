import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  FileText, 
  Copy, 
  Check, 
  Hash, 
  Sparkles, 
  Calendar,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { NotebookDocument } from '../types';

interface DocumentViewerModalProps {
  document: NotebookDocument | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'chunks'>('chunks');
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);

  if (!document) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const chunks = document.chunks || [];

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-stone-900 truncate" title={document.name}>
                {document.name}
              </h3>
              <p className="text-[11px] text-stone-600">
                Tipo: <span className="uppercase font-medium">{document.file_type}</span> • {chunks.length} chunks indexados • {document.charCount || 0} caracteres
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-stone-200 px-4 pt-2 gap-2 bg-stone-50/40">
          <button
            onClick={() => setActiveTab('chunks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'chunks'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Chunks & Embeddings ({chunks.length})
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-stone-700 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Texto Integral
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {activeTab === 'chunks' ? (
            chunks.length === 0 ? (
              <p className="text-xs text-stone-600 text-center py-8">Nenhum chunk gerado para este documento.</p>
            ) : (
              chunks.map((chunk, idx) => (
                <div
                  key={chunk.id || idx}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-2 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-600 pb-1 border-b border-stone-200/60">
                    <span className="font-semibold text-stone-800 flex items-center gap-1">
                      <Hash className="w-3 h-3 text-blue-600" />
                      Chunk #{idx + 1} de {chunks.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Vetor 1536d
                      </span>
                      <button
                        onClick={() => handleCopy(chunk.content, chunk.id)}
                        className="p-1 hover:bg-stone-200 rounded text-stone-600 transition-colors"
                        title="Copiar texto do chunk"
                      >
                        {copiedChunkId === chunk.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
                    {chunk.content}
                  </p>

                  <div className="text-[10px] text-stone-600 pt-1 flex items-center gap-2 font-mono">
                    <span>{chunk.content.length} caracteres</span>
                    <span>•</span>
                    <span>~{Math.round(chunk.content.length / 3.8)} tokens</span>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs font-sans text-stone-800 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {document.content || 'Nenhum conteúdo raw disponível.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
