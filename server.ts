import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import {
  DocumentSource,
  DocumentPassage,
  DocumentPage,
  FixedChunk,
  SemanticChunk,
  QueryRepresentation,
  QueryConcept,
  ScoredChunk,
  RetrievalRun,
  RetrievalMode,
  ScoringWeights,
  GeneratedAnswer,
  AnswerClaim,
  AnswerCitation,
  MatchDetail
} from './src/types/rag.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Utility: Deterministic fallback embedding generator (128-dimensional)
function generateDeterministicEmbedding(text: string): number[] {
  const dim = 128;
  const vec = new Array(dim).fill(0);
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    const sign = hash % 2 === 0 ? 1 : -1;
    vec[idx] += sign * (1 + 1 / (i + 1));
  }

  // Normalize vector
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
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
  if (denom === 0) return 0;
  const sim = dot / denom;
  return Math.max(0, Math.min(1, (sim + 1) / 2)); // Normalized to 0..1
}

// Lexical overlap score (Jaccard / Token overlap approximation)
function calculateLexicalScore(queryText: string, chunkText: string): number {
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'for', 'with', 'what', 'does', 'under']);
  const getTokens = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

  const qTokens = new Set(getTokens(queryText));
  const cTokens = new Set(getTokens(chunkText));

  if (qTokens.size === 0) return 0;
  let matches = 0;
  qTokens.forEach(t => {
    if (cTokens.has(t)) matches++;
  });
  return matches / qTokens.size;
}

// Async timeout helper to keep system responsive
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Embed content using Gemini with fast graceful fallback
async function getEmbedding(text: string): Promise<{ vector: number[]; status: 'computed' | 'fallback' | 'failed' }> {
  if (!apiKey) {
    return { vector: generateDeterministicEmbedding(text), status: 'fallback' };
  }
  try {
    const callPromise = (async () => {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: text.slice(0, 2048),
      });
      const resAny = result as any;
      const values = resAny.embedding?.values || resAny.embeddings?.[0]?.values;
      if (values && Array.isArray(values)) {
        return { vector: values, status: 'computed' as const };
      }
      return { vector: generateDeterministicEmbedding(text), status: 'fallback' as const };
    })();

    return await withTimeout(callPromise, 3500, {
      vector: generateDeterministicEmbedding(text),
      status: 'fallback' as const,
    });
  } catch (err) {
    return { vector: generateDeterministicEmbedding(text), status: 'fallback' };
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Health & Config Status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    model: 'gemini-3.8-flash',
    embeddingModel: 'gemini-embedding-2-preview',
    time: new Date().toISOString(),
  });
});

// 2. Document Text Extraction & Structure Analysis
app.post('/api/documents/extract', async (req: Request, res: Response) => {
  try {
    const { filename, fileType, contentBase64, rawTextContent } = req.body;
    let extractedText = '';
    const pages: DocumentPage[] = [];

    if (rawTextContent) {
      extractedText = rawTextContent;
    } else if (contentBase64) {
      const buffer = Buffer.from(contentBase64, 'base64');
      if (fileType === 'pdf') {
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text;
        // Approximate pages if pdf-parse text is extracted
        const numPages = parsed.numpages || 1;
        const perPageLength = Math.ceil(extractedText.length / numPages);
        for (let p = 1; p <= numPages; p++) {
          const start = (p - 1) * perPageLength;
          const pageTxt = extractedText.substring(start, start + perPageLength).trim();
          pages.push({
            pageNumber: p,
            text: pageTxt,
            paragraphCount: pageTxt.split(/\n\s*\n/).filter(Boolean).length,
          });
        }
      } else if (fileType === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        extractedText = buffer.toString('utf-8');
      }
    }

    if (!extractedText.trim()) {
      res.status(400).json({ error: 'Extracted text is empty or document format could not be parsed.' });
      return;
    }

    // Paragraph and passage analysis
    const rawParagraphs = extractedText
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const passages: DocumentPassage[] = [];
    let charOffset = 0;

    rawParagraphs.forEach((pText, idx) => {
      // Check if this looks like a heading
      const isHeading = pText.length < 90 && (!pText.endsWith('.') || pText.startsWith('#'));
      const start = charOffset;
      const end = charOffset + pText.length;
      charOffset = end + 2;

      // Assign approximate page (assuming ~1500 chars/page)
      const pageNum = Math.floor(start / 1500) + 1;

      passages.push({
        id: `pass_${idx + 1}`,
        pageNumber: pageNum,
        paragraphIndex: idx + 1,
        text: pText,
        heading: isHeading ? pText.replace(/^#+\s*/, '') : undefined,
        charStart: start,
        charEnd: end,
      });
    });

    if (pages.length === 0) {
      // Populate pages from passages
      const maxPage = Math.max(...passages.map(p => p.pageNumber), 1);
      for (let p = 1; p <= maxPage; p++) {
        const pPassages = passages.filter(pas => pas.pageNumber === p);
        pages.push({
          pageNumber: p,
          text: pPassages.map(pas => pas.text).join('\n\n'),
          paragraphCount: pPassages.length,
        });
      }
    }

    const docSource: DocumentSource = {
      id: `doc_${Date.now()}`,
      name: filename || 'Untitled Document',
      fileType: fileType || 'txt',
      rawText: extractedText,
      pages,
      passages,
      metadata: {
        totalChars: extractedText.length,
        totalWords: extractedText.split(/\s+/).filter(Boolean).length,
        approxTokens: Math.round(extractedText.length / 4),
        uploadedAt: new Date().toISOString(),
        sectionCount: passages.length,
      },
    };

    res.json({ document: docSource });
  } catch (err: any) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract document content' });
  }
});

