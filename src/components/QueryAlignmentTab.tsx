import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Check,
  Edit2,
  Filter,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { QueryRepresentation, QueryConcept, SemanticChunk, ScoredChunk, GeneratedAnswer } from '../types/rag.ts';

interface QueryAlignmentTabProps {
  query: string;
  setQuery: (q: string) => void;
  queryRepresentation: QueryRepresentation | null;
  generatedAnswer?: GeneratedAnswer | null;
  onJumpToPassage?: (passageId: string) => void;
  onAnalyzeQuery: () => void;
  semanticChunks: SemanticChunk[];
  scoredCandidates: ScoredChunk[];
  coverageScore: number;
  coverageBreakdown: {
    total: number;
    supported: number;
    partial: number;
    unsupported: number;
    unsupportedConcepts: string[];
  };
  onExecuteRetrieval: () => void;
  isProcessing: boolean;
}

export const QueryAlignmentTab: React.FC<QueryAlignmentTabProps> = ({
  query,
  setQuery,
  queryRepresentation,
  generatedAnswer,
  onJumpToPassage,
  onAnalyzeQuery,
  semanticChunks,
  scoredCandidates,
  coverageScore,
  coverageBreakdown,
  onExecuteRetrieval,
  isProcessing,
}) => {
  const [selectedChunk, setSelectedChunk] = useState<ScoredChunk | null>(null);

  const concepts = queryRepresentation?.concepts || [];

  // Candidate chunks or fallback to semantic chunks
  const displayChunks: ScoredChunk[] = scoredCandidates.length > 0
    ? scoredCandidates
    : semanticChunks.map((sc, idx) => ({
        id: sc.id,
        displayId: sc.displayId || `D${idx + 1}`,
        chunkType: 'adaptive',
        text: sc.text,
        summary: sc.summary,
        passageIds: sc.passageIds,
        sourcePages: sc.sourcePages,
        denseSemanticScore: 0.5,
        queryCoverageScore: 0.5,
        relationshipScore: 0.5,
        lexicalScore: 0.5,
        weightedScore: 0.5,
        supportedConceptIds: [],
        matchedDetails: [],
        extractedTags: sc.extractedTags || (sc.entities || []).map(e => ({ label: e.name, target: 'entity', type: 'entity' })),
        isFilteredOut: false,
        initialRank: idx + 1,
        rerankScore: 0.5,
        finalRank: idx + 1,
        rerankDelta: 0,
        rerankExplanation: '',
        selectedForContext: true,
        semanticData: sc,
      }));

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top Prompt Input / Header */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex-1 min-w-[280px]">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAnalyzeQuery();
              }}
              placeholder="Enter user prompt (e.g. Find the apple's colour and nutritional properties)..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-sans"
            />
          </div>
        </div>

        <button
          onClick={onAnalyzeQuery}
          disabled={isProcessing || !query.trim()}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-purple-950/40"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'Aligning...' : 'Analyze & Align'}</span>
        </button>
      </div>

      {/* Semantic alignment explorer Card (Strict Match to User Reference Image) */}
      <div className="rounded-2xl border border-zinc-800 bg-[#070709] p-6 sm:p-8 space-y-6 shadow-2xl font-sans">
        {/* Explorer Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Semantic alignment explorer
          </h2>
          <span className="text-xs px-3 py-0.5 rounded-full border border-emerald-900/60 bg-emerald-950/40 text-emerald-400 font-medium">
            {query ? 'Active session' : 'Illustrative example'}
          </span>
        </div>

        {/* User prompt line */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
          <span className="text-zinc-400 font-normal">User prompt:</span>
          <span className="text-zinc-100 font-medium italic">
            "{query || "Find the apple's colour and nutritional properties."}"
          </span>
        </div>

        {/* SECTION A: Query Chunks */}
        <div className="space-y-3 pt-2">
          <div className="text-sm font-bold text-zinc-200">
            A. Query chunks
          </div>

          {concepts.length > 0 ? (
            <div className="flex flex-wrap gap-2.5 items-center">
              {concepts.map((concept) => {
                const isEntity = concept.type === 'entity';
                const isAttribute = concept.type === 'attribute';
                const label = concept.categoryLabel || `${concept.type.toUpperCase()}: ${concept.text}`;
                const textLower = concept.text.toLowerCase();

                // Exact pill styling from user image:
                // ENTITY: apple -> soft light blue (#dbeafe / text-blue-800)
                // ATTRIBUTE: colour -> soft mint green (#dcfce7 / text-emerald-800)
                // ATTRIBUTE: nutrition -> soft cream yellow (#fef3c7 / text-amber-900)
                const pillStyle = isEntity
                  ? 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]'
                  : isAttribute && (textLower.includes('nutri') || textLower.includes('vitamin') || textLower.includes('fibre'))
                  ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                  : isAttribute && (textLower.includes('colour') || textLower.includes('color'))
                  ? 'bg-[#dcfce7] text-[#065f46] border-[#bbf7d0]'
                  : isAttribute
                  ? 'bg-[#dcfce7] text-[#065f46] border-[#bbf7d0]'
                  : 'bg-[#f3f4f6] text-[#1f2937] border-[#e5e7eb]';

                return (
                  <div
                    key={concept.id}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight border shadow-xs transition select-none ${pillStyle}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#dbeafe] text-[#1e40af] border border-[#bfdbfe]">
                ENTITY: apple
              </div>
              <div className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#dcfce7] text-[#065f46] border border-[#bbf7d0]">
                ATTRIBUTE: colour
              </div>
              <div className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                ATTRIBUTE: nutrition
              </div>
            </div>
          )}
        </div>

        {/* SECTION B: Document Chunks */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-zinc-200">
              B. Document chunks
            </div>
            {queryRepresentation && (
              <span className="text-xs text-zinc-500 font-mono">
                Coverage: {(coverageScore * 100).toFixed(0)}% ({coverageBreakdown.supported}/{coverageBreakdown.total} concepts)
              </span>
            )}
          </div>

          {displayChunks.length > 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-[#0c0c0e] divide-y divide-zinc-900 overflow-hidden shadow-inner">
              {displayChunks.map((chunk, idx) => {
                const displayId = chunk.displayId || `D${idx + 1}`;
                const isFiltered = chunk.isFilteredOut;

                return (
                  <div
                    key={chunk.id}
                    onClick={() => setSelectedChunk(chunk)}
                    className="p-4 sm:p-5 hover:bg-zinc-900/40 transition cursor-pointer space-y-2.5"
                  >
                    {/* Header: D# badge + Quoted Text */}
                    <div className="flex items-start gap-3">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${
                          isFiltered
                            ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-[#091e3a] text-[#38bdf8] border border-[#0284c7]/40'
                        }`}
                      >
                        {displayId}
                      </span>

                      <div className="flex-1">
                        <p className={`text-sm leading-relaxed ${isFiltered ? 'text-zinc-400' : 'text-zinc-100 font-medium'}`}>
                          "{chunk.text}"
                        </p>
                      </div>
                    </div>

                    {/* Tags row or Filtered Status row (Exact match to reference image) */}
                    <div className="pl-9">
                      {isFiltered ? (
                        <div className="text-xs text-zinc-500 font-sans">
                          {chunk.filterStatusText || 'Unrelated to the current question; likely filtered out.'}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {chunk.extractedTags && chunk.extractedTags.length > 0 ? (
                            chunk.extractedTags.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5 border bg-[#18181b] border-zinc-800/90 text-zinc-300"
                              >
                                <span className="text-zinc-200">{tag.label}</span>
                                <span className="text-zinc-500">→</span>
                                <span className="text-emerald-400 font-semibold">
                                  {tag.target}
                                </span>
                              </span>
                            ))
                          ) : (
                            chunk.matchedDetails.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="text-xs px-2.5 py-1 rounded-md font-mono bg-[#18181b] border border-zinc-800 text-zinc-300 flex items-center gap-1.5"
                              >
                                <span className="text-zinc-200">{m.conceptText}</span>
                                <span className="text-zinc-500">→</span>
                                <span className="text-emerald-400 font-semibold">{m.matchType}</span>
                              </span>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-[#0c0c0e] divide-y divide-zinc-900 overflow-hidden shadow-inner p-4 sm:p-5 space-y-4">
              {/* Fallback illustrative sample matching image */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#091e3a] text-[#38bdf8] border border-[#0284c7]/40">
                    D1
                  </span>
                  <p className="text-sm text-zinc-100 font-medium">"The apple is red."</p>
                </div>
                <div className="pl-9 flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-[#18181b] border border-zinc-800 text-zinc-300">
                    apple → entity
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-[#052e16] border border-[#166534]/60 text-[#4ade80]">
                    red → colour
                  </span>
                </div>
              </div>

              <div className="pt-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#091e3a] text-[#38bdf8] border border-[#0284c7]/40">
                    D2
                  </span>
                  <p className="text-sm text-zinc-100 font-medium">"It contains fibre and vitamin C."</p>
                </div>
                <div className="pl-9 flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-[#18181b] border border-zinc-800 text-zinc-300">
                    fibre → nutrient
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-[#18181b] border border-zinc-800 text-zinc-300">
                    vitamin C → nutrient
                  </span>
                </div>
              </div>

              <div className="pt-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    D3
                  </span>
                  <p className="text-sm text-zinc-400">"The tree requires sufficient sunlight."</p>
                </div>
                <div className="pl-9 text-xs text-zinc-500 font-sans">
                  Unrelated to the current question; likely filtered out.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Chunk Inspection Modal */}
      {selectedChunk && (
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                {selectedChunk.displayId || selectedChunk.id}
              </span>
              <span className="text-xs font-semibold text-zinc-200">
                Chunk Evidence Trace
              </span>
            </div>
            <button
              onClick={() => setSelectedChunk(null)}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-zinc-300 italic font-sans leading-relaxed">
            "{selectedChunk.text}"
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-900">
            <div>Dense Sim: <span className="text-purple-300 font-semibold">{selectedChunk.denseSemanticScore}</span></div>
            <div>Coverage: <span className="text-emerald-300 font-semibold">{selectedChunk.queryCoverageScore}</span></div>
            <div>Lexical: <span className="text-amber-300 font-semibold">{selectedChunk.lexicalScore}</span></div>
            <div>Rank: <span className="text-zinc-200 font-semibold">#{selectedChunk.finalRank}</span></div>
          </div>

          {selectedChunk.passageIds?.[0] && onJumpToPassage && (
            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => onJumpToPassage(selectedChunk.passageIds[0])}
                className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Highlight Passage {selectedChunk.passageIds.join(', ')} in Document Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Specific Analytical Answer Panel if generated */}
      {generatedAnswer?.answerText && (
        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <h4 className="text-xs font-semibold text-zinc-100 font-mono">
                  Specific Analytical Answer (Text-Grounded Support)
                </h4>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
              {(generatedAnswer.faithfulnessScore * 100).toFixed(0)}% Text-Grounded
            </span>
          </div>

          {generatedAnswer.analysisSummary && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-200/90 font-medium">
              <span className="font-mono text-[10px] uppercase font-bold text-emerald-400 mr-1.5">Insight:</span>
              {generatedAnswer.analysisSummary}
            </div>
          )}

          <p className="text-xs text-zinc-200 leading-relaxed font-sans">
            {generatedAnswer.answerText}
          </p>

          {generatedAnswer.keyTakeaways && generatedAnswer.keyTakeaways.length > 0 && (
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1.5 text-xs text-zinc-300">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Specific Analytical Takeaways:
              </div>
              <ul className="space-y-1 pl-1">
                {generatedAnswer.keyTakeaways.map((point, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {generatedAnswer.citations && generatedAnswer.citations.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] text-zinc-400 font-mono">Retrieved from:</span>
              {generatedAnswer.citations.map((cit, i) => (
                <button
                  key={i}
                  onClick={() => onJumpToPassage?.(cit.passageId)}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 flex items-center gap-1 transition cursor-pointer"
                  title={cit.snippet}
                >
                  <FileText className="w-2.5 h-2.5 text-purple-400" />
                  <span>{cit.citationId} ({cit.passageId})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
