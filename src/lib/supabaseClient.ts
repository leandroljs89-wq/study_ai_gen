import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Notebook, NotebookDocument, DocumentChunk, ChatMessage, UserApiKeys, QuickNote } from '../types';
import { ensureUUID, isValidUUID } from './uuid';

let supabaseInstance: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export function getSupabase(url?: string, anonKey?: string): SupabaseClient | null {
  const finalUrl = (url || (typeof window !== 'undefined' ? localStorage.getItem('notebooklm_supabase_url') : '') || import.meta.env.VITE_SUPABASE_URL || '').trim();
  const finalKey = (anonKey || (typeof window !== 'undefined' ? localStorage.getItem('notebooklm_supabase_anon_key') : '') || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!finalUrl || !finalKey) {
    return null;
  }

  try {
    if (!supabaseInstance || currentClientUrl !== finalUrl || currentClientKey !== finalKey) {
      supabaseInstance = createClient(finalUrl, finalKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      currentClientUrl = finalUrl;
      currentClientKey = finalKey;
    }
    return supabaseInstance;
  } catch (e) {
    console.error('Falha ao inicializar cliente Supabase:', e);
    return null;
  }
}

export function resetSupabaseClient(url: string, anonKey: string): SupabaseClient | null {
  try {
    supabaseInstance = createClient(url.trim(), anonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    currentClientUrl = url.trim();
    currentClientKey = anonKey.trim();
    return supabaseInstance;
  } catch (e) {
    console.error('Erro ao recriar cliente Supabase:', e);
    return null;
  }
}

/**
 * Get the currently logged-in user from Supabase Auth
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Ensure a profile row exists in public.profiles for the user (to avoid FK errors)
 */
export async function ensureUserProfile(user: User, fullName?: string): Promise<void> {
  const client = getSupabase();
  if (!client || !user) return;
  try {
    await client.from('profiles').upsert({
      id: user.id,
      full_name: fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
      avatar_url: user.user_metadata?.avatar_url || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Erro ao verificar/criar profile no Supabase:', e);
  }
}

/**
 * Load saved API keys from public.profiles table
 */
export async function loadProfileApiKeys(userId: string): Promise<UserApiKeys | null> {
  const client = getSupabase();
  if (!client || !userId) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('openai_api_key, anthropic_api_key, gemini_api_key, groq_api_key, ollama_host')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      openai_api_key: data.openai_api_key || '',
      anthropic_api_key: data.anthropic_api_key || '',
      gemini_api_key: data.gemini_api_key || '',
      groq_api_key: data.groq_api_key || '',
      ollama_host: data.ollama_host || ''
    };
  } catch (e) {
    console.warn('Erro ao carregar chaves do profile Supabase:', e);
    return null;
  }
}

/**
 * Save API keys directly into public.profiles table
 */
export async function saveProfileApiKeys(userId: string, keys: UserApiKeys): Promise<boolean> {
  const client = getSupabase();
  if (!client || !userId) return false;
  try {
    const { error } = await client
      .from('profiles')
      .update({
        openai_api_key: keys.openai_api_key || null,
        anthropic_api_key: keys.anthropic_api_key || null,
        gemini_api_key: keys.gemini_api_key || null,
        groq_api_key: keys.groq_api_key || null,
        ollama_host: keys.ollama_host || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    return !error;
  } catch (e) {
    console.warn('Erro ao salvar chaves no profile Supabase:', e);
    return false;
  }
}

/**
 * Fetch all notebooks, documents, chunks, and notes for the authenticated user
 */
export async function fetchUserNotebooks(userId: string): Promise<Notebook[]> {
  const client = getSupabase();
  if (!client || !userId) return [];

  try {
    // 1. Fetch notebooks
    const { data: notebooksData, error: nbErr } = await client
      .from('notebooks')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (nbErr || !notebooksData || notebooksData.length === 0) {
      return [];
    }

    const notebookIds = notebooksData.map((n: any) => n.id);

    // 2. Fetch documents
    const { data: docsData, error: docsErr } = await client
      .from('documents')
      .select('*')
      .in('notebook_id', notebookIds);

    // 3. Fetch chunks
    let allChunks: any[] = [];
    if (docsData && docsData.length > 0) {
      const docIds = docsData.map((d: any) => d.id);
      const { data: chunksData } = await client
        .from('document_chunks')
        .select('*')
        .in('document_id', docIds);
      if (chunksData) {
        allChunks = chunksData;
      }
    }

    // Assemble the complete Notebook objects
    const result: Notebook[] = notebooksData.map((nb: any) => {
      const nbDocsRaw = (docsData || []).filter((d: any) => d.notebook_id === nb.id);
      
      const documents: NotebookDocument[] = [];
      const notes: QuickNote[] = [];

      for (const d of nbDocsRaw) {
        // Collect chunks for this document
        const chunks: DocumentChunk[] = allChunks
          .filter((c: any) => c.document_id === d.id)
          .sort((a: any, b: any) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0))
          .map((c: any) => ({
            id: c.id,
            document_id: c.document_id,
            content: c.content,
            embedding: c.embedding || undefined,
            metadata: c.metadata || undefined,
            created_at: c.created_at
          }));

        // Full content reconstructed from chunks if not stored separately
        const reconstructedContent = chunks.map(c => c.content).join('\n\n');

        if (d.file_type === 'note') {
          notes.push({
            id: d.id,
            notebook_id: nb.id,
            title: d.name.replace(/\.note$/, ''),
            content: reconstructedContent,
            created_at: d.created_at
          });
        } else {
          documents.push({
            id: d.id,
            notebook_id: nb.id,
            name: d.name,
            file_path: d.file_path,
            file_type: d.file_type as any,
            content: reconstructedContent,
            charCount: reconstructedContent.length,
            chunksCount: chunks.length,
            enabledInRag: true,
            created_at: d.created_at,
            chunks
          });
        }
      }

      return {
        id: nb.id,
        user_id: nb.user_id,
        title: nb.title,
        description: nb.description || '',
        created_at: nb.created_at,
        updated_at: nb.updated_at,
        documents,
        notes
      };
    });

    return result;
  } catch (e) {
    console.error('Falha ao carregar cadernos do Supabase:', e);
    return [];
  }
}

/**
 * Persist a complete notebook to Supabase (upsert notebook, documents and chunks)
 */
export async function persistNotebookToSupabase(notebook: Notebook, userId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client || !userId) return false;

  try {
    const validNotebookId = ensureUUID(notebook.id);

    // 1. Upsert Notebook
    const { error: nbErr } = await client
      .from('notebooks')
      .upsert({
        id: validNotebookId,
        user_id: userId,
        title: notebook.title || 'Caderno Sem Título',
        description: notebook.description || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (nbErr) {
      console.error('Erro ao persistir notebook no Supabase:', nbErr);
      return false;
    }

    // 2. Persist Documents and Chunks
    for (const doc of notebook.documents) {
      await persistDocumentToSupabase(doc, validNotebookId);
    }

    // 3. Persist Quick Notes (stored as documents of type 'note')
    for (const note of notebook.notes) {
      await persistNoteAsDocument(note, validNotebookId);
    }

    return true;
  } catch (err) {
    console.error('Exceção ao persistir notebook no Supabase:', err);
    return false;
  }
}

/**
 * Alias for manual or bulk sync of a complete notebook to Supabase
 */
export const syncFullNotebook = persistNotebookToSupabase;

/**
 * Persist a document and its text chunks to Supabase
 */
export async function persistDocumentToSupabase(doc: NotebookDocument, notebookId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const validDocId = ensureUUID(doc.id);
    const validNbId = ensureUUID(notebookId);

    // 1. Upsert Document
    const { error: docErr } = await client
      .from('documents')
      .upsert({
        id: validDocId,
        notebook_id: validNbId,
        name: doc.name,
        file_path: doc.file_path || null,
        file_type: doc.file_type || 'txt',
        created_at: doc.created_at || new Date().toISOString()
      }, { onConflict: 'id' });

    if (docErr) {
      console.error('Erro ao salvar documento no Supabase:', docErr);
      return false;
    }

    // 2. Upsert Chunks
    if (doc.chunks && doc.chunks.length > 0) {
      const chunkPayloads = doc.chunks.map(c => ({
        id: ensureUUID(c.id),
        document_id: validDocId,
        content: c.content,
        embedding: c.embedding || null,
        metadata: c.metadata || {},
        created_at: c.created_at || new Date().toISOString()
      }));

      // Upsert in batches of 50
      for (let i = 0; i < chunkPayloads.length; i += 50) {
        const batch = chunkPayloads.slice(i, i + 50);
        const { error: chunkErr } = await client
          .from('document_chunks')
          .upsert(batch, { onConflict: 'id' });
        if (chunkErr) {
          console.warn('Erro ao salvar chunks no Supabase:', chunkErr);
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Exceção ao salvar documento no Supabase:', err);
    return false;
  }
}

/**
 * Persist a quick note as a document of file_type 'note' with single chunk
 */
export async function persistNoteAsDocument(note: QuickNote, notebookId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const validNoteId = ensureUUID(note.id);
    const validNbId = ensureUUID(notebookId);

    const { error: docErr } = await client
      .from('documents')
      .upsert({
        id: validNoteId,
        notebook_id: validNbId,
        name: `${note.title || 'Nota Rápida'}.note`,
        file_type: 'note',
        created_at: note.created_at || new Date().toISOString()
      }, { onConflict: 'id' });

    if (docErr) return false;

    // Upsert chunk with note content
    const chunkId = ensureUUID();
    await client
      .from('document_chunks')
      .upsert({
        id: chunkId,
        document_id: validNoteId,
        content: note.content || '',
        metadata: { sourceName: note.title, sourceType: 'note' },
        created_at: note.created_at || new Date().toISOString()
      }, { onConflict: 'id' });

    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a document from Supabase (cascades to document_chunks)
 */
export async function deleteDocumentFromSupabase(documentId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client || !documentId) return false;
  try {
    const validDocId = ensureUUID(documentId);
    const { error } = await client.from('documents').delete().eq('id', validDocId);
    if (error) {
      console.warn('Erro ao deletar documento no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Erro ao deletar documento no Supabase:', err);
    return false;
  }
}

/**
 * Delete a note from Supabase (notes are stored in documents table with file_type='note')
 */
export async function deleteNoteFromSupabase(noteId: string): Promise<boolean> {
  return deleteDocumentFromSupabase(noteId);
}

/**
 * Delete a notebook from Supabase (cascades to documents, document_chunks, chat_messages)
 */
export async function deleteNotebookFromSupabase(notebookId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client || !notebookId) return false;
  try {
    const validNbId = ensureUUID(notebookId);
    const { error } = await client.from('notebooks').delete().eq('id', validNbId);
    if (error) {
      console.warn('Erro ao deletar caderno no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Erro ao deletar caderno no Supabase:', err);
    return false;
  }
}

/**
 * Persist a chat message to Supabase chat_messages table
 */
export async function persistChatMessageToSupabase(notebookId: string, message: ChatMessage): Promise<boolean> {
  const client = getSupabase();
  if (!client || !notebookId || !message) return false;

  try {
    const validMsgId = ensureUUID(message.id);
    const validNbId = ensureUUID(notebookId);

    const { error } = await client
      .from('chat_messages')
      .upsert({
        id: validMsgId,
        notebook_id: validNbId,
        role: message.role,
        content: message.content,
        sources: message.sources || [],
        created_at: message.created_at || new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Erro ao salvar chat_message no Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exceção ao persistir chat_message no Supabase:', err);
    return false;
  }
}

/**
 * Load all chat messages for a notebook from Supabase
 */
export async function fetchChatMessagesFromSupabase(notebookId: string): Promise<ChatMessage[]> {
  const client = getSupabase();
  if (!client || !notebookId) return [];

  try {
    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .eq('notebook_id', notebookId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((m: any) => ({
      id: m.id,
      notebook_id: m.notebook_id,
      role: m.role,
      content: m.content,
      sources: m.sources || [],
      created_at: m.created_at
    }));
  } catch {
    return [];
  }
}

/**
 * Clear all chat messages for a notebook in Supabase
 */
export async function clearChatMessagesFromSupabase(notebookId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client || !notebookId) return false;
  try {
    const { error } = await client.from('chat_messages').delete().eq('notebook_id', notebookId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Test connection and check tables and auth status
 */
export async function testSupabaseConnection(url: string, anonKey: string): Promise<{
  success: boolean;
  message: string;
  tablesFound?: string[];
  currentUser?: User | null;
  requiresAuth?: boolean;
}> {
  try {
    const client = createClient(url.trim(), anonKey.trim());
    
    // 1. Check current session/user
    const { data: { user } } = await client.auth.getUser();

    // 2. Check notebooks table
    const { data: notebooks, error: nbError } = await client
      .from('notebooks')
      .select('id, title, user_id')
      .limit(1);

    if (nbError) {
      if (nbError.message.includes('relation "public.notebooks" does not exist') || nbError.code === '42P01') {
        return {
          success: false,
          message: 'Conectado ao Supabase, mas a tabela "notebooks" não existe. Execute o script SQL no Supabase SQL Editor.',
          tablesFound: []
        };
      }

      // Check if blocked by RLS
      if (nbError.message.includes('policy') || nbError.code === '42501') {
        return {
          success: true,
          message: 'Conectado ao Supabase! As tabelas possuem RLS ativado (auth.uid() = user_id). Faça login ou cadastre-se no painel para sincronizar seus dados.',
          requiresAuth: true,
          currentUser: user
        };
      }

      return {
        success: false,
        message: `Aviso do Supabase: ${nbError.message}`
      };
    }

    return {
      success: true,
      message: user
        ? `Conectado ao Supabase com sessão ativa (${user.email})! Sincronização automática em nuvem habilitada.`
        : 'Conectado ao Supabase com sucesso! Para que seus dados persistam com as regras RLS (auth.uid()), faça login com sua conta.',
      tablesFound: ['notebooks', 'documents', 'document_chunks', 'chat_messages', 'profiles'],
      currentUser: user,
      requiresAuth: !user
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao conectar com o Supabase. Verifique a URL e a Chave Anon.'
    };
  }
}

/**
 * Execute RPC match_document_chunks if available
 */
export async function searchChunksViaSupabase(
  queryEmbedding: number[],
  notebookId: string,
  threshold = 0.35,
  count = 5
): Promise<any[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: count,
      filter_notebook_id: ensureUUID(notebookId)
    });

    if (error) {
      console.warn('Erro ao chamar match_document_chunks RPC:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.warn('Exceção ao pesquisar via Supabase RPC:', e);
    return [];
  }
}
