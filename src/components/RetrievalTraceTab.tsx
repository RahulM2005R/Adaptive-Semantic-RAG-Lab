import React from 'react';
import {
  Sliders,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Layers,
  Cpu,
} from 'lucide-react';
import { ScoredChunk, ScoringWeights, RetrievalMode } from '../types/rag.ts';

interface RetrievalTraceTabProps {
  candidates: ScoredChunk[];
  weights: ScoringWeights;
  onUpdateWeights: (newWeights: ScoringWeights) => void;
  retrievalMode: RetrievalMode;
  onChangeMode: (mode: RetrievalMode) => void;
  topK: number;
  setTopK: (k: number) => void;
  contextBudget: number;
  setContextBudget: (budget: number) => void;
  onRunRerank: () => void;
  isProcessing: boolean;
}

export const RetrievalTraceTab: React.FC<RetrievalTraceTabProps> = ({
  candidates,
  weights,
  onUpdateWeights,
  retrievalMode,
  onChangeMode,
  topK,
  setTopK,
  contextBudget,
  setContextBudget,
  onRunRerank,
  isProcessing,
}) => {
  const handleWeightChange = (key: keyof ScoringWeights, val: number) => {
    onUpdateWeights({
      ...weights,
      [key]: val,
    });
  };

  const handleResetWeights = () => {
    onUpdateWeights({
      semantic: 0.35,
      coverage: 0.30,
      relationship: 0.20,
      lexical: 0.15,
    });
  };

  // Calculate used characters for selected chunks
  const selectedChunks = candidates.filter(c => c.selectedForContext);
  const usedChars = selectedChunks.reduce((acc, c) => acc + c.text.length, 0);
  const budgetPercent = Math.min(100, Math.round((usedChars / contextBudget) * 100));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Mode Selector */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Multi-Signal Retrieval & Context-Aware Reranking Trace (Objective 3)
              </h3>
              <p className="text-xs text-zinc-400">
                Inspect component scores, tune weighting vectors, and trace context reranking decisions
              </p>
            </div>
          </div>

          <button
            onClick={onRunRerank}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-purple-950/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Scoring...' : 'Recalculate & Rerank'}</span>
          </button>
        </div>

        {/* Retrieval Mode Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
          <span className="text-zinc-500 font-mono text-[11px]">Retrieval Mode:</span>
          {(
            [
              { id: 'fixed', label: '1. Fixed-Size Baseline' },
              { id: 'adaptive', label: '2. Adaptive Semantic' },
              { id: 'semantic_repr', label: '3. Semantic Repr' },
              { id: 'weighted_hybrid', label: '4. Weighted Hybrid' },
              { id: 'context_reranked', label: '5. Context-Aware Reranked' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeMode(m.id)}
              className={`px-3 py-1.5 rounded-md border font-medium transition cursor-pointer ${
                retrievalMode === m.id
                  ? 'border-purple-500 bg-purple-950/60 text-purple-200'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scoring Weight Sliders & Budget Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weight Vector Tuning Sliders */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Scoring Weight Vector (w₁ ··· w₄)
            </span>
            <button
              onClick={handleResetWeights}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
              title="Reset weights to research defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* w1: Dense Semantic */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex justify-between text-zinc-300 mb-1">
                <span className="font-medium text-purple-300">w₁ Dense Similarity:</span>
                <span className="font-mono">{weights.semantic.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights.semantic}
                onChange={(e) => handleWeightChange('semantic', Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="text-[10px] text-zinc-500 mt-1">Cosine similarity of Gemini dense embedding vectors</div>
            </div>

            {/* w2: Query Concept Coverage */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex justify-between text-zinc-300 mb-1">
                <span className="font-medium text-emerald-300">w₂ Concept Coverage:</span>
                <span className="font-mono">{weights.coverage.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights.coverage}
                onChange={(e) => handleWeightChange('coverage', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="text-[10px] text-zinc-500 mt-1">Fraction of required query concepts matched</div>
            </div>

            {/* w3: Relationship Alignment */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex justify-between text-zinc-300 mb-1">
                <span className="font-medium text-blue-300">w₃ Relationship Alignment:</span>
                <span className="font-mono">{weights.relationship.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights.relationship}
                onChange={(e) => handleWeightChange('relationship', Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="text-[10px] text-zinc-500 mt-1">Structured subject-predicate-object triple matching</div>
            </div>

            {/* w4: Lexical Overlap */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80">
              <div className="flex justify-between text-zinc-300 mb-1">
                <span className="font-medium text-amber-300">w₄ Lexical Overlap:</span>
                <span className="font-mono">{weights.lexical.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights.lexical}
                onChange={(e) => handleWeightChange('lexical', Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="text-[10px] text-zinc-500 mt-1">Exact keyword token overlap / BM25 proxy</div>
            </div>
          </div>
        </div>

        {/* Context Budget & Top-K Panel */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Context Budget & Top-K Limit
            </span>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Retrieve Top-K Chunks:</span>
                  <span className="font-mono font-bold text-zinc-100">{topK}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Context Window Budget:</span>
                  <span className="font-mono text-zinc-100">{contextBudget} chars</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={6000}
                  step={500}
                  value={contextBudget}
                  onChange={(e) => setContextBudget(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Context Progress Bar */}
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs">
            <div className="flex justify-between text-[11px] mb-1.5 font-mono">
              <span className="text-zinc-400">Context Allocated:</span>
              <span className="text-purple-300 font-semibold">{usedChars} / {contextBudget} chars ({budgetPercent}%)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">
              {selectedChunks.length} chunks selected for grounded generation
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Candidate Scoring & Reranking Table */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
            Candidate Trace Table ({candidates.length} evaluated passages)
          </h4>
          <span className="text-[11px] text-zinc-500 font-mono">
            Δ Rank = Initial - Final (▲ indicates promotion via context reranking)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                <th className="py-2.5 px-3">Chunk ID</th>
                <th className="py-2.5 px-3">Initial Rank</th>
                <th className="py-2.5 px-3">Final Rank</th>
                <th className="py-2.5 px-3">Δ Rank</th>
                <th className="py-2.5 px-3 text-purple-300">Dense Sim</th>
                <th className="py-2.5 px-3 text-emerald-300">Coverage</th>
                <th className="py-2.5 px-3 text-blue-300">Relations</th>
                <th className="py-2.5 px-3 text-amber-300">Lexical</th>
                <th className="py-2.5 px-3 text-zinc-100 font-bold">Weighted</th>
                <th className="py-2.5 px-3">Rerank Rationale</th>
                <th className="py-2.5 px-3 text-center">Selected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {candidates.map((cand) => {
                const delta = cand.rerankDelta;
                return (
                  <tr
                    key={cand.id}
                    className={`hover:bg-zinc-800/40 transition ${
                      cand.selectedForContext ? 'bg-purple-950/15' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-200">
                      {cand.id}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-zinc-400">
                      #{cand.initialRank}
                    </td>

                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-100">
                      #{cand.finalRank}
                    </td>

                    {/* Delta indicator */}
                    <td className="py-2.5 px-3 font-mono">
                      {delta > 0 ? (
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <ArrowUp className="w-3.5 h-3.5" />
                          <span>+{delta}</span>
                        </span>
                      ) : delta < 0 ? (
                        <span className="text-rose-400 flex items-center gap-0.5">
                          <ArrowDown className="w-3.5 h-3.5" />
                          <span>{delta}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500 flex items-center gap-0.5">
                          <Minus className="w-3 h-3" />
                          <span>0</span>
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-purple-300">
                      {cand.denseSemanticScore.toFixed(3)}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-emerald-300">
                      {cand.queryCoverageScore.toFixed(3)}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-blue-300">
                      {cand.relationshipScore.toFixed(3)}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-amber-300">
                      {cand.lexicalScore.toFixed(3)}
                    </td>

                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-100">
                      {cand.rerankScore.toFixed(3)}
                    </td>

                    <td className="py-2.5 px-3 text-[11px] text-zinc-400 max-w-xs truncate" title={cand.rerankExplanation}>
                      {cand.rerankExplanation}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {cand.selectedForContext ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> In Context
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-600">
                          Pruned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