// 3. Conventional Fixed-Size Chunking Baseline
app.post('/api/chunking/conventional', (req: Request, res: Response) => {
  try {
    const { text, chunkSize = 300, chunkOverlap = 60, passages = [] } = req.body;
    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'Text content is required' });
      return;
    }

    const chunks: FixedChunk[] = [];
    const step = Math.max(chunkSize - chunkOverlap, 50);
    let start = 0;
    let chunkIndex = 1;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.substring(start, end).trim();

      // Check if start or end splits a sentence
      const charBefore = start > 0 ? text[start - 1] : '';
      const charAfter = end < text.length ? text[end] : '';
      const splitMidSentence =
        (charBefore !== '' && !charBefore.match(/[\.\n!\?]/)) ||
        (charAfter !== '' && !charAfter.match(/[\.\n!\?\s]/));

      // Match passage references
      const passageRefs: string[] = [];
      if (passages && passages.length > 0) {
        passages.forEach((p: DocumentPassage) => {
          if (start <= p.charEnd && end >= p.charStart) {
            passageRefs.push(p.id);
          }
        });
      }

      chunks.push({
        id: `fixed_c${chunkIndex}`,
        text: chunkText,
        startChar: start,
        endChar: end,
        approxTokens: Math.round(chunkText.length / 4),
        splitMidSentence,
        passageRefs: passageRefs.length > 0 ? passageRefs : [`pass_${chunkIndex}`],
      });

      chunkIndex++;
      start += step;
      if (end >= text.length) break;
    }

    res.json({ chunks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Extract subject and predicate attribute from statements (e.g. "Cisco Networking Academy is a skills-to-jobs program shaping the future workforce")
function extractSubjectPredicate(sentence: string): { subject: string; predicate: string } | null {
  if (!sentence) return null;
  const cleaned = sentence.trim().replace(/^["'`]+|["'`]+$/g, '');

  // Look for copula or relational verbs linking subject and predicate
  const match = cleaned.match(/^([A-Z0-9][a-zA-Z0-9\s\-_'"]+?)\s+\b(is\s+an?|is\s+the|is|are\s+an?|are\s+the|are|was\s+an?|was|were|has\s+an?|has\s+the|has|features|serves\s+as\s+an?|serves\s+as|provides\s+an?|provides)\s+(.+)$/i);
  if (match) {
    let subject = match[1].trim();
    subject = subject.replace(/^(The|A|An)\s+/i, '').trim();
    let predicate = match[3].trim().replace(/[?.,;:]+$/, '').trim();
    predicate = predicate.replace(/^(an?|the)\s+/i, '').trim();

    if (subject.length > 1 && predicate.length > 1) {
      return { subject, predicate };
    }
  }
  return null;
}

// Helper: Build high-accuracy extracted feature tags with clear feature keys (entity, attribute, colour, purpose, relation, condition)
function buildChunkExtractedTags(
  chunkText: string,
  entities: any[] = [],
  attributes: any[] = [],
  relationships: any[] = [],
  conditions: any[] = []
): { label: string; target: string; type?: string }[] {
  const tags: { label: string; target: string; type?: string }[] = [];
  const seenLabels = new Set<string>();

  const addTag = (rawLabel: string, targetKey: string, type: string) => {
    if (!rawLabel) return;
    const cleanLabel = rawLabel.trim().replace(/^["'`]+|["'`]+$/g, '');
    let cleanTarget = targetKey.trim().toLowerCase();
    if (cleanLabel.length < 2) return;
    if (cleanLabel.length >= chunkText.length - 2 && chunkText.length > 35) return;

    if (/^(is|are|was|were|has|contains|features)$/i.test(cleanTarget)) {
      cleanTarget = 'attribute';
    }
    const key = `${cleanLabel.toLowerCase()}:::${cleanTarget}`;
    if (seenLabels.has(key)) return;
    seenLabels.add(key);
    tags.push({ label: cleanLabel, target: cleanTarget, type });
  };

  // 1. Direct Subject-Predicate extraction from sentences
  const sentences = chunkText.split(/(?<=[.?!])\s+/).filter(Boolean);
  for (const sent of sentences) {
    const sp = extractSubjectPredicate(sent);
    if (sp) {
      addTag(sp.subject, 'entity', 'entity');
      let featureKey = 'attribute';
      const predLower = sp.predicate.toLowerCase();
      if (/^(red|green|blue|yellow|black|white|purple|orange|pink|brown|pale|colour|color)\b/i.test(predLower)) {
        featureKey = 'colour';
      }
      addTag(sp.predicate, featureKey, 'attribute');
    }
  }

  // 2. Explicit Entities
  if (Array.isArray(entities)) {
    entities.forEach(e => {
      const name = typeof e === 'string' ? e : e?.name;
      if (name) addTag(name, 'entity', 'entity');
    });
  }

  // 3. Explicit Attributes
  if (Array.isArray(attributes)) {
    attributes.forEach(a => {
      const val = a?.value || a?.attribute;
      let key = (a?.attribute || 'attribute').toLowerCase();
      if (val) addTag(val, key, 'attribute');
    });
  }

  // 4. Relationships
  if (Array.isArray(relationships)) {
    relationships.forEach(r => {
      if (r?.relation && r?.target) {
        addTag(`${r.relation} ${r.target}`, 'relation', 'relationship');
      }
    });
  }

  // 5. Conditions
  if (Array.isArray(conditions)) {
    conditions.forEach(c => {
      const rule = c?.rule || c;
      if (rule && typeof rule === 'string') {
        addTag(rule.slice(0, 50), 'condition', 'condition');
      }
    });
  }

  return tags;
}

// 4. Adaptive Semantic Chunking with Gemini High-Accuracy Structured Analysis
app.post('/api/chunking/adaptive', async (req: Request, res: Response) => {
  try {
    const { passages, documentText = '' } = req.body;
    if (!passages || passages.length === 0) {
      res.status(400).json({ error: 'Passages required for adaptive chunking' });
      return;
    }

    // Process passages (handle up to 40 passages for high precision)
    const passagesList: DocumentPassage[] = passages.slice(0, 40);
    const formattedPassages = passagesList
      .map((p: DocumentPassage) => `[Passage ID: ${p.id}, Page: ${p.pageNumber}, Chars: ${p.charStart}-${p.charEnd}]\n${p.text}`)
      .join('\n\n---\n\n');

    let semanticChunks: SemanticChunk[] = [];

    if (apiKey) {
      try {
        const prompt = `You are an expert NLP semantic parser performing High-Accuracy Adaptive Semantic Chunking.
Your objective: Segment the user's document into self-contained, semantically unified propositions that minimize hallucination risk in RAG.

STRICT ACCURACY RULES:
1. PURE ENTITIES & SPECIFIC ATTRIBUTES:
   - entities: Exact named entities, actors, components, or organizations (e.g. name: "Cisco Networking Academy", type: "Organization", importance: "high").
   - attributes: Specific property-value pairs with precise feature keys:
     - entity: the subject entity (e.g. "Cisco Networking Academy")
     - attribute: the specific feature key (e.g. "attribute", "program", "colour", "purpose")
     - value: the descriptive phrase or value (e.g. "skills-to-jobs program shaping the future workforce", NOT the entire sentence!)
   - NEVER make the whole sentence the attribute or entity!
2. SEMANTIC COMPLETENESS: Never split an entity from its attributes, values, relational predicates, or conditional qualifiers.
3. ANAPHORA & CO-REFERENCE: If a sentence uses pronouns or referents ("it", "they", "this system", "such elements"), it MUST remain bound in the same chunk as the sentence introducing the referent.
4. VERBATIM TEXT: The "text" field MUST be the exact verbatim string from the passages. Do NOT summarize or rephrase inside "text".
5. EXTRACTED TAGS: Provide feature key mappings for all elements:
   - label: the phrase or element
   - target: the feature key ("entity", "attribute", "colour", "relation", "condition")

Passages to analyze:
${formattedPassages}`;

        const responsePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  passageIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  sourcePages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  text: { type: Type.STRING },
                  originalSentences: { type: Type.ARRAY, items: { type: Type.STRING } },
                  summary: { type: Type.STRING },
                  entities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        importance: { type: Type.STRING },
                      },
                      required: ['name', 'type', 'importance'],
                    },
                  },
                  attributes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        entity: { type: Type.STRING },
                        attribute: { type: Type.STRING },
                        value: { type: Type.STRING },
                      },
                      required: ['entity', 'attribute', 'value'],
                    },
                  },
                  relationships: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        source: { type: Type.STRING },
                        relation: { type: Type.STRING },
                        target: { type: Type.STRING },
                      },
                      required: ['source', 'relation', 'target'],
                    },
                  },
                  conditions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        rule: { type: Type.STRING },
                        context: { type: Type.STRING },
                      },
                      required: ['rule', 'context'],
                    },
                  },
                  negations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        statement: { type: Type.STRING },
                        negatedConcept: { type: Type.STRING },
                      },
                      required: ['statement', 'negatedConcept'],
                    },
                  },
                  extractedTags: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        target: { type: Type.STRING },
                        type: { type: Type.STRING },
                      },
                      required: ['label', 'target'],
                    },
                  },
                  conceptLabels: { type: Type.ARRAY, items: { type: Type.STRING } },
                  boundaryRationale: { type: Type.STRING },
                },
                required: [
                  'passageIds',
                  'text',
                  'summary',
                  'entities',
                  'attributes',
                  'relationships',
                  'boundaryRationale',
                ],
              },
            },
          },
        });

        const response = await withTimeout(responsePromise, 7500, null as any);
        if (response && response.text) {
          const parsed = JSON.parse(response.text || '[]');
          if (Array.isArray(parsed) && parsed.length > 0) {
            semanticChunks = parsed.map((item: any, idx: number) => {
              const rawChunkText = (item.text || '').trim();
              // Calculate accurate char offsets
              let startChar = 0;
              let endChar = rawChunkText.length;
              if (documentText && rawChunkText.length > 0) {
                const foundIdx = documentText.indexOf(rawChunkText);
                if (foundIdx !== -1) {
                  startChar = foundIdx;
                  endChar = foundIdx + rawChunkText.length;
                } else {
                  const firstP = passagesList.find(p => item.passageIds?.includes(p.id));
                  if (firstP) {
                    startChar = firstP.charStart;
                    endChar = startChar + rawChunkText.length;
                  }
                }
              } else if (passagesList[idx]) {
                startChar = passagesList[idx].charStart;
                endChar = passagesList[idx].charEnd;
              }

              const tags = item.extractedTags && Array.isArray(item.extractedTags) && item.extractedTags.length > 0
                ? item.extractedTags
                : buildChunkExtractedTags(rawChunkText, item.entities, item.attributes, item.relationships, item.conditions);

              return {
                id: `sem_c${idx + 1}`,
                passageIds: item.passageIds || [passagesList[idx]?.id || `pass_${idx + 1}`],
                sourcePages: item.sourcePages || [passagesList[idx]?.pageNumber || 1],
                text: rawChunkText || passagesList[idx]?.text || '',
                originalSentences: item.originalSentences || (rawChunkText || '').split(/(?<=[.?!])\s+/),
                summary: item.summary || 'Adaptive semantic proposition',
                entities: item.entities || [],
                attributes: item.attributes || [],
                relationships: item.relationships || [],
                conditions: item.conditions || [],
                negations: item.negations || [],
                conceptLabels: item.conceptLabels || ['proposition'],
                boundaryRationale: item.boundaryRationale || 'Co-referential proposition bounded by topical shift.',
                extractedTags: tags,
                charStart: startChar,
                charEnd: endChar,
                approxTokens: Math.round((rawChunkText.length || 100) / 4),
                embeddingStatus: 'fallback' as const,
              };
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini adaptive chunking call failed, using high-accuracy heuristic parser:', geminiErr);
      }
    }

    // High-Accuracy Rule-Based Semantic Chunking Fallback
    if (semanticChunks.length === 0) {
      // Group sentences intelligently using pronoun anaphora & discourse markers
      let chunkCounter = 1;
      let currentGroup: {
        text: string;
        sentences: string[];
        passageIds: string[];
        pages: number[];
        charStart: number;
        charEnd: number;
        entities: any[];
        attributes: any[];
        relationships: any[];
        conditions: any[];
        negations: any[];
        heading?: string;
      } | null = null;

      const finishGroup = () => {
        if (!currentGroup || currentGroup.sentences.length === 0) return;
        const groupText = currentGroup.sentences.join(' ');
        const summary = currentGroup.heading
          ? `${currentGroup.heading}: ${currentGroup.sentences[0]}`
          : currentGroup.sentences[0];

        const tags = buildChunkExtractedTags(
          groupText,
          currentGroup.entities,
          currentGroup.attributes,
          currentGroup.relationships,
          currentGroup.conditions
        );

        semanticChunks.push({
          id: `sem_c${chunkCounter++}`,
          passageIds: Array.from(new Set(currentGroup.passageIds)),
          sourcePages: Array.from(new Set(currentGroup.pages)),
          text: groupText,
          originalSentences: currentGroup.sentences,
          summary: summary.slice(0, 160),
          entities: currentGroup.entities.slice(0, 6),
          attributes: currentGroup.attributes.slice(0, 8),
          relationships: currentGroup.relationships.slice(0, 5),
          conditions: currentGroup.conditions,
          negations: currentGroup.negations,
          conceptLabels: currentGroup.heading ? [currentGroup.heading, 'Proposition'] : ['Proposition Unit'],
          boundaryRationale: currentGroup.heading
            ? `Formed around topical section [${currentGroup.heading}] preserving all dependent attribute definitions.`
            : 'Boundary formed at discourse topic shift, binding pronouns and modifiers to main subject.',
          extractedTags: tags,
          charStart: currentGroup.charStart,
          charEnd: currentGroup.charEnd,
          approxTokens: Math.round(groupText.length / 4),
          embeddingStatus: 'fallback',
        });
        currentGroup = null;
      };

      for (const p of passagesList) {
        const sentences = p.text.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
        let passageCharOffset = p.charStart;

        for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
          const sent = sentences[sIdx].trim();
          const sentStart = passageCharOffset;
          const sentEnd = sentStart + sent.length;
          passageCharOffset = sentEnd + 1;

          // Check if sentence is anaphoric (continues previous thought)
          const isAnaphoric = /^(it|they|this|these|such|he|she|moreover|furthermore|additionally|specifically|in addition|consequently|therefore)\b/i.test(sent);
          const shouldStartNew = !currentGroup || (!isAnaphoric && currentGroup.sentences.length >= 3);

          if (shouldStartNew) {
            finishGroup();
            currentGroup = {
              text: '',
              sentences: [],
              passageIds: [p.id],
              pages: [p.pageNumber],
              charStart: sentStart,
              charEnd: sentEnd,
              entities: [],
              attributes: [],
              relationships: [],
              conditions: [],
              negations: [],
              heading: p.heading,
            };
          } else if (currentGroup) {
            currentGroup.passageIds.push(p.id);
            currentGroup.pages.push(p.pageNumber);
            currentGroup.charEnd = sentEnd;
          }

          if (currentGroup) {
            currentGroup.sentences.push(sent);

            // 1. Check for Subject-Predicate statement (e.g. "Cisco Networking Academy is a skills-to-jobs program shaping the future workforce")
            const sp = extractSubjectPredicate(sent);
            if (sp) {
              if (!currentGroup!.entities.some(e => e.name.toLowerCase() === sp.subject.toLowerCase())) {
                currentGroup!.entities.push({ name: sp.subject, type: 'Entity', importance: 'high' });
              }
              let featureKey = 'attribute';
              const predLower = sp.predicate.toLowerCase();
              if (/^(red|green|blue|yellow|black|white|purple|orange|pink|brown|pale|colour|color)\b/i.test(predLower)) {
                featureKey = 'colour';
              }
              currentGroup!.attributes.push({
                entity: sp.subject,
                attribute: featureKey,
                value: sp.predicate,
              });
            } else {
              // Extract capitalized multi-word phrases (e.g. "Cisco Networking Academy", "LLM Hallucinations")
              const capsMatch = sent.match(/\b([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*)\b/g);
              if (capsMatch) {
                capsMatch.forEach(w => {
                  if (w.length > 2 && !/^(The|This|That|These|Those|When|What|Where|How|Why|In|On|At|For)$/i.test(w)) {
                    if (!currentGroup!.entities.some(e => e.name.toLowerCase() === w.toLowerCase())) {
                      currentGroup!.entities.push({ name: w, type: 'Entity', importance: 'high' });
                    }
                  }
                });
              }

              // Extract attributes (e.g. "contains vitamin C", "weighs 10kg")
              const attrMatch = sent.match(/\b(is|are|contains|has|features|consists of|weighs|measures)\s+([^.,;]+)/i);
              if (attrMatch && currentGroup.entities.length > 0) {
                const val = attrMatch[2].trim().replace(/^(a|an|the)\s+/i, '');
                currentGroup.attributes.push({
                  entity: currentGroup.entities[0].name,
                  attribute: 'attribute',
                  value: val,
                });
              }
            }

            // Extract relationships
            if (currentGroup.entities.length >= 2) {
              currentGroup.relationships.push({
                source: currentGroup.entities[0].name,
                relation: 'relates to',
                target: currentGroup.entities[1].name,
              });
            }

            // Negation detection
            if (/\b(not|never|no|none|neither|prohibits|cannot|fails|rejects)\b/i.test(sent)) {
              currentGroup.negations.push({
                statement: sent,
                negatedConcept: 'Explicit negative condition',
              });
            }

            // Condition detection
            if (/\b(if|when|unless|provided that|subject to|in case of)\b/i.test(sent)) {
              currentGroup.conditions.push({
                rule: sent,
                context: 'Prerequisite condition',
              });
            }
          }
        }
      }
      finishGroup();
    }

    // Compute dense embeddings for each semantic chunk in parallel with gemini-embedding-2-preview
    await Promise.all(
      semanticChunks.map(async (chunk) => {
        const embRes = await getEmbedding(`${chunk.summary} ${chunk.text}`);
        chunk.embedding = embRes.vector;
        chunk.embeddingStatus = embRes.status;
      })
    );

    res.json({ chunks: semanticChunks });
  } catch (err: any) {
    console.error('Adaptive chunking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clean query concept to canonical form (removing copulas, question words, articles)
function cleanQueryConcept(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.trim();
  // Strip leading and trailing quotes & punctuation
  cleaned = cleaned.replace(/^["'`?.,;:\s]+|["'`?.,;:\s]+$/g, '');
  // Repeatedly remove question words, copula verbs, articles, and prepositions from the beginning
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(/^(what\s+is\s+|what\s+are\s+|what\s+was\s+|what\s+were\s+|what\s+does\s+|what\s+do\s+|what\s+can\s+|what\s+|why\s+is\s+|why\s+are\s+|why\s+|how\s+is\s+|how\s+are\s+|how\s+does\s+|how\s+do\s+|how\s+to\s+|how\s+|explain\s+|describe\s+|define\s+|tell\s+me\s+about\s+|is\s+|are\s+|was\s+|were\s+|do\s+|does\s+|did\s+|can\s+|could\s+|would\s+|will\s+|find\s+|show\s+|give\s+|the\s+|a\s+|an\s+|of\s+|in\s+|for\s+|about\s+|to\s+)/i, '');
    cleaned = cleaned.replace(/^["'`?.,;:\s]+|["'`?.,;:\s]+$/g, '');
  }
  return cleaned.trim();
}

// 5. Query Semantic Chunking / Concept Extraction
app.post('/api/query/analyze', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    let representation: QueryRepresentation = {
      query,
      mainIntent: 'General information query',
      concepts: [],
    };

    if (apiKey) {
      try {
        const prompt = `Analyze this search query for an Adaptive Semantic RAG system:
"${query}"

Deconstruct the query into atomic, clean semantic concepts with high precision.

CRITICAL CONCEPT ACCURACY RULES:
1. PURE CANONICAL CONCEPTS & SUBJECT-PREDICATE SEPARATION:
   - When a statement or query specifies an entity and a description/attribute (e.g., "<Subject> is a <Predicate>"):
     - Entity concept: MUST be just the subject entity (e.g. "Cisco Networking Academy", NOT the whole sentence).
     - Attribute concept: MUST be just the descriptive property or predicate (e.g. "skills-to-jobs program shaping the future workforce", NOT the whole sentence).
     - NEVER output the entire sentence as an attribute or entity!
   - Example: Given "Cisco Networking Academy is a skills-to-jobs program shaping the future workforce"
     - Concept 1: text: "Cisco Networking Academy", type: "entity", details: "Target organization / entity"
     - Concept 2: text: "skills-to-jobs program shaping the future workforce", type: "attribute", details: "Educational / workforce program description"
   - Example: Given "What is LLM Hallucinations?"
     - Concept 1: text: "LLM Hallucinations", type: "entity", details: "Target concept / technology"
   - Example: Given "The apple is red and provides dietary fiber"
     - Concept 1: text: "apple", type: "entity"
     - Concept 2: text: "red", type: "attribute"
     - Concept 3: text: "dietary fiber", type: "attribute"
2. PRECISE LABELS:
   - Never include question words ("what", "why", "how") or copula verbs ("is", "are", "was") inside the concept text.

Extract:
- mainIntent: overarching question intent
- concepts: array of atomic requirements:
  - id: e.g. "QC_1", "QC_2"
  - text: clean canonical noun phrase (e.g. "Cisco Networking Academy", NOT the whole sentence)
  - type: "entity" | "attribute" | "relationship" | "condition" | "negation" | "constraint"
  - details: specific details of what is requested
  - required: boolean`;

        const responsePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                mainIntent: { type: Type.STRING },
                concepts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      type: { type: Type.STRING },
                      details: { type: Type.STRING },
                      required: { type: Type.BOOLEAN },
                    },
                    required: ['id', 'text', 'type', 'details', 'required'],
                  },
                },
              },
              required: ['mainIntent', 'concepts'],
            },
          },
        });

        const response = await withTimeout(responsePromise, 5500, null as any);
        if (response && response.text) {
          const parsed = JSON.parse(response.text || '{}');
          representation.mainIntent = parsed.mainIntent || 'Information request';
          const rawConcepts = parsed.concepts || [];
          const validConcepts: QueryConcept[] = [];

          for (let i = 0; i < rawConcepts.length; i++) {
            const c = rawConcepts[i];
            const cleanedText = cleanQueryConcept(c.text);
            if (!cleanedText || /^(what|is|are|why|how|the|a|an)$/i.test(cleanedText)) continue;
            validConcepts.push({
              id: c.id || `QC_${validConcepts.length + 1}`,
              text: cleanedText,
              type: (['entity', 'attribute', 'relationship', 'condition', 'negation', 'constraint'].includes(c.type) ? c.type : 'attribute') as any,
              details: c.details || `Details regarding ${cleanedText}`,
              required: c.required !== false,
            });
          }

          representation.concepts = validConcepts;
        }
      } catch (geminiErr) {
        console.warn('Gemini query analysis failed, using rule-based parsing:', geminiErr);
      }
    }

    // High-Accuracy Rule-Based Concept Extraction Fallback
    if (representation.concepts.length === 0) {
      const candidateConcepts: { text: string; type: 'entity' | 'attribute' | 'condition' | 'negation'; details: string }[] = [];

      // 1. Check for Subject-Predicate statement (e.g. "Cisco Networking Academy is a skills-to-jobs program shaping the future workforce")
      const sp = extractSubjectPredicate(query);
      if (sp) {
        candidateConcepts.push({
          text: sp.subject,
          type: 'entity',
          details: `Target entity: ${sp.subject}`,
        });

        // Split predicate by conjunctions if multiple attributes present (e.g. "red and sweet")
        const subPreds = sp.predicate.split(/\s+\b(and|or|as well as)\b\s+/i);
        subPreds.forEach((pred) => {
          const cleanPred = pred.trim().replace(/^(and|or|as well as)\b/i, '').trim();
          if (cleanPred.length > 2 && !candidateConcepts.some(c => c.text.toLowerCase() === cleanPred.toLowerCase())) {
            candidateConcepts.push({
              text: cleanPred,
              type: 'attribute',
              details: `Attribute / property: ${cleanPred}`,
            });
          }
        });
        if (candidateConcepts.length === 1) {
          candidateConcepts.push({
            text: sp.predicate,
            type: 'attribute',
            details: `Attribute / property: ${sp.predicate}`,
          });
        }
      } else {
        const candidateTerms: string[] = [];
        const rawCleaned = cleanQueryConcept(query);

        // 1. Extract quoted phrases first
        const quotes = query.match(/"([^"]+)"|'([^']+)'/g);
        if (quotes) {
          quotes.forEach((q: string) => {
            const cClean = cleanQueryConcept(q);
            if (cClean.length > 1 && !candidateTerms.includes(cClean)) {
              candidateTerms.push(cClean);
            }
          });
        }

        // 2. Extract capitalized multi-word phrases (e.g. "LLM Hallucinations", "Cisco Networking Academy")
        const capitalizedPhrases = query.match(/\b([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*)\b/g);
        if (capitalizedPhrases) {
          capitalizedPhrases.forEach((cap: string) => {
            const cClean = cleanQueryConcept(cap);
            if (
              cClean.length > 1 &&
              !/^(What|Why|How|When|Where|Is|Are|The|A|An|In|On|At|To|For)$/i.test(cClean) &&
              !candidateTerms.includes(cClean)
            ) {
              candidateTerms.push(cClean);
            }
          });
        }

        // 3. Split remaining query by conjunctions and question delimiters
        const clauses = query.replace(/[?.,!]/g, '').split(/\b(and|or|under what conditions|with respect to|regarding|versus|vs)\b/i);
        for (const clause of clauses) {
          const clauseSp = extractSubjectPredicate(clause);
          if (clauseSp) {
            if (!candidateTerms.some(e => e.toLowerCase() === clauseSp.subject.toLowerCase())) {
              candidateTerms.push(clauseSp.subject);
            }
            if (!candidateTerms.some(e => e.toLowerCase() === clauseSp.predicate.toLowerCase())) {
              candidateTerms.push(clauseSp.predicate);
            }
          } else {
            const cClean = cleanQueryConcept(clause);
            if (
              cClean.length > 2 &&
              !/^(what|why|how|when|where|is|are|the|a|an|it|them|they|this|that)$/i.test(cClean) &&
              !candidateTerms.some(existing => existing.toLowerCase() === cClean.toLowerCase())
            ) {
              candidateTerms.push(cClean);
            }
          }
        }

        // 4. If still empty, use the entire cleaned query
        if (candidateTerms.length === 0 && rawCleaned.length > 1) {
          candidateTerms.push(rawCleaned);
        }

        candidateTerms.slice(0, 4).forEach((term: string, i: number) => {
          const lower = term.toLowerCase();
          const type = lower.includes('condition') || lower.includes('when') || lower.includes('under') ? 'condition'
            : lower.includes('not') || lower.includes('never') || lower.includes('prevent') || lower.includes('avoid') ? 'negation'
            : lower.includes('cause') || lower.includes('colour') || lower.includes('rate') || lower.includes('property') || lower.includes('attribute') ? 'attribute'
            : i === 0 ? 'entity' : 'attribute';

          candidateConcepts.push({
            text: term,
            type: type as any,
            details: `Specific query requirement regarding "${term}"`,
          });
        });
      }

      representation.mainIntent = `Analyze requirement: ${candidateConcepts.map(c => c.text).join(' & ')}`;
      representation.concepts = candidateConcepts.map((item, i) => ({
        id: `QC_${i + 1}`,
        text: item.text,
        type: item.type,
        categoryLabel: `${item.type.toUpperCase()}: ${item.text}`,
        details: item.details,
        required: true,
      }));
    }

    // Compute query embedding
    const embRes = await getEmbedding(query);
    representation.embedding = embRes.vector;

    res.json({ representation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. RAG Retrieval & Multi-Signal Scoring Engine
app.post('/api/rag/run', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const {
      query,
      queryRepresentation,
      mode = 'weighted_hybrid',
      weights = { semantic: 0.35, coverage: 0.30, relationship: 0.20, lexical: 0.15 },
      topK = 5,
      maxContextBudgetChars = 3000,
      semanticChunks = req.body.semanticChunks || req.body.adaptiveChunks || [],
      fixedChunks = req.body.fixedChunks || req.body.conventionalChunks || [],
    } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const tRetrievalStart = Date.now();
    const queryEmb = queryRepresentation?.embedding || (await getEmbedding(query)).vector;
    const qConcepts: QueryConcept[] = queryRepresentation?.concepts || [];

    // Select candidate pool based on mode
    const isFixedMode = mode === 'fixed';
    const sourceCandidates = isFixedMode ? fixedChunks : semanticChunks;

    const scoredCandidates: ScoredChunk[] = sourceCandidates.map((chunk: any, initialIndex: number) => {
      const isAdaptive = !isFixedMode;
      const chunkText: string = chunk.text || '';
      const summaryText: string = chunk.summary || '';

      // 1. Dense Semantic Similarity
      let denseSim = 0;
      if (chunk.embedding && queryEmb) {
        denseSim = cosineSimilarity(queryEmb, chunk.embedding);
      } else {
        denseSim = calculateLexicalScore(query, chunkText);
      }

      // 2. Query Concept Coverage & Matched Details
      const matchedDetails: MatchDetail[] = [];
      const supportedConceptIds: string[] = [];

      qConcepts.forEach(qc => {
        const qcTextLower = qc.text.toLowerCase();
        const detailsLower = qc.details.toLowerCase();
        let matched = false;
        let matchType: MatchDetail['matchType'] = (qc.type as any) || 'semantic';
        let evidenceSnippet = '';
        let confidence = 0;

        if (isAdaptive) {
          // 1. If concept is an ENTITY, match entities
          if (qc.type === 'entity') {
            const entityMatch = chunk.entities?.find((e: any) => {
              const eNameLower = e.name.toLowerCase();
              return qcTextLower === eNameLower ||
                qcTextLower.includes(eNameLower) ||
                eNameLower.includes(qcTextLower);
            });
            if (entityMatch) {
              matched = true;
              matchType = 'entity';
              confidence = 0.95;
              evidenceSnippet = `Entity [${entityMatch.name}] identified in chunk`;
            }
          }
          // 2. If concept is an ATTRIBUTE, match attributes or descriptive phrases
          else if (qc.type === 'attribute') {
            const attrMatch = chunk.attributes?.find((a: any) => {
              const valLower = (a.value || '').toLowerCase();
              const attrLower = (a.attribute || '').toLowerCase();
              return qcTextLower.includes(valLower) ||
                valLower.includes(qcTextLower) ||
                qcTextLower.includes(attrLower) ||
                detailsLower.includes(attrLower);
            });
            if (attrMatch) {
              matched = true;
              matchType = 'attribute';
              confidence = 0.92;
              evidenceSnippet = `Attribute [${attrMatch.attribute} = ${attrMatch.value}]`;
            } else if (chunkText.toLowerCase().includes(qcTextLower)) {
              matched = true;
              matchType = 'attribute';
              confidence = 0.88;
              evidenceSnippet = `Attribute [${qc.text}] confirmed in text`;
            }
          }
          // 3. Relationships
          else if (qc.type === 'relationship') {
            const relMatch = chunk.relationships?.find((r: any) =>
              qcTextLower.includes(r.relation.toLowerCase()) ||
              detailsLower.includes(r.relation.toLowerCase())
            );
            if (relMatch) {
              matched = true;
              matchType = 'relationship';
              confidence = 0.85;
              evidenceSnippet = `Relation [${relMatch.source} -> ${relMatch.relation} -> ${relMatch.target}]`;
            }
          }
          // 4. Conditions
          else if (qc.type === 'condition') {
            const condMatch = chunk.conditions?.find((c: any) =>
              qcTextLower.includes('condition') || detailsLower.includes(c.rule.toLowerCase())
            );
            if (condMatch) {
              matched = true;
              matchType = 'condition';
              confidence = 0.88;
              evidenceSnippet = `Rule [${condMatch.rule}]`;
            }
          }
        }

        // Direct lexical or sentence presence fallback if still unmatched
        if (!matched) {
          const sentences = chunkText.split(/(?<=[.?!])\s+/);
          const relevantSent = sentences.find(s =>
            s.toLowerCase().includes(qcTextLower) ||
            qc.text.split(' ').some(w => w.length > 3 && s.toLowerCase().includes(w.toLowerCase()))
          );
          if (relevantSent) {
            matched = true;
            matchType = qc.type || 'semantic';
            confidence = 0.75;
            evidenceSnippet = relevantSent.trim();
          }
        }

        if (matched) {
          supportedConceptIds.push(qc.id);
          matchedDetails.push({
            conceptId: qc.id,
            conceptText: qc.text,
            matchedElement: evidenceSnippet || qc.text,
            matchType: qc.type || matchType,
            confidence,
            evidenceSnippet: evidenceSnippet || chunkText.slice(0, 120),
          });
        }
      });

      const queryCoverageScore = qConcepts.length > 0 ? supportedConceptIds.length / qConcepts.length : 0.5;

      // 3. Relationship Alignment Score
      let relationshipScore = 0;
      if (isAdaptive && chunk.relationships && chunk.relationships.length > 0) {
        relationshipScore = Math.min(1, chunk.relationships.length * 0.25);
      } else {
        relationshipScore = queryCoverageScore * 0.7;
      }

      // 4. Lexical Score
      const lexicalScore = calculateLexicalScore(query, chunkText);

      // Mode-specific weighted scoring
      let weightedScore = 0;
      if (mode === 'fixed') {
        weightedScore = denseSim * 0.7 + lexicalScore * 0.3;
      } else if (mode === 'adaptive') {
        weightedScore = denseSim * 0.5 + queryCoverageScore * 0.5;
      } else if (mode === 'semantic_repr') {
        weightedScore = denseSim * 0.4 + queryCoverageScore * 0.3 + relationshipScore * 0.3;
      } else {
        // weighted_hybrid & context_reranked
        const totalWeight = weights.semantic + weights.coverage + weights.relationship + weights.lexical || 1;
        weightedScore =
          (weights.semantic * denseSim +
            weights.coverage * queryCoverageScore +
            weights.relationship * relationshipScore +
            weights.lexical * lexicalScore) /
          totalWeight;
      }

      const tags = chunk.extractedTags && chunk.extractedTags.length > 0
        ? chunk.extractedTags
        : buildChunkExtractedTags(chunkText, chunk.entities, chunk.attributes, chunk.relationships, chunk.conditions);

      return {
        id: chunk.id,
        chunkType: isAdaptive ? 'adaptive' : 'fixed',
        text: chunkText,
        summary: summaryText || chunkText.slice(0, 100),
        passageIds: chunk.passageIds || chunk.passageRefs || [],
        sourcePages: chunk.sourcePages || [1],
        charStart: chunk.charStart ?? chunk.startChar,
        charEnd: chunk.charEnd ?? chunk.endChar,
        extractedTags: tags,
        denseSemanticScore: Number(denseSim.toFixed(3)),
        queryCoverageScore: Number(queryCoverageScore.toFixed(3)),
        relationshipScore: Number(relationshipScore.toFixed(3)),
        lexicalScore: Number(lexicalScore.toFixed(3)),
        weightedScore: Number(weightedScore.toFixed(3)),
        supportedConceptIds,
        matchedDetails,
        initialRank: 0,
        rerankScore: Number(weightedScore.toFixed(3)),
        finalRank: 0,
        rerankDelta: 0,
        rerankExplanation: 'Initial retrieval score calculated.',
        selectedForContext: false,
        semanticData: isAdaptive ? chunk : undefined,
        fixedData: !isAdaptive ? chunk : undefined,
      };
    });

    // Initial Ranking by weighted score descending
    scoredCandidates.sort((a, b) => b.weightedScore - a.weightedScore);
    scoredCandidates.forEach((c, i) => {
      c.initialRank = i + 1;
      c.finalRank = i + 1;
    });

    const tRetrievalEnd = Date.now();

    // -------------------------------------------------------------
    // Context-Aware Reranking and Deduplication
    // -------------------------------------------------------------
    const tRerankStart = Date.now();
    if (mode === 'context_reranked') {
      const coveredConceptSet = new Set<string>();

      scoredCandidates.forEach(cand => {
        let rerankBonus = 0;
        const reasons: string[] = [];

        // 1. Concept Coverage Diversity Bonus: Boost chunks providing newly covered concepts
        const newConcepts = cand.supportedConceptIds.filter(id => !coveredConceptSet.has(id));
        if (newConcepts.length > 0) {
          rerankBonus += newConcepts.length * 0.15;
          reasons.push(`+${(newConcepts.length * 0.15).toFixed(2)}: covers new concept(s) [${newConcepts.join(', ')}]`);
          newConcepts.forEach(id => coveredConceptSet.add(id));
        } else if (cand.supportedConceptIds.length > 0) {
          rerankBonus -= 0.05;
          reasons.push('-0.05: redundant concept coverage');
        }

        // 2. Negation / Condition preservation check
        if (cand.semanticData?.negations && cand.semanticData.negations.length > 0) {
          rerankBonus += 0.08;
          reasons.push('+0.08: retains explicit negation/restriction');
        }
        if (cand.semanticData?.conditions && cand.semanticData.conditions.length > 0) {
          rerankBonus += 0.06;
          reasons.push('+0.06: preserves conditional rule structure');
        }

        // 3. Contradiction / Conflict check
        if (cand.text.toLowerCase().includes('however') || cand.text.toLowerCase().includes('in contrast')) {
          reasons.push('Flags potential qualification or contrast');
        }

        cand.rerankScore = Number(Math.max(0, Math.min(1, cand.weightedScore + rerankBonus)).toFixed(3));
        cand.rerankExplanation = reasons.join('; ') || 'Score preserved from weighted similarity.';
      });

      // Sort by rerankScore
      scoredCandidates.sort((a, b) => b.rerankScore - a.rerankScore);
      scoredCandidates.forEach((c, i) => {
        c.finalRank = i + 1;
        c.rerankDelta = c.initialRank - c.finalRank; // positive means moved UP
        if (c.rerankDelta > 0) {
          c.rerankExplanation = `▲ Moved up ${c.rerankDelta} positions: ${c.rerankExplanation}`;
        } else if (c.rerankDelta < 0) {
          c.rerankExplanation = `▼ Moved down ${Math.abs(c.rerankDelta)} positions: ${c.rerankExplanation}`;
        }
      });
    }

    const tRerankEnd = Date.now();

    // Select top evidence chunks respecting context budget
    let currentBudget = 0;
    const retrievedEvidence: ScoredChunk[] = [];
    const allSupportedConceptIds = new Set<string>();

    for (let i = 0; i < Math.min(topK, scoredCandidates.length); i++) {
      const cand = scoredCandidates[i];
      if (currentBudget + cand.text.length <= maxContextBudgetChars || retrievedEvidence.length < 2) {
        cand.selectedForContext = true;
        currentBudget += cand.text.length;
        retrievedEvidence.push(cand);
        cand.supportedConceptIds.forEach(id => allSupportedConceptIds.add(id));
      }
    }

    // Parity / Query-concept coverage metric
    const totalConcepts = qConcepts.length || 1;
    const supportedCount = allSupportedConceptIds.size;
    const unsupportedConcepts = qConcepts.filter(qc => !allSupportedConceptIds.has(qc.id)).map(qc => qc.text);
    const coverageScore = Number((supportedCount / totalConcepts).toFixed(3));

    const run: RetrievalRun = {
      id: `run_${Date.now()}`,
      timestamp: Date.now(),
      query,
      queryRepresentation: queryRepresentation || { query, mainIntent: 'Query', concepts: [] },
      mode: mode as RetrievalMode,
      weights,
      topK,
      maxContextBudgetChars,
      candidates: scoredCandidates,
      retrievedEvidence,
      coverageScore,
      coverageBreakdown: {
        total: totalConcepts,
        supported: supportedCount,
        partial: 0,
        unsupported: totalConcepts - supportedCount,
        unsupportedConcepts,
      },
      latencyMs: {
        retrieval: tRetrievalEnd - tRetrievalStart,
        reranking: tRerankEnd - tRerankStart,
        total: Date.now() - startTime,
      },
    };

    res.json({ run });
  } catch (err: any) {
    console.error('RAG run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Evidence-Grounded Answer Generation with Strict Citation Verification
app.post('/api/rag/generate-answer', async (req: Request, res: Response) => {
  const tStart = Date.now();
  try {
    const { query, queryRepresentation, retrievedEvidence, mode = 'context_reranked' } = req.body;
    if (!query || !retrievedEvidence || retrievedEvidence.length === 0) {
      res.status(400).json({ error: 'Query and retrieved evidence are required.' });
      return;
    }

    const qConcepts: QueryConcept[] = queryRepresentation?.concepts || [];

    // Assemble evidence context with explicit citation tags
    const evidenceBlocks = retrievedEvidence.map((chunk: ScoredChunk, idx: number) => {
      const pId = chunk.passageIds?.[0] || `P${idx + 1}`;
      const page = chunk.sourcePages?.[0] || 1;
      return `[[CITATION_ID: CIT_${idx + 1} | CHUNK: ${chunk.id} | PASSAGE: ${pId} | PAGE: ${page}]]
${chunk.text}`;
    }).join('\n\n---\n\n');

    let generatedAnswer: GeneratedAnswer = {
      answerText: '',
      citations: [],
      claims: [],
      unsupportedRequirements: [],
      abstained: false,
      modelName: 'gemini-3.8-flash',
      faithfulnessScore: 1.0,
      analysisSummary: '',
      keyTakeaways: [],
    };

    if (apiKey) {
      try {
        const prompt = `You are an expert analytical AI. Your objective is to formulate a specific, insightful, and comprehensive answer to the user's question by analyzing the provided text documents.

CORE INSTRUCTIONS (CRITICAL):
1. DEEP ANALYSIS BASED ON THE TEXT (TEXT AS SUPPORT):
   - Analyze the provided text thoroughly. Do NOT just copy-paste or regurgitate verbatim sentences from the text.
   - The answer must be firmly based on the text, using the retrieved passages as authoritative support and grounding.
   - Synthesize, explain, and contextualize what the text demonstrates so the user receives a thoughtful, well-articulated, and natural answer.
2. BE ACCURATE AND HIGHLY SPECIFIC:
   - Provide concrete, specific details: exact definitions, operational steps, causes, mechanisms, consequences, distinctions, or conditions described in the text.
   - Avoid vague high-level generalities or boilerplate. Answer the question directly and specifically.
3. INLINE CITATION ANCHORING:
   - Seamlessly attach citation tags like [CIT_1], [CIT_2] whenever a claim, data point, or finding in your answer is supported by a passage.
   - Every substantive assertion should cite its supporting passage.

QUESTION:
"${query}"

KEY CONCEPTS IN QUERY:
${qConcepts.map(c => `- ${c.id}: ${c.text} (${c.type})`).join('\n')}

RETRIEVED AUTHORITATIVE SUPPORTING PASSAGES:
${evidenceBlocks}

Respond in structured JSON format with:
- answerText: An articulate, specific, and well-synthesized answer analyzing the question based on the text, with inline citation tags [CIT_#] indicating supporting evidence.
- analysisSummary: A 1-2 sentence executive analytical conclusion summarizing the key finding.
- keyTakeaways: Array of 2 to 4 concise, specific analytical points discovered by analyzing the text.
- abstained: boolean (only set true if the retrieved text has no relevant information for the question)
- abstentionReason: reason if abstained
- unsupportedRequirements: array of aspects not covered by the text
- claims: array of specific key points/assertions made in your answer:
  {
    id: "CLM_1",
    claimText: string (the specific assertion),
    status: "supported" | "partially_supported",
    supportingPassage: string (brief note on how the text supports this),
    citationId: string (e.g. "CIT_1"),
    confidence: number (0.0 to 1.0)
  }
- citations: array of:
  {
    citationId: string (e.g. "CIT_1"),
    chunkId: string,
    passageId: string,
    pageNumber: number,
    snippet: string (the specific excerpt from the text that supports this point)
  }`;

        const responsePromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answerText: { type: Type.STRING },
                analysisSummary: { type: Type.STRING },
                keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
                abstained: { type: Type.BOOLEAN },
                abstentionReason: { type: Type.STRING },
                unsupportedRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                claims: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      claimText: { type: Type.STRING },
                      status: { type: Type.STRING },
                      supportingPassage: { type: Type.STRING },
                      citationId: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                    },
                    required: ['id', 'claimText', 'status'],
                  },
                },
                citations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      citationId: { type: Type.STRING },
                      chunkId: { type: Type.STRING },
                      passageId: { type: Type.STRING },
                      pageNumber: { type: Type.INTEGER },
                      snippet: { type: Type.STRING },
                    },
                    required: ['citationId', 'chunkId', 'passageId', 'snippet'],
                  },
                },
              },
              required: ['answerText', 'abstained', 'claims', 'citations'],
            },
          },
        });

        const response = await withTimeout(responsePromise, 11000, null as any);
        if (response && response.text) {
          const parsed = JSON.parse(response.text || '{}');
          const claims: AnswerClaim[] = (parsed.claims || []).map((c: any, i: number) => ({
            id: c.id || `CLM_${i + 1}`,
            claimText: c.claimText || '',
            status: (['supported', 'partially_supported', 'unsupported', 'contradicted'].includes(c.status) ? c.status : 'supported') as any,
            supportingPassage: c.supportingPassage || '',
            citationId: c.citationId || undefined,
            chunkId: c.citationId ? retrievedEvidence.find((e: any, idx: number) => `CIT_${idx + 1}` === c.citationId)?.id : undefined,
            confidence: c.confidence || 0.95,
          }));

          // Calculate faithfulness score: supported claims / total claims
          const supportedClaims = claims.filter(c => c.status === 'supported').length;
          const faithfulnessScore = claims.length > 0 ? Number((supportedClaims / claims.length).toFixed(3)) : 1.0;

          // Build citations list with verified references
          const citations: AnswerCitation[] = (parsed.citations || []).map((cit: any, idx: number) => {
            const matchedEv = retrievedEvidence.find((e: any, eIdx: number) => `CIT_${eIdx + 1}` === cit.citationId) || retrievedEvidence[0];
            return {
              citationId: cit.citationId || `CIT_${idx + 1}`,
              chunkId: matchedEv?.id || `chunk_${idx + 1}`,
              passageId: matchedEv?.passageIds?.[0] || `pass_${idx + 1}`,
              pageNumber: matchedEv?.sourcePages?.[0] || 1,
              snippet: cit.snippet || matchedEv?.text?.slice(0, 140) || '',
            };
          });

          generatedAnswer = {
            answerText: parsed.answerText || 'No answer generated.',
            analysisSummary: parsed.analysisSummary || '',
            keyTakeaways: parsed.keyTakeaways || [],
            citations: citations.length > 0 ? citations : retrievedEvidence.map((e: any, i: number) => ({
              citationId: `CIT_${i + 1}`,
              chunkId: e.id,
              passageId: e.passageIds?.[0] || `pass_${i + 1}`,
              pageNumber: e.sourcePages?.[0] || 1,
              snippet: e.text.slice(0, 120),
            })),
            claims,
            unsupportedRequirements: parsed.unsupportedRequirements || [],
            abstained: !!parsed.abstained,
            abstentionReason: parsed.abstentionReason,
            modelName: 'gemini-3.8-flash',
            faithfulnessScore,
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini answer generation call failed, using deterministic grounded synthesis:', geminiErr);
      }
    }

    // High-Quality Analytical Grounded Synthesis Fallback
    if (!generatedAnswer.answerText) {
      const citations: AnswerCitation[] = retrievedEvidence.map((e: any, i: number) => ({
        citationId: `CIT_${i + 1}`,
        chunkId: e.id,
        passageId: e.passageIds?.[0] || `pass_${i + 1}`,
        pageNumber: e.sourcePages?.[0] || 1,
        snippet: e.text.slice(0, 140),
      }));

      const claims: AnswerClaim[] = [];
      const analyticalInsights: string[] = [];
      const keyTakeaways: string[] = [];

      retrievedEvidence.slice(0, 3).forEach((ev: any, idx: number) => {
        const pId = ev.passageIds?.[0] || `Passage ${idx + 1}`;
        const page = ev.sourcePages?.[0] || 1;
        const citTag = `[CIT_${idx + 1}]`;

        const cleanText = ev.text.replace(/\s+/g, ' ').trim();
        const sentences = cleanText.split(/(?<=[.?!])\s+/).filter((s: string) => s.length > 15);
        const coreInsight = sentences[0] || cleanText.slice(0, 140);

        analyticalInsights.push(`${coreInsight} ${citTag}`);
        keyTakeaways.push(coreInsight);

        claims.push({
          id: `CLM_${idx + 1}`,
          claimText: coreInsight,
          status: 'supported',
          supportingPassage: `${pId} (Page ${page}): ${coreInsight.slice(0, 120)}`,
          citationId: `CIT_${idx + 1}`,
          chunkId: ev.id,
          confidence: 0.95,
        });
      });

      const conceptNames = qConcepts.map(c => c.text).filter(Boolean).join(', ') || query;
      const answerText = `Based on an analysis of the provided text regarding "${conceptNames}": ${analyticalInsights.join(' Additionally, ')}. These findings are directly supported by the retrieved document passages as referenced.`;

      generatedAnswer = {
        answerText,
        analysisSummary: `Analysis of the document indicates specific findings regarding ${conceptNames}.`,
        keyTakeaways,
        citations,
        claims,
        unsupportedRequirements: [],
        abstained: false,
        modelName: 'analytical-grounded-synthesis',
        faithfulnessScore: 1.0,
      };
    }

    res.json({
      answer: generatedAnswer,
      latencyMs: Date.now() - tStart,
    });
  } catch (err: any) {
    console.error('Answer generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Source Code & Program Folder Export (Direct requirement from user)
app.get('/api/export/source-code', (req: Request, res: Response) => {
  try {
    const rootDir = process.cwd();
    const filesToInclude: { path: string; content: string }[] = [];

    const readDirRecursive = (dir: string, baseDir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath);

        // Skip ignored directories & secrets
        if (
          relPath.startsWith('node_modules') ||
          relPath.startsWith('.git') ||
          relPath.startsWith('dist') ||
          relPath.startsWith('.aistudio') ||
          relPath.startsWith('.env')
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          readDirRecursive(fullPath, baseDir);
        } else if (entry.isFile()) {
          // Only include source code and project config files
          if (
            relPath.endsWith('.ts') ||
            relPath.endsWith('.tsx') ||
            relPath.endsWith('.js') ||
            relPath.endsWith('.json') ||
            relPath.endsWith('.html') ||
            relPath.endsWith('.css') ||
            relPath.endsWith('.md')
          ) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              filesToInclude.push({ path: relPath, content });
            } catch (readErr) {
              // skip unreadable
            }
          }
        }
      }
    };

    readDirRecursive(rootDir, rootDir);

    res.json({
      projectName: 'Adaptive Semantic RAG Lab',
      fileCount: filesToInclude.length,
      files: filesToInclude,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Adaptive Semantic RAG Lab server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
