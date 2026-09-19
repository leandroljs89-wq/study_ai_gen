export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama';

export interface ModelOption {
  id: string;
  name: string;
  recommended?: boolean;
}

export interface UserApiKeys {
  gemini_api_key?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  groq_api_key?: string;
  ollama_host?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  connected: boolean;
  autoSync: boolean;
}

export type DocumentType = 'pdf' | 'txt' | 'web_link' | 'note' | 'audio';

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding?: number[];
  metadata?: {
    chunkIndex: number;
    totalChunks: number;
    charCount: number;
    sourceName: string;
    sourceType: DocumentType;
  };
  created_at?: string;
}

export interface NotebookDocument {
  id: string;
  notebook_id: string;
  name: string;
  file_path?: string;
  file_type: DocumentType;
  content?: string; // full raw or extracted text
  charCount?: number;
  chunksCount?: number;
  enabledInRag: boolean; // toggle whether to include in search
  created_at: string;
  chunks?: DocumentChunk[];
}

export interface QuickNote {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Notebook {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  documents: NotebookDocument[];
  notes: QuickNote[];
}

export interface ChatSourceCitation {
  index: number;
  documentId: string;
  documentName: string;
  similarity: number;
  snippet: string;
  chunkId?: string;
}

export interface ChatMessage {
  id: string;
  notebook_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: ChatSourceCitation[];
  tokensStats?: {
    retrievedChunksCount: number;
    estimatedPromptTokens: number;
    estimatedTokensSaved: number;
    savingsPercentage: number;
  };
  providerUsed?: AIProvider;
  modelUsed?: string;
  created_at: string;
}

export interface RAGSearchResult {
  chunk: DocumentChunk;
  document: NotebookDocument;
  similarity: number;
  method: 'vector' | 'hybrid' | 'supabase_rpc';
}

export interface StudioArtifact {
  id: string;
  notebook_id: string;
  type: 'audio_overview' | 'study_guide' | 'briefing_doc' | 'faq' | 'flashcards';
  title: string;
  content: string;
  created_at: string;
}
