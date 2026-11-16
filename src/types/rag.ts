export interface DocumentPage {
  pageNumber: number;
  text: string;
  paragraphCount: number;
}

export interface DocumentPassage {
  id: string;
  pageNumber: number;
  paragraphIndex: number;
  text: string;
  heading?: string;
  charStart: number;
  charEnd: number;
}

export interface DocumentSource {
  id: string;
  name: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'sample';
  rawText: string;
  pages: DocumentPage[];
  passages: DocumentPassage[];
  metadata: {
    totalChars: number;
    totalWords: number;
    approxTokens: number;
    uploadedAt: string;
    sectionCount: number;
  };
}

export interface FixedChunk {
  id: string;
  text: string;
  startChar: number;
  endChar: number;
  approxTokens: number;
  splitMidSentence: boolean;
  passageRefs: string[];
}

export interface EntityItem {
  name: string;
  type: string;
  importance: 'high' | 'medium' | 'low';
}

export interface AttributeItem {
  entity: string;
  attribute: string;
  value: string;
}

export interface RelationshipItem {
  source: string;
  relation: string;
  target: string;
}

export interface ConditionItem {
  rule: string;
  context: string;
}

export interface NegationItem {
  statement: string;
  negatedConcept: string;
}

export interface SemanticChunk {
  id: string;
  passageIds: string[];
  sourcePages: number[];
  text: string;
  originalSentences: string[];
  summary: string;
  entities: EntityItem[];
  attributes: AttributeItem[];
  relationships: RelationshipItem[];
  conditions: ConditionItem[];
  negations: NegationItem[];
  conceptLabels: string[];
  boundaryRationale: string;
  displayId?: string;
  extractedTags?: { label: string; target: string; type?: string }[];
  embedding?: number[];
  embeddingStatus: 'computed' | 'fallback' | 'failed';
  charStart?: number;
  charEnd?: number;
  approxTokens?: number;
}

export interface QueryConcept {
  id: string;
  text: string;
  type: 'entity' | 'attribute' | 'relationship' | 'condition' | 'negation' | 'constraint';
  categoryLabel?: string;
  details: string;
  required: boolean;
}

export interface QueryRepresentation {
  query: string;
  mainIntent: string;
  concepts: QueryConcept[];
  embedding?: number[];
}

export interface MatchDetail {
  conceptId: string;
  conceptText: string;
  matchedElement: string;
  matchType: 'entity' | 'attribute' | 'relationship' | 'semantic' | 'condition' | 'negation' | 'constraint';
  confidence: number;
  evidenceSnippet: string;
}

export interface ScoredChunk {
  id: string;
  displayId?: string;
  chunkType: 'adaptive' | 'fixed';
  text: string;
  summary?: string;
  passageIds: string[];
  sourcePages: number[];
  denseSemanticScore: number;
  queryCoverageScore: number;
  relationshipScore: number;
  lexicalScore: number;
  weightedScore: number;
  supportedConceptIds: string[];
  matchedDetails: MatchDetail[];
  extractedTags?: { label: string; target: string; type?: string }[];
  isFilteredOut?: boolean;
  filterStatusText?: string;
  charStart?: number;
  charEnd?: number;
  initialRank: number;
  rerankScore: number;
  finalRank: number;
  rerankDelta: number;
  rerankExplanation: string;
  selectedForContext: boolean;
  semanticData?: SemanticChunk;
  fixedData?: FixedChunk;
}

export interface AnswerClaim {
  id: string;
  claimText: string;
  status: 'supported' | 'partially_supported' | 'unsupported' | 'contradicted';
  supportingPassage?: string;
  citationId?: string;
  chunkId?: string;
  confidence: number;
}

export interface AnswerCitation {
  citationId: string;
  chunkId: string;
  passageId: string;
  pageNumber?: number;
  snippet: string;
}

export interface GeneratedAnswer {
  answerText: string;
  citations: AnswerCitation[];
  claims: AnswerClaim[];
  unsupportedRequirements: string[];
  abstained: boolean;
  abstentionReason?: string;
  modelName: string;
  faithfulnessScore: number;
  analysisSummary?: string;
  keyTakeaways?: string[];
}

export type RetrievalMode =
  | 'fixed'
  | 'adaptive'
  | 'semantic_repr'
  | 'weighted_hybrid'
  | 'context_reranked';

export interface ScoringWeights {
  semantic: number;
  coverage: number;
  relationship: number;
  lexical: number;
}

export interface RetrievalRun {
  id: string;
  timestamp: number;
  query: string;
  queryRepresentation: QueryRepresentation;
  mode: RetrievalMode;
  weights: ScoringWeights;
  topK: number;
  maxContextBudgetChars: number;
  candidates: ScoredChunk[];
  retrievedEvidence: ScoredChunk[];
  coverageScore: number;
  coverageBreakdown: {
    total: number;
    supported: number;
    partial: number;
    unsupported: number;
    unsupportedConcepts: string[];
  };
  generatedAnswer?: GeneratedAnswer;
  latencyMs: {
    queryAnalysis?: number;
    embedding?: number;
    retrieval?: number;
    reranking?: number;
    answerGeneration?: number;
    total: number;
  };
}

export interface BenchmarkCase {
  id: string;
  title: string;
  category: 'standard' | 'negation' | 'conditional' | 'partial_evidence' | 'contradiction' | 'lexical_distractor';
  description: string;
  documentText: string;
  documentTitle: string;
  query: string;
  expectedRelevantPassages: string[];
  expectedConcepts: string[];
  referenceAnswer: string;
  evaluationRecords?: Record<RetrievalMode, {
    mode: RetrievalMode;
    precisionAtK: number;
    recallAtK: number;
    mrr: number;
    queryCoverage: number;
    faithfulness: number;
    citationSupportRate: number;
    unsupportedClaimRate: number;
    latencyMs: number;
    answer: string;
    timestamp: number;
  }>;
}

export interface AggregateEvaluationMetrics {
  mode: RetrievalMode;
  modeName: string;
  runCount: number;
  avgPrecisionAtK: number;
  avgRecallAtK: number;
  avgMRR: number;
  avgQueryCoverage: number;
  avgFaithfulness: number;
  avgCitationSupportRate: number;
  avgUnsupportedClaimRate: number;
  avgLatencyMs: number;
}
