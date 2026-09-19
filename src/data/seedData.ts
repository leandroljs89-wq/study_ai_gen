import { Notebook } from '../types';
import { chunkDocument } from '../lib/ragEngine';

const initialNotebookId = 'a1111111-1111-4111-8111-111111111111';
const doc1Id = 'b2222222-2222-4222-8222-222222222222';
const doc2Id = 'c3333333-3333-4333-8333-333333333333';
const doc3Id = 'd4444444-4444-4444-8444-444444444444';
const note1Id = 'e5555555-5555-4555-8555-555555555555';

const doc1Text = `ARQUITETURA RAG (RETRIEVAL-AUGMENTED GENERATION) E BANCOS VETORIAIS

O RAG (Geração Aumentada por Recuperação) revolucionou a forma como modelos de linguagem interagem com bases de conhecimento proprietárias. Em vez de injetar documentos inteiros na janela de contexto — o que resulta em custos estratosféricos de tokens e no fenômeno "Lost in the Middle" —, o RAG opera com precisão cirúrgica.

1. PROCESSAMENTO E CHUNKING:
Ao receber um documento (seja PDF, TXT ou artigo web), o primeiro passo é o particionamento textual (chunking). Chunks ideais variam entre 500 e 800 caracteres com sobreposição (overlap) de 10% a 20%. Isso garante que a continuidade semântica não seja rompida entre parágrafos adjacentes.

2. EMBEDDINGS E ESPAÇO VETORIAL:
Cada chunk passa por um modelo de representação vetorial (como text-embedding-3-small da OpenAI ou text-embedding-004 do Google), convertendo o texto em um vetor de ponto flutuante de dimensão fixa (ex: 1536 dimensões). No banco de dados relacional com extensão pgvector, criam-se índices HNSW (Hierarchical Navigable Small World) com métrica de distância por cosseno (vector_cosine_ops), permitindo buscas com latência inferior a 15 milissegundos mesmo com milhões de registros.

3. RECUPERAÇÃO HÍBRIDA E ECONOMIA DE TOKENS:
Antes de despachar o prompt ao LLM, o sistema executa uma busca de similaridade e recupera estritamente os top 3 a 5 trechos mais relevantes. O prompt sintetizado contém apenas o histórico recente, os trechos identificados e a instrução de citar as fontes. O resultado é uma economia de tokens que frequentemente ultrapassa 90% em comparação ao envio integral do documento.`;

const doc2Text = `GUIA COMPARATIVO DE PROVEDORES DE IA E MODELOS (2025/2026)

A diversidade de provedores permite selecionar o modelo ideal para cada caso de uso:

1. GOOGLE GEMINI (Gemini 2.5 Flash & Pro):
O Gemini se destaca pela velocidade excepcional e capacidade nativa multimodal. O Gemini 2.5 Flash oferece latência ultra baixa com precisão superior para tarefas de RAG e síntese de documentos em tempo real. Possui suporte a contexto estendido de até 1 milhão de tokens.

2. OPENAI (GPT-4o & GPT-4o Mini):
O GPT-4o lidera em aderência a formatações complexas e raciocínio multi-etapa. O GPT-4o Mini é uma alternativa de altíssimo custo-benefício para classificação rápida de chunks e sumarização. Modelos da série 'o' (o1, o3-mini) oferecem cadeias de pensamento para deduções matemáticas e lógicas profundas.

3. ANTHROPIC (Claude 3.5 Sonnet & Claude 3.5 Haiku):
O Claude 3.5 Sonnet é amplamente reconhecido pela clareza de escrita, tom natural e fidelidade inigualável às instruções do sistema, minimizando alucinações ao sintetizar fontes acadêmicas e técnicas.

4. GROQ (LPUs - Llama 3.3 70B & Llama 3.1 8B):
Utilizando Unidades de Processamento de Linguagem (LPUs), o Groq atinge velocidades de inferência superiores a 300 tokens por segundo. É a melhor escolha quando a resposta precisa surgir quase instantaneamente.

5. OLLAMA (Modelos Locais e Privativos):
Para ambientes com exigências rigorosas de conformidade e privacidade de dados, o Ollama permite executar modelos abertos (DeepSeek R1, Llama 3, Mistral, Qwen 2.5) localmente sem tráfego de dados para servidores externos.`;

