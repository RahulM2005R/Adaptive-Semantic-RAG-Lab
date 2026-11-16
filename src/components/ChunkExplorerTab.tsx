import React, { useState } from 'react';
import {
  Boxes,
  Sliders,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  Minimize2,
  Eye,
  GitBranch,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Tag,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { FixedChunk, SemanticChunk } from '../types/rag.ts';

interface ChunkExplorerTabProps {
  fixedChunks: FixedChunk[];
  semanticChunks: SemanticChunk[];
  chunkSize: number;
  chunkOverlap: number;
  onUpdateFixedParams: (size: number, overlap: number) => void;
  onRegenerateAdaptive: () => void;
  onJumpToPassage?: (passageId: string) => void;
  isProcessing: boolean;
}

export const ChunkExplorerTab: React.FC<ChunkExplorerTabProps> = ({
  fixedChunks,
  semanticChunks,
  chunkSize,
  chunkOverlap,
  onUpdateFixedParams,
  onRegenerateAdaptive,
  onJumpToPassage,
  isProcessing,
}) => {
  const [selectedSemanticChunk, setSelectedSemanticChunk] = useState<SemanticChunk | null>(null);
  const [selectedFixedChunk, setSelectedFixedChunk] = useState<FixedChunk | null>(null);
  const [autoHighlightInWorkspace, setAutoHighlightInWorkspace] = useState(true);

  const [localChunkSize, setLocalChunkSize] = useState(chunkSize);
  const [localOverlap, setLocalOverlap] = useState(chunkOverlap);

  const handleApplyFixedParams = () => {
    onUpdateFixedParams(localChunkSize, localOverlap);
  };

  const handleSemanticChunkClick = (chunk: SemanticChunk) => {
    setSelectedSemanticChunk(chunk);
    if (autoHighlightInWorkspace && chunk.passageIds && chunk.passageIds.length > 0 && onJumpToPassage) {
      onJumpToPassage(chunk.passageIds[0]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Method Contrast Explanation */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Chunking Methodology Comparison & Interactive Passage Alignment
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Click any semantic chunk below to automatically highlight its original text passage in the Document Workspace tab.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoHighlightInWorkspace(!autoHighlightInWorkspace)}
            className={`px-3 py-1.5 rounded-md border text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
              autoHighlightInWorkspace
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-200 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="When active, clicking any semantic chunk automatically switches to Document Workspace and scrolls to the highlighted passage"
          >
            <span className={`w-2 h-2 rounded-full ${autoHighlightInWorkspace ? 'bg-purple-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span>Auto-Jump to Workspace: {autoHighlightInWorkspace ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onRegenerateAdaptive}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-purple-950/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Analyzing...' : 'Re-run Semantic Chunking'}</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Conventional Fixed-Size Chunks */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-zinc-400" />
                <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                  Baseline: Fixed-Size Chunking
                </h4>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {fixedChunks.length} Chunks
              </span>
            </div>

            {/* Config Sliders */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-950/70 p-3 rounded-lg border border-zinc-800">
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Window Size:</span>
                  <span className="font-mono text-zinc-200">{localChunkSize} chars</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={800}
                  step={50}
                  value={localChunkSize}
                  onChange={(e) => setLocalChunkSize(Number(e.target.value))}
                  className="w-full accent-zinc-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Overlap:</span>
                  <span className="font-mono text-zinc-200">{localOverlap} chars</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={20}
                  value={localOverlap}
                  onChange={(e) => setLocalOverlap(Number(e.target.value))}
                  className="w-full accent-zinc-400"
                />
              </div>

              <div className="col-span-2 flex justify-end">
                <button
                  onClick={handleApplyFixedParams}
                  disabled={isProcessing}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition cursor-pointer"
                >
                  Apply Parameters
                </button>
              </div>
            </div>
          </div>

          {/* Fixed Chunks List */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {fixedChunks.map((chunk) => {
              const isSelected = selectedFixedChunk?.id === chunk.id;
              return (
                <div
                  key={chunk.id}
                  onClick={() => setSelectedFixedChunk(chunk)}
                  className={`p-4 rounded-xl border transition cursor-pointer text-xs ${
                    isSelected
                      ? 'border-zinc-500 bg-zinc-800/40 ring-1 ring-zinc-500'
                      : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-zinc-300">
                      {chunk.id}
                    </span>
                    <div className="flex items-center gap-2">
                      {chunk.splitMidSentence && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 flex items-center gap-1">
                          <Scissors className="w-2.5 h-2.5 text-rose-400" />
                          <span>Mid-Sentence Cut</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500">
                        Chars {chunk.startChar}–{chunk.endChar}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-2">
                    "{chunk.text}"
                  </p>

                  {/* Passage reference pills */}
                  {chunk.passageRefs && chunk.passageRefs.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-zinc-500 font-mono">Passages:</span>
                        {chunk.passageRefs.map((pid) => (
                          <button
                            key={pid}
                            onClick={(e) => {
                              e.stopPropagation();
                              onJumpToPassage?.(pid);
                            }}
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-purple-900/40 hover:text-purple-200 text-zinc-400 border border-zinc-800 transition flex items-center gap-1 cursor-pointer"
                            title={`Highlight ${pid} in Document Workspace`}
                          >
                            <FileText className="w-2.5 h-2.5 text-zinc-400" />
                            <span>{pid}</span>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (chunk.passageRefs?.[0]) onJumpToPassage?.(chunk.passageRefs[0]);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition"
                      >
                        <span>Workspace</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Adaptive Semantic Chunks */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-semibold text-purple-200 uppercase tracking-wider">
                  Adaptive Proposition Chunks
                </h4>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700/50 text-purple-200">
                {semanticChunks.length} Semantic Units
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Constructed via sentence co-reference, entity-attribute bounding, and condition preservation. Click any chunk to highlight its source passage.
            </p>
          </div>

          {/* Semantic Chunks List */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {semanticChunks.map((chunk) => {
              const isSelected = selectedSemanticChunk?.id === chunk.id;
              return (
                <div
                  key={chunk.id}
                  onClick={() => handleSemanticChunkClick(chunk)}
                  className={`p-4 rounded-xl border transition cursor-pointer text-xs relative ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/40 ring-2 ring-purple-500/40 shadow-lg'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-purple-500/50 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-300 px-2 py-0.5 rounded bg-blue-950 border border-blue-800">
                        {chunk.displayId || chunk.id}
                      </span>
                      <span className="text-[10px] font-mono text-purple-400">
                        ({chunk.id})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-emerald-400 border border-emerald-900/50">
                        {chunk.embeddingStatus === 'computed' ? 'Gemini Vector' : 'Normalized Vector'}
                      </span>
                    </div>
                  </div>

                  {/* Verbatim Text Quote */}
                  <div className="text-xs text-zinc-100 font-medium italic mb-2">
                    "{chunk.text}"
                  </div>

                  {/* Extracted Semantic Mapping Tags */}
                  {chunk.extractedTags && chunk.extractedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {chunk.extractedTags.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1"
                        >
                          <span>{t.label}</span>
                          <span className="text-zinc-500">→</span>
                          <span className="text-emerald-400 font-semibold">{t.target}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Badges: Entities, Attributes, Conditions, Negations */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {chunk.entities.map((e, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-950/40 text-blue-300"
                      >
                        {e.name}
                      </span>
                    ))}

                    {chunk.attributes.slice(0, 3).map((a, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                      >
                        {a.attribute}: {a.value}
                      </span>
                    ))}

                    {chunk.conditions.map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-950/40 text-amber-300"
                        title={c.rule}
                      >
                        Condition: {c.rule.slice(0, 24)}...
                      </span>
                    ))}

                    {chunk.negations.map((n, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-rose-500/40 bg-rose-950/40 text-rose-300"
                        title={n.statement}
                      >
                        Negation: {n.negatedConcept}
                      </span>
                    ))}
                  </div>

                  {/* Boundary Rationale Box */}
                  <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-400 italic mb-2.5">
                    <span className="text-purple-400 font-semibold not-italic">Boundary Rationale: </span>
                    {chunk.boundaryRationale}
                  </div>

                  {/* Interactive Passage Bar: Clickable Passage Pills + Jump Action */}
                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 font-mono">Passages:</span>
                      {chunk.passageIds.map((pid) => (
                        <button
                          key={pid}
                          onClick={(e) => {
                            e.stopPropagation();
                            onJumpToPassage?.(pid);
                          }}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-purple-900/60 hover:text-purple-200 text-purple-300 border border-purple-500/30 hover:border-purple-400 transition flex items-center gap-1 cursor-pointer"
                          title={`Click to highlight passage ${pid} in Document Workspace`}
                        >
                          <FileText className="w-2.5 h-2.5 text-purple-400" />
                          <span>{pid}</span>
                        </button>
                      ))}
                      <span className="text-[10px] font-mono text-zinc-500">· Page {chunk.sourcePages.join(', ')}</span>
                      {chunk.charStart !== undefined ? (
                        <span className="text-[10px] font-mono text-zinc-500">· Chars {chunk.charStart}-{chunk.charEnd}</span>
                      ) : null}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (chunk.passageIds?.[0]) onJumpToPassage?.(chunk.passageIds[0]);
                      }}
                      className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer transition bg-purple-950/40 hover:bg-purple-900/50 px-2.5 py-1 rounded-md border border-purple-500/40 text-[11px] shadow-sm ml-auto"
                      title="Open Document Workspace and highlight this passage"
                    >
                      <FileText className="w-3 h-3 text-purple-400" />
                      <span>Highlight in Workspace</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Semantic Chunk Inspector Drawer / Modal */}
      {selectedSemanticChunk && (
        <div className="p-5 rounded-xl border border-purple-500/40 bg-zinc-950 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950 px-2 py-1 rounded border border-purple-800">
                {selectedSemanticChunk.id}
              </span>
              <h4 className="text-sm font-semibold text-zinc-100">
                Detailed Semantic Representation & Sentence Breakdown
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {selectedSemanticChunk.passageIds?.[0] && (
                <button
                  onClick={() => onJumpToPassage?.(selectedSemanticChunk.passageIds[0])}
                  className="px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-purple-950/40"
                  title="Jump to passage in Document Workspace"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Highlight in Document Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setSelectedSemanticChunk(null)}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Raw Text & Sentences */}
            <div className="space-y-3">
              <div>
                <div className="text-zinc-400 font-semibold mb-1">Original Passage Content:</div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 leading-relaxed font-sans">
                  {selectedSemanticChunk.text}
                </div>
              </div>

              <div>
                <div className="text-zinc-400 font-semibold mb-1">Verbatim Sentences ({selectedSemanticChunk.originalSentences.length}):</div>
                <ul className="space-y-1.5 list-decimal list-inside text-zinc-400">
                  {selectedSemanticChunk.originalSentences.map((s, i) => (
                    <li key={i} className="text-zinc-300">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Semantic Triples & Metadata */}
            <div className="space-y-3">
              <div>
                <div className="text-zinc-400 font-semibold mb-1">Extracted Relational Triples:</div>
                <div className="space-y-1.5">
                  {selectedSemanticChunk.relationships.length > 0 ? (
                    selectedSemanticChunk.relationships.map((rel, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-zinc-900 border border-emerald-900/40 text-emerald-300 font-mono text-[11px] flex items-center gap-2"
                      >
                        <span className="text-blue-300 font-semibold">{rel.source}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">[{rel.relation}]</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span className="text-purple-300 font-semibold">{rel.target}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500 italic">No complex multi-entity relationships extracted.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-zinc-400 font-semibold mb-1">Concept Labels & Boundary Justification:</div>
                <div className="p-3 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {selectedSemanticChunk.conceptLabels.map((lbl, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                        #{lbl}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-zinc-400 leading-relaxed">
                    {selectedSemanticChunk.boundaryRationale}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
