import React, { useState } from 'react';
import { X, StickyNote, Plus } from 'lucide-react';
import { QuickNote } from '../types';
import { generateUUID } from '../lib/uuid';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebookId: string;
  onAddNote: (note: QuickNote) => void;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  notebookId,
  onAddNote
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newNote: QuickNote = {
      id: generateUUID(),
      notebook_id: notebookId,
      title: title.trim(),
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    onAddNote(newNote);
    setTitle('');
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-600" />
            Nova Nota Rápida
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Título da Nota
            </label>
            <input
              type="text"
              placeholder="Ex: Insight sobre pgvector..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Conteúdo da Anotação
            </label>
            <textarea
              rows={5}
              placeholder="Escreva seus pensamentos, ideias ou resumos..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-500 resize-none font-sans"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              Salvar Nota
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
