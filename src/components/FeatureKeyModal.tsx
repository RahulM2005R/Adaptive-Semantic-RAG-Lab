import React from 'react';
import { X, BookOpen, Layers, CheckCircle2, AlertTriangle, ShieldCheck, GitMerge } from 'lucide-react';

interface FeatureKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureKeyModal: React.FC<FeatureKeyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Research Feature Key & Visual Language
              </h2>
              <p className="text-xs text-zinc-400">
                Formal definitions, color semantics, and mathematical formulas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300">
          {/* Visual Color Code Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              1. Color Semantic Hierarchy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-950/30 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-blue-300 text-xs">Blue: Entities & Named Concepts</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Specific actors, systems, biological agents, components (e.g., "API Gateway", "apple", "server").
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/30 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-emerald-300 text-xs">Green: Attributes & Relationships</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Properties, values, and relational triples (e.g., "colour → red", "timeout → 30s", "contains → vitamin C").
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/30 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-amber-300 text-xs">Amber: Conditions & Constraints</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Rule predicates, environmental prerequisites (e.g., "when authentication fails", "under high load").
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-950/30 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-purple-300 text-xs">Purple: Query–Document Alignments</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Direct semantic edges connecting decomposed query requirements to candidate passage evidence.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/30 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-rose-300 text-xs">Red: Negations, Conflicts & Unsupported</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Negative assertions (e.g., "is not public"), passage contradictions, or query claims lacking evidence.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/40 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-300 text-xs">Grey: Neutral / Non-Authoritative</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Background context, low-relevance passages, or unselected candidate chunks.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Formulations */}
          <div className="border-t border-zinc-800 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              2. Retrieval & Alignment Formulations
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-purple-400 font-semibold mb-1">Dense Semantic Cosine Similarity:</div>
                <div className="text-zinc-300">
                  sim(A, B) = (A · B) / (‖A‖ × ‖B‖)
                </div>
                <div className="text-zinc-500 text-[11px] mt-1 font-sans">
                  Evaluated using Gemini embedding vectors (or normalized subword hash vectors on fallback). Normalized to [0.0, 1.0].
                </div>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-emerald-400 font-semibold mb-1">Query Concept Coverage (Semantic Parity):</div>
                <div className="text-zinc-300">
                  Coverage(Q, D) = |{'{'}c ∈ Q_concepts : supported_by(c, D){'}'}| / |Q_concepts|
                </div>
                <div className="text-zinc-500 text-[11px] mt-1 font-sans">
                  The fraction of atomic requirements in the decomposed query satisfied by the retrieved evidence set.
                </div>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-blue-400 font-semibold mb-1">Multi-Signal Weighted Retrieval Score:</div>
                <div className="text-zinc-300">
                  Score = (w₁ · sim_dense + w₂ · Coverage + w₃ · Rel_Align + w₄ · Lexical) / (∑ wᵢ)
                </div>
                <div className="text-zinc-500 text-[11px] mt-1 font-sans">
                  Configurable weights balancing conceptual relatedness, requirement coverage, relation matching, and exact lexical overlap.
                </div>
              </div>

              <div className="p-3 rounded bg-zinc-950 border border-zinc-800">
                <div className="text-amber-400 font-semibold mb-1">Context-Aware Rerank Score:</div>
                <div className="text-zinc-300">
                  Rerank(D) = Score(D) + Bonus(NewConcepts) + Bonus(Conditions) - Penalty(Redundant)
                </div>
                <div className="text-zinc-500 text-[11px] mt-1 font-sans">
                  Re-orders initial candidates to maximize coverage diversity and enforce conditional/negation compatibility before answer generation.
                </div>
              </div>
            </div>
          </div>

          {/* Core Definitions */}
          <div className="border-t border-zinc-800 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              3. Core Chunking & Verification Principles
            </h3>
            <ul className="space-y-2 text-xs text-zinc-300 list-disc list-inside">
              <li>
                <strong className="text-zinc-100">Conventional Chunking:</strong> Fixed character or token windows (e.g. 300 chars, 60 overlap). Prone to severing related entities from their attributes.
              </li>
              <li>
                <strong className="text-zinc-100">Adaptive Semantic Chunking:</strong> Contextual boundary placement driven by semantic completeness, topic boundaries, and relationship preservation.
              </li>
              <li>
                <strong className="text-zinc-100">Faithfulness:</strong> Measured as the ratio of explicitly supported claims to total claims made in the generated answer.
              </li>
              <li>
                <strong className="text-zinc-100">Abstention:</strong> Safe refusal to hallucinate an answer when key query concepts cannot be verified in the retrieved source passages.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
