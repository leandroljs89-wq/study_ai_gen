import React, { useState } from 'react';
import { 
  FileText, 
  FileCode, 
  Globe, 
  Mic, 
  StickyNote, 
  Plus, 
  Trash2, 
  Eye, 
  CheckSquare, 
  Square, 
  Layers, 
  Clock, 
  Sparkles,
  Info,
  ChevronRight,
  Database
} from 'lucide-react';
import { NotebookDocument, QuickNote, DocumentType } from '../types';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface SourcesPanelProps {
  documents: NotebookDocument[];
  notes: QuickNote[];
  onToggleDocumentRag: (docId: string) => void;
  onToggleAllDocumentsRag: (enable: boolean) => void;
  onOpenAddSource: () => void;
  onOpenAddNote: () => void;
  onViewDocument: (doc: NotebookDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onInsertNoteToChat?: (text: string) => void;
}

const getDocumentIcon = (type: DocumentType) => {
  switch (type) {
    case 'pdf':
      return <FileText className="w-4 h-4 text-rose-600 shrink-0" />;
    case 'txt':
      return <FileCode className="w-4 h-4 text-blue-600 shrink-0" />;
    case 'web_link':
      return <Globe className="w-4 h-4 text-emerald-600 shrink-0" />;
    case 'audio':
      return <Mic className="w-4 h-4 text-purple-600 shrink-0" />;
    case 'note':
    default:
      return <StickyNote className="w-4 h-4 text-amber-600 shrink-0" />;
  }
};

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  documents,
  notes,
  onToggleDocumentRag,
  onToggleAllDocumentsRag,
  onOpenAddSource,
  onOpenAddNote,
  onViewDocument,
  onDeleteDocument,
  onDeleteNote,
  onInsertNoteToChat
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'notes'>('sources');
  const [docToDelete, setDocToDelete] = useState<NotebookDocument | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<QuickNote | null>(null);

  const activeRagCount = documents.filter(d => d.enabledInRag).length;
  const allSelected = documents.length > 0 && activeRagCount === documents.length;
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunks?.length || d.chunksCount || 0), 0);

  return (
    <aside className="w-full h-full flex flex-col bg-stone-50/70 border-r border-stone-200 select-none">
      {/* Panel Top Navigation */}
      <div className="p-3 border-b border-stone-200 bg-white/80 backdrop-blur-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200/80">
            <button
              id="tab-sources"
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'sources'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Fontes ({documents.length})
            </button>
            <button
              id="tab-notes"
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'notes'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Notas Rápidas ({notes.length})
            </button>
          </div>

          {activeTab === 'sources' ? (
            <button
              id="btn-add-source"
              onClick={onOpenAddSource}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Fonte</span>
            </button>
          ) : (
            <button
              id="btn-add-note"
              onClick={onOpenAddNote}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nota</span>
            </button>
          )}
        </div>

        {activeTab === 'sources' && (
          <div className="flex items-center justify-between text-xs text-stone-600 pt-1">
            <button
              onClick={() => onToggleAllDocumentsRag(!allSelected)}
              className="flex items-center gap-1.5 hover:text-stone-800 transition-colors font-medium text-[11px]"
            >
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-stone-400" />
              )}
              <span>{activeRagCount} de {documents.length} ativas no RAG</span>
            </button>
            <span className="flex items-center gap-1 text-[11px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
              <Layers className="w-3 h-3 text-stone-600" />
              {totalChunks} chunks vetoriais
            </span>
          </div>
        )}
      </div>

      {/* Sources List View */}
      {activeTab === 'sources' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-stone-300 rounded-xl bg-white/50">
              <FileText className="w-8 h-8 text-stone-300 mb-2" />
              <p className="text-xs font-medium text-stone-600 mb-1">Nenhuma fonte adicionada</p>
              <p className="text-[11px] text-stone-600 mb-3 max-w-[180px]">
                Adicione PDFs, notas, links web ou áudios para alimentar o RAG.
              </p>
              <button
                onClick={onOpenAddSource}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar primeira fonte
              </button>
            </div>
          ) : (
            documents.map((doc) => {
              const chunkCount = doc.chunks?.length || doc.chunksCount || 0;
              return (
                <div
                  key={doc.id}
                  className={`group relative bg-white rounded-xl p-2.5 border transition-all ${
                    doc.enabledInRag
                      ? 'border-stone-200/90 shadow-2xs hover:border-blue-300'
                      : 'border-stone-200/50 opacity-60 bg-stone-100/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Toggle RAG inclusion */}
                    <button
                      onClick={() => onToggleDocumentRag(doc.id)}
                      title={doc.enabledInRag ? 'Desmarcar do contexto RAG' : 'Incluir no contexto RAG'}
                      className="mt-0.5 text-stone-400 hover:text-blue-600 transition-colors"
                    >
                      {doc.enabledInRag ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-300" />
                      )}
                    </button>

                    {/* Icon & Title */}
                    <div 
                      onClick={() => onViewDocument(doc)} 
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {getDocumentIcon(doc.file_type)}
                        <h4 className="text-xs font-semibold text-stone-800 truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-stone-600">
                        <span className="capitalize">{doc.file_type}</span>
                        <span>•</span>
                        <span className="font-mono">{chunkCount} chunks</span>
                        {doc.charCount && (
                          <>
                            <span>•</span>
                            <span>{Math.round(doc.charCount / 1000)}k chars</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewDocument(doc)}
                        title="Ver conteúdo e chunks vetoriais"
                        className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocToDelete(doc);
                        }}
                        title="Excluir documento"
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick Notes View */}
      {activeTab === 'notes' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notes.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-stone-300 rounded-xl bg-white/50">
              <StickyNote className="w-8 h-8 text-stone-300 mb-2" />
              <p className="text-xs font-medium text-stone-600 mb-1">Nenhuma nota rápida</p>
              <p className="text-[11px] text-stone-600 mb-3 max-w-[180px]">
                Crie anotações, resumos ou insights para complementar o caderno.
              </p>
              <button
                onClick={onOpenAddNote}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Criar primeira nota
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group bg-amber-50/60 hover:bg-amber-50 rounded-xl p-3 border border-amber-200/80 transition-all shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="text-xs font-semibold text-amber-950 truncate flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {note.title}
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteToDelete(note);
                    }}
                    className="opacity-70 group-hover:opacity-100 text-stone-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                    title="Excluir nota"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-stone-700 line-clamp-3 leading-relaxed mb-2 font-sans">
                  {note.content}
                </p>
                {onInsertNoteToChat && (
                  <button
                    onClick={() => onInsertNoteToChat(`Com base nesta nota ("${note.title}"): ${note.content}`)}
                    className="text-[10px] text-amber-800 hover:text-amber-950 font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>Perguntar sobre esta nota</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* RAG Context Summary Footer */}
      <div className="p-3 bg-white border-t border-stone-200 text-xs">
        <div className="flex items-center justify-between text-stone-600 mb-1">
          <span className="font-semibold text-stone-800 text-[11px] uppercase tracking-wider">Otimização RAG</span>
          <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            HNSW Ativo
          </span>
        </div>
        <p className="text-[11px] text-stone-600 leading-normal">
          Somente os trechos recuperados por busca vetorial são injetados no contexto, reduzindo tokens em até ~90%.
        </p>
      </div>

      {/* Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => {
          if (docToDelete) {
            onDeleteDocument(docToDelete.id);
            setDocToDelete(null);
          }
        }}
        title="Excluir Fonte"
        itemName={docToDelete?.name}
        description="Esta fonte e todos os seus chunks vetoriais de embeddings serão excluídos do caderno e do banco de dados permanentemente."
      />

      <DeleteConfirmModal
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={() => {
          if (noteToDelete) {
            onDeleteNote(noteToDelete.id);
            setNoteToDelete(null);
          }
        }}
        title="Excluir Nota Rápida"
        itemName={noteToDelete?.title}
        description="Esta anotação será excluída do caderno e da sincronização permanentemente."
      />
    </aside>
  );
};
