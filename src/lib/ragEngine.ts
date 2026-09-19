import { DocumentChunk, DocumentType, NotebookDocument, RAGSearchResult } from '../types';
import { generateUUID } from './uuid';

/**
 * Intelligent text chunker that respects sentence and paragraph boundaries.
 * Enforces token discipline by producing optimal 500-750 character chunks with overlap.
 */
export function chunkDocument(
  text: string,
  documentId: string,
  documentName: string,
  documentType: DocumentType,
  chunkSize: number = 650,
  overlap: number = 100
): DocumentChunk[] {
  if (!text || text.trim().length === 0) return [];

  const cleanText = text.replace(/\r\n/g, '\n').trim();
  const chunks: DocumentChunk[] = [];

  // Split into natural paragraph blocks first
  const paragraphs = cleanText.split(/\n{2,}/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (currentChunk.length + trimmedPara.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    } else {
      // If current chunk is already big enough, push it
      if (currentChunk.length > 0) {
        chunks.push(createChunkObj(currentChunk, documentId, documentName, documentType, chunkIndex));
        chunkIndex++;
        // Maintain overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.max(10, Math.floor(overlap / 7))).join(' ');
        currentChunk = overlapWords + ' ' + trimmedPara;
      } else {
        // If single paragraph is larger than chunkSize, break by sentences
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [trimmedPara];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
          } else {
            if (currentChunk.length > 0) {
              chunks.push(createChunkObj(currentChunk, documentId, documentName, documentType, chunkIndex));
              chunkIndex++;
            }
            currentChunk = sentence.trim();
          }
        }
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(createChunkObj(currentChunk.trim(), documentId, documentName, documentType, chunkIndex));
  }

  // Update totalChunks in metadata
  const total = chunks.length;
  chunks.forEach((c, idx) => {
    if (c.metadata) {
      c.metadata.chunkIndex = idx + 1;
      c.metadata.totalChunks = total;
    }
  });

  return chunks;
}

function createChunkObj(
  content: string,
  documentId: string,
  sourceName: string,
  sourceType: DocumentType,
  index: number
): DocumentChunk {
  return {
    id: generateUUID(),
    document_id: documentId,
    content: content.trim(),
    metadata: {
      chunkIndex: index + 1,
      totalChunks: 1,
      charCount: content.length,
      sourceName,
      sourceType
    },
    created_at: new Date().toISOString()
  };
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a?: number[], b?: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

/**
 * Stopwords filter for Portuguese and English to avoid semantic noise in keyword match
 */
const STOP_WORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma',
  'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele',
  'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já',
  'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era',
  'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles',
  'the', 'is', 'at', 'which', 'on', 'and', 'or', 'for', 'with', 'in', 'to', 'of', 'this'
]);

/**
 * BM25 / Keyword overlap score calculation
 */
function keywordRelevanceScore(query: string, content: string): number {
  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (queryTokens.length === 0) return 0;

  const contentLower = content.toLowerCase();
  let matches = 0;
  let exactMatchBonus = 0;

  for (const token of queryTokens) {
    // Check whole word or substring
    const regex = new RegExp(`\\b${token}`, 'i');
    if (regex.test(contentLower)) {
      matches++;
    }
  }

  // Exact query phrase bonus
  if (contentLower.includes(query.toLowerCase().trim())) {
    exactMatchBonus = 0.35;
  }

  const ratio = matches / queryTokens.length;
  return Math.min(1, ratio * 0.7 + exactMatchBonus);
}

/**
 * Hybrid Semantic & Keyword RAG Retriever
 * Retrieves only the top most relevant chunks from active, enabled documents.
 */
export function hybridRetrieveChunks(
  query: string,
  activeDocuments: NotebookDocument[],
  queryVector?: number[],
  topK: number = 5,
  minThreshold: number = 0.20
): RAGSearchResult[] {
  const results: RAGSearchResult[] = [];
  const enabledDocs = activeDocuments.filter(d => d.enabledInRag);
  const docMap = new Map<string, NotebookDocument>();
  enabledDocs.forEach(d => docMap.set(d.id, d));

  const allChunks: { chunk: DocumentChunk; doc: NotebookDocument }[] = [];
  for (const doc of enabledDocs) {
    if (doc.chunks && doc.chunks.length > 0) {
      for (const chunk of doc.chunks) {
        allChunks.push({ chunk, doc });
      }
    }
  }

  if (allChunks.length === 0) return [];

  for (const item of allChunks) {
    const kwScore = keywordRelevanceScore(query, item.chunk.content);
    let vecScore = 0;

    if (queryVector && item.chunk.embedding && item.chunk.embedding.length > 0) {
      vecScore = cosineSimilarity(queryVector, item.chunk.embedding);
    }

    // Weighted hybrid score (favoring vector if available, blending with keyword)
    const hybridScore = queryVector && item.chunk.embedding
      ? 0.65 * vecScore + 0.35 * kwScore
      : kwScore;

    if (hybridScore >= minThreshold || (allChunks.length <= topK && hybridScore > 0.05)) {
      results.push({
        chunk: item.chunk,
        document: item.doc,
        similarity: Number(hybridScore.toFixed(3)),
        method: queryVector ? 'hybrid' : 'vector'
      });
    }
  }

  // Sort descending by similarity
  results.sort((a, b) => b.similarity - a.similarity);

  // Fallback: If no chunk met threshold, return top 2 chunks so LLM has at least baseline context
  if (results.length === 0 && allChunks.length > 0) {
    const fallbackTop = allChunks.slice(0, 2).map(item => ({
      chunk: item.chunk,
      document: item.doc,
      similarity: 0.25,
      method: 'hybrid' as const
    }));
    return fallbackTop;
  }

  return results.slice(0, topK);
}

/**
 * Estimate tokens based on characters (approx 3.8 chars per token for multilingual text)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}
