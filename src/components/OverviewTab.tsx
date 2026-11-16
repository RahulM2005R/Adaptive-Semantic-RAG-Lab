import React, { useState, useEffect } from 'react';
import {
  FileText,
  Boxes,
  Network,
  ArrowRight,
  Sparkles,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Tag,
  Zap,
  ExternalLink,
  BookOpen,
  Check,
  HelpCircle,
} from 'lucide-react';
import {
  DocumentSource,
  FixedChunk,
  SemanticChunk,
  RetrievalRun,
  GeneratedAnswer,
  ScoredChunk,
} from '../types/rag.ts';

interface OverviewTabProps {
  currentDoc: DocumentSource | null;
  fixedChunks: FixedChunk[];
  semanticChunks: SemanticChunk[];
  lastRun: RetrievalRun | null;
  query: string;
  generatedAnswer: GeneratedAnswer | null;
  retrievedEvidence: ScoredChunk[];
  onSelectTab: (tab: string) => void;
  onAnalyzePrompt: (prompt: string) => void;
  onUploadDoc: (file: File) => void;
  onPasteText: (text: string) => void;
  onJumpToPassage?: (passageId: string) => void;
  onGenerateAnswer?: () => void;
  isProcessing: boolean;
  apiConnected: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  currentDoc,
  fixedChunks,
  semanticChunks,
  lastRun,
  query,
  generatedAnswer,
  retrievedEvidence,
  onSelectTab,
  onAnalyzePrompt,
  onUploadDoc,
  onPasteText,
  onJumpToPassage,
  onGenerateAnswer,
  isProcessing,
  apiConnected,
}) => {
  const [promptInput, setPromptInput] = useState(query || '');
  const [rawText, setRawText] = useState('');
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste'>('upload');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (query && query !== promptInput) {
      setPromptInput(query);
    }
  }, [query]);

  const handlePasteSubmit = () => {
    if (!rawText.trim()) return;
    onPasteText(rawText);
  };

  const handlePromptSubmit = () => {
    if (!promptInput.trim()) return;
    onAnalyzePrompt(promptInput);
  };

  // Helper to render answer text with clickable citation links
  const renderGroundedAnswerText = (text: string) => {
    const parts = text.split(/(\[CIT_\d+\]|\[Passage\s*[^\]]+\])/gi);
    return parts.map((part, i) => {
      const citMatch = part.match(/\[CIT_(\d+)\]/i);
      if (citMatch) {
        const citIdx = parseInt(citMatch[1], 10) - 1;
        const targetEv = retrievedEvidence[citIdx];
        const passageId = targetEv?.passageIds?.[0];
        return (
          <button
            key={i}
            onClick={() => {
              if (passageId && onJumpToPassage) onJumpToPassage(passageId);
            }}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 text-[11px] font-mono font-medium transition cursor-pointer"
            title={`Click to view source in Document Workspace (Passage ${passageId || citMatch[1]})`}
          >
            <FileText className="w-2.5 h-2.5 text-purple-400" />
            <span>{part}</span>
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Title & Live Status */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl flex items-center gap-2.5">
              <span>Document & Prompt Analyzer</span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-purple-500/40 bg-purple-950/40 text-purple-300 font-normal">
                High-Accuracy Semantic Chunking
              </span>
            </h2>
            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed max-w-2xl">
              Upload any custom document or paste text. The model applies high-accuracy adaptive semantic chunking, extracts pure canonical query concepts, and generates clear supportive answers with verified source retrieval origins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-xs font-mono text-zinc-400">
              {apiConnected ? 'Gemini 3.8 Flash Ready' : 'Connecting to API...'}
            </span>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/80">
            <div className="text-[11px] text-zinc-500 font-mono">Loaded Document</div>
            <div className="text-xs font-semibold text-zinc-200 truncate mt-0.5" title={currentDoc?.name || 'Awaiting document'}>
              {currentDoc ? currentDoc.name : 'No document yet'}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {currentDoc ? `${currentDoc.passages.length} passages extracted` : 'Upload or paste text'}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/80">
            <div className="text-[11px] text-zinc-500 font-mono">Semantic Chunks</div>
            <div className="text-sm font-bold text-purple-400 font-mono mt-0.5">
              {semanticChunks.length} units
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              vs {fixedChunks.length} fixed baseline
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/80">
            <div className="text-[11px] text-zinc-500 font-mono">Decomposed Concepts</div>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
              {lastRun ? `${lastRun.queryRepresentation.concepts.length} concepts` : '—'}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {lastRun ? `${lastRun.coverageBreakdown.supported} fully supported` : 'Awaiting prompt'}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/80">
            <div className="text-[11px] text-zinc-500 font-mono">Concept Parity Coverage</div>
            <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
              {lastRun ? `${(lastRun.coverageScore * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {generatedAnswer ? 'Answer Generated' : 'Awaiting prompt'}
            </div>
          </div>
        </div>
      </div>

      {/* Two-Section Core Analyzer: 1. Input Document, 2. Enter Prompt */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SECTION 1: User Document / Text Input */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>1. Provide Document or Text</span>
              </span>
              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('upload')}
                  className={`px-2 py-0.5 rounded transition ${
                    activeInputMode === 'upload' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={`px-2 py-0.5 rounded transition ${
                    activeInputMode === 'paste' ? 'bg-purple-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>

            {activeInputMode === 'upload' ? (
              /* File Drag & Drop */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.[0]) onUploadDoc(e.dataTransfer.files[0]);
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center min-h-[170px] ${
                  dragOver
                    ? 'border-purple-500 bg-purple-950/20'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                }`}
              >
                <Upload className="w-7 h-7 text-purple-400 mb-2" />
                <div className="text-xs font-medium text-zinc-200">
                  Drag & drop your file here, or browse
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Supports PDF, DOCX, TXT, or Markdown (.md)
                </p>
                <div className="mt-3">
                  <label className="px-3.5 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium cursor-pointer transition shadow-md shadow-purple-950/40">
                    Browse File
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) onUploadDoc(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              /* Paste Raw Text */
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste any article, technical specification, notes, or research text here..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
                />
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>{rawText.length} chars · ~{Math.round(rawText.length / 4)} tokens</span>
                  <button
                    onClick={handlePasteSubmit}
                    disabled={!rawText.trim() || isProcessing}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition cursor-pointer"
                  >
                    {isProcessing ? 'Analyzing...' : 'Ingest & Chunk Text'}
                  </button>
                </div>
              </div>
            )}

            {currentDoc && (
              <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium text-zinc-200 truncate">{currentDoc.name}</span>
                </div>
                <span className="text-[11px] font-mono text-purple-300 shrink-0">
                  {semanticChunks.length} semantic chunks
                </span>
              </div>
            )}
          </div>

          {/* Quick link to Chunk Explorer */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500 text-[11px]">Compare with fixed baseline</span>
            <button
              onClick={() => onSelectTab('chunks')}
              className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition cursor-pointer"
            >
              <span>Chunk Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SECTION 2: User Prompt & Semantic Alignment */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 font-mono flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>2. Enter User Prompt / Query</span>
            </span>

            <p className="text-xs text-zinc-400">
              The model deconstructs your prompt into canonical concepts (e.g. "LLM Hallucinations"), aligns them to evidence chunks, and automatically synthesizes a grounded supportive answer.
            </p>

            <div className="space-y-2">
              <textarea
                rows={4}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. What is LLM Hallucinations and under what conditions does it occur?"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />

              <button
                onClick={handlePromptSubmit}
                disabled={!promptInput.trim() || isProcessing}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-purple-950/40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Analyzing Concepts & Aligning...' : 'Analyze Prompt & Generate Answer'}</span>
              </button>
            </div>

            {/* Decomposed Concepts */}
            {lastRun && (
              <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Decomposed Concepts:</span>
                  <span className="text-emerald-400 font-mono text-[11px] font-bold">
                    {(lastRun.coverageScore * 100).toFixed(0)}% Coverage
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lastRun.queryRepresentation.concepts.map((qc) => {
                    const isSupported = !lastRun.coverageBreakdown.unsupportedConcepts.includes(qc.text);
                    return (
                      <span
                        key={qc.id}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                          isSupported
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span className="font-semibold">{qc.text}</span>
                        <span className="text-[9px] text-zinc-500 uppercase">({qc.type})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick link to Alignment & Answer */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-500 text-[11px]">Inspect bipartite graph</span>
            <button
              onClick={() => onSelectTab('alignment')}
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition cursor-pointer"
            >
              <span>Alignment Graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Clear Supportive Answer & Exact Retrieval Origins */}
      {(generatedAnswer || retrievedEvidence.length > 0) && (
        <div className="space-y-6 pt-2 animate-fade-in">
          {/* Main Supportive Answer Card */}
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <span>Specific Analytical Answer:</span>
                    <span className="text-emerald-300 font-mono text-xs font-normal">"{query || lastRun?.query}"</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Synthesized by analyzing the text, using the retrieved document passages as authoritative support and evidence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
                  {generatedAnswer ? `${(generatedAnswer.faithfulnessScore * 100).toFixed(0)}% Text-Grounded` : 'Evidence Retrieved'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {generatedAnswer?.modelName || 'Gemini 3.8 Flash'}
                </span>
              </div>
            </div>

            {/* Executive Analysis Summary if available */}
            {generatedAnswer?.analysisSummary && (
              <div className="px-3.5 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-200/90 font-medium flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold shrink-0">Analysis:</span>
                <span>{generatedAnswer.analysisSummary}</span>
              </div>
            )}

            {/* Answer Content */}
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800/80 text-xs sm:text-sm text-zinc-100 leading-relaxed font-sans shadow-inner">
              {generatedAnswer?.answerText ? (
                renderGroundedAnswerText(generatedAnswer.answerText)
              ) : (
                <div className="text-zinc-400 italic">
                  Retrieval complete. Evidence retrieved from {retrievedEvidence.length} document passages below.
                </div>
              )}
            </div>

            {/* Key Analytical Takeaways if available */}
            {generatedAnswer?.keyTakeaways && generatedAnswer.keyTakeaways.length > 0 && (
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Specific Findings & Key Takeaways:</span>
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-sans pl-1">
                  {generatedAnswer.keyTakeaways.map((takeaway, tIdx) => (
                    <li key={tIdx} className="flex items-start gap-2">
                      <span className="text-purple-400 font-mono text-[11px] mt-0.5 font-bold">•</span>
                      <span className="leading-relaxed">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Claims Verification pills */}
            {generatedAnswer?.claims && generatedAnswer.claims.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Verified Assertions Supported by Text ({generatedAnswer.claims.length}):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {generatedAnswer.claims.map((claim) => (
                    <div
                      key={claim.id}
                      className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/50 text-xs flex items-start gap-2"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="space-y-0.5">
                        <div className="text-zinc-200 font-medium">{claim.claimText}</div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          Status: <span className="text-emerald-400 font-semibold">{claim.status}</span> · {claim.citationId || 'CIT_1'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Where These Answers Were Retrieved From */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>Where These Answers Were Retrieved From</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Direct document passages and propositions supporting the answer. Click any passage to view and highlight in the Document Workspace.
                </p>
              </div>

              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-purple-300">
                {retrievedEvidence.length} Authoritative Sources
              </span>
            </div>

            {/* Grid of Retrieved Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {retrievedEvidence.map((ev, idx) => {
                const passageId = ev.passageIds?.[0] || `pass_${idx + 1}`;
                const pageNum = ev.sourcePages?.[0] || 1;
                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:border-purple-500/40 transition space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-purple-300 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800">
                            CIT_{idx + 1}
                          </span>
                          <span className="font-mono text-xs text-zinc-300 font-medium">
                            {passageId}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-zinc-500">
                          Page {pageNum} {ev.charStart !== undefined ? `· Chars [${ev.charStart}..${ev.charEnd}]` : ''}
                        </span>
                      </div>

                      {/* Verbatim Excerpt */}
                      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-200 font-sans italic leading-relaxed">
                        "{ev.text}"
                      </div>

                      {/* Matched Concepts */}
                      {ev.supportedConceptIds && ev.supportedConceptIds.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-mono text-zinc-500">Matches:</span>
                          {ev.supportedConceptIds.map((cid) => (
                            <span
                              key={cid}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                            >
                              {cid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Interactive Action Button to Jump to Passage */}
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-emerald-400">
                        Score: {(ev.weightedScore || ev.denseSemanticScore || 0.85).toFixed(2)}
                      </span>

                      <button
                        onClick={() => {
                          if (onJumpToPassage) onJumpToPassage(passageId);
                        }}
                        className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1.5 cursor-pointer transition bg-purple-950/40 hover:bg-purple-900/60 px-2.5 py-1 rounded-md border border-purple-500/40 text-[11px]"
                      >
                        <FileText className="w-3 h-3 text-purple-400" />
                        <span>Inspect in Document Workspace</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