const doc3Text = `INTEGRAÇÃO COM SUPABASE & ESPECIFICAÇÃO DE SEGURANÇA

O Supabase fornece a infraestrutura ideal para armazenar tanto os metadados dos cadernos quanto os vetores de alta dimensionalidade através do PostgreSQL e pgvector.

1. TABELAS PRINCIPAIS:
- profiles: Guarda dados do usuário e as API Keys criptografadas ou salvas por perfil (openai_api_key, anthropic_api_key, gemini_api_key, groq_api_key, ollama_host).
- notebooks: Organiza os cadernos criados pelo usuário com título e descrição.
- documents: Registra os arquivos associados a cada caderno (PDFs, TXT, notas e web links).
- document_chunks: Contém o conteúdo do texto dividido e o vetor de 1536 dimensões com índice HNSW.
- chat_messages: Mantém o histórico com indicação das fontes em formato JSONB.

2. BUSCA VETORIAL RPC:
A função match_document_chunks recebe o vetor da consulta do usuário (query_embedding), calcula o cosseno (1 - (dc.embedding <=> query_embedding)) e aplica filtro pelo notebook_id do usuário autenticado (auth.uid()), retornando os chunks mais similares com ordenação decrescente.

3. ROW LEVEL SECURITY (RLS):
Todas as tabelas contam com políticas RLS ativadas, garantindo isolamento absoluto de dados entre múltiplos usuários.`;

const doc1Chunks = chunkDocument(doc1Text, doc1Id, 'Guia_Arquitetura_RAG_e_Vetores.txt', 'txt');
const doc2Chunks = chunkDocument(doc2Text, doc2Id, 'Manual_Provedores_LLM_e_APIs.txt', 'txt');
const doc3Chunks = chunkDocument(doc3Text, doc3Id, 'Especificacao_NotebookLM_Supabase.note', 'note');

export const sampleNotebook: Notebook = {
  id: initialNotebookId,
  title: 'Pesquisa & Arquitetura RAG',
  description: 'Caderno de estudo sobre RAG, modelos de linguagem e bancos vetoriais.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  documents: [
    {
      id: doc1Id,
      notebook_id: initialNotebookId,
      name: 'Guia_Arquitetura_RAG_e_Vetores.txt',
      file_type: 'txt',
      content: doc1Text,
      charCount: doc1Text.length,
      chunksCount: doc1Chunks.length,
      enabledInRag: true,
      created_at: new Date().toISOString(),
      chunks: doc1Chunks
    },
    {
      id: doc2Id,
      notebook_id: initialNotebookId,
      name: 'Manual_Provedores_LLM_e_APIs.txt',
      file_type: 'txt',
      content: doc2Text,
      charCount: doc2Text.length,
      chunksCount: doc2Chunks.length,
      enabledInRag: true,
      created_at: new Date().toISOString(),
      chunks: doc2Chunks
    },
    {
      id: doc3Id,
      notebook_id: initialNotebookId,
      name: 'Especificacao_NotebookLM_Supabase.note',
      file_type: 'note',
      content: doc3Text,
      charCount: doc3Text.length,
      chunksCount: doc3Chunks.length,
      enabledInRag: true,
      created_at: new Date().toISOString(),
      chunks: doc3Chunks
    }
  ],
  notes: [
    {
      id: note1Id,
      notebook_id: initialNotebookId,
      title: 'Insight: Eficiência de Custo',
      content: 'Com RAG bem calibrado, reduz-se o tamanho médio do prompt de ~15k tokens para apenas ~800 tokens, acelerando a inferência em 4x.',
      created_at: new Date().toISOString()
    }
  ]
};
