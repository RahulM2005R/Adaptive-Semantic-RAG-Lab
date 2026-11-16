import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Cpu,
  Clock,
  Layers,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { GeneratedAnswer, ScoredChunk, QueryRepresentation, AnswerClaim, AnswerCitation } from '../types/rag.ts';

interface AnswerCitationsTabProps {
  query: string;
  queryRepresentation: QueryRepresentation | null;
  retrievedEvidence: ScoredChunk[];
  generatedAnswer: GeneratedAnswer | null;
  onGenerateAnswer: () => void;
  onJumpToPassage: (passageId: string) => void;
  isProcessing: boolean;
  latencyMs?: number;
}

export const AnswerCitationsTab: React.FC<AnswerCitationsTabProps> = ({
  query,
  queryRepresentation,
  retrievedEvidence,
  generatedAnswer,
  onGenerateAnswer,
  onJumpToPassage,
  isProcessing,
  latencyMs,
}) => {
  const [selectedCitation, setSelectedCitation] = useState<AnswerCitation | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);

  const handleCopy = () => {
    if (generatedAnswer?.answerText) {
      navigator.clipboard.writeText(generatedAnswer.answerText);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Generation Trigger */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Evidence-Grounded Answer Generation & Citation Validation
              </h3>
              <p className="text-xs text-zinc-400">
                Synthesized exclusively from retrieved authoritative document evidence with verifiable passage citations
              </p>
            </div>
          </div>

          <button
            onClick={onGenerateAnswer}
            disabled={isProcessing || retrievedEvidence.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-950/40"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isProcessing ? 'Synthesizing...' : 'Generate Grounded Answer'}</span>
          </button>
        </div>

        {/* Query & Evidence Count */}
        <div className="flex items-center justify-between text-xs bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono">Query:</span>
            <span className="text-zinc-200 font-medium">"{query || 'No query submitted'}"</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-400 font-mono text-[11px]">
            <span>{retrievedEvidence.length} Evidence Passages In Context</span>
            {latencyMs && <span>· Total: {latencyMs} ms</span>}
          </div>
        </div>
      </div>

      {/* Main Answer Card */}
      {generatedAnswer ? (
        <div className="space-y-6">
          {/* Answer Output */}
          <div className="p-6 rounded-xl border border-emerald-500/30 bg-zinc-900/50 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  Model: {generatedAnswer.modelName}
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  Faithfulness: {(generatedAnswer.faithfulnessScore * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                >
                  {copiedAnswer ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Answer</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Abstention Banner if triggered */}
            {generatedAnswer.abstained && (
              <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-200">System Abstained from Generating Unsubstantiated Answer:</div>
                  <div className="text-[11px] text-rose-300 mt-0.5">
                    {generatedAnswer.abstentionReason || 'Retrieved document passages contain insufficient or contradictory evidence to verify the query claims without hallucination.'}
                  </div>
                </div>
              </div>
            )}

            {/* Rendered Answer Text with Clickable Citation Pills */}
            <div className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {generatedAnswer.answerText}
            </div>

            {/* Clickable Citations List */}
            <div className="pt-3 border-t border-zinc-800/80">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Source Citations (Click to inspect or jump to source passage):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {generatedAnswer.citations.map((cit) => (
                  <button
                    key={cit.citationId}
                    onClick={() => {
                      setSelectedCitation(cit);
                      onJumpToPassage(cit.passageId);
                    }}
                    className="px-2.5 py-1 rounded-md border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-mono transition cursor-pointer flex items-center gap-1.5 group"
                    title={`Jump to passage ${cit.passageId} (Page ${cit.pageNumber || 1})`}
                  >
                    <span className="font-bold">[{cit.citationId}]</span>
                    <span className="text-[11px] text-zinc-300">{cit.passageId} (P.{cit.pageNumber || 1})</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Claim-by-Claim Verification Table (Evidence Support Panel) */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                Claim-by-Claim Evidence Support Panel ({generatedAnswer.claims.length} claims extracted)
              </h4>
              <span className="text-[11px] text-zinc-500 font-mono">
                Evaluates claim grounding against retrieved source sentences
              </span>
            </div>

            <div className="space-y-2.5">
              {generatedAnswer.claims.map((claim) => (
                <div
                  key={claim.id}
                  className={`p-3.5 rounded-lg border text-xs space-y-1.5 transition ${
                    claim.status === 'supported'
                      ? 'border-emerald-500/30 bg-emerald-950/15'
                      : claim.status === 'partially_supported'
                      ? 'border-amber-500/30 bg-amber-950/15'
                      : 'border-rose-500/30 bg-rose-950/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-zinc-300">
                        {claim.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.2 rounded uppercase ${
                          claim.status === 'supported'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : claim.status === 'partially_supported'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {claim.status.replace('_', ' ')}
                      </span>
                    </div>

                    {claim.citationId && (
                      <span className="font-mono text-[11px] text-emerald-400">
                        Citation: [{claim.citationId}]
                      </span>
                    )}
                  </div>

                  <div className="font-medium text-zinc-200 text-xs">
                    "{claim.claimText}"
                  </div>

                  {claim.supportingPassage && (
                    <div className="text-[11px] text-zinc-400 italic font-sans pt-1 border-t border-zinc-800/60">
                      Evidence: "{claim.supportingPassage}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Unsupported Requirements Panel */}
          {generatedAnswer.unsupportedRequirements.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Explicitly Identified Unsupported Requirements:</span>
              </div>
              <ul className="list-disc list-inside text-zinc-300 space-y-1">
                {generatedAnswer.unsupportedRequirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
              <div className="text-[11px] text-zinc-400 pt-1">
                The model explicitly refused to invent data for the above concepts, preventing false positive hallucination.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/30">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-zinc-300">No Answer Generated Yet</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Click "Generate Grounded Answer" above to synthesize an answer strictly verified against retrieved evidence.
          </p>
        </div>
      )}
    </div>
  );
};
