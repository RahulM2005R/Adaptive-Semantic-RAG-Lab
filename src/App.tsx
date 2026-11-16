import React, { useState, useEffect } from 'react';
import {
  Layers,
  FileText,
  Boxes,
  Network,
  Sliders,
  ShieldCheck,
  BarChart3,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  DocumentSource,
  FixedChunk,
  SemanticChunk,
  QueryRepresentation,
  ScoredChunk,
  GeneratedAnswer,
  RetrievalMode,
  ScoringWeights,
  RetrievalRun,
  BenchmarkCase,
} from './types/rag.ts';
import { Header } from './components/Header.tsx';
import { FeatureKeyModal } from './components/FeatureKeyModal.tsx';
import { OverviewTab } from './components/OverviewTab.tsx';
import { DocumentWorkspaceTab } from './components/DocumentWorkspaceTab.tsx';
import { ChunkExplorerTab } from './components/ChunkExplorerTab.tsx';
import { QueryAlignmentTab } from './components/QueryAlignmentTab.tsx';
import { RetrievalTraceTab } from './components/RetrievalTraceTab.tsx';
import { AnswerCitationsTab } from './components/AnswerCitationsTab.tsx';
import { EvaluationLabTab } from './components/EvaluationLabTab.tsx';
import { SAMPLE_DOCUMENTS } from './data/sampleDocuments.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isFeatureKeyOpen, setIsFeatureKeyOpen] = useState(false);
  const [apiConnected, setApiConnected] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Document & Chunks State
  const [currentDoc, setCurrentDoc] = useState<DocumentSource | null>(null);
  const [fixedChunks, setFixedChunks] = useState<FixedChunk[]>([]);
  const [semanticChunks, setSemanticChunks] = useState<SemanticChunk[]>([]);
  const [chunkSize, setChunkSize] = useState<number>(300);
  const [chunkOverlap, setChunkOverlap] = useState<number>(60);
  const [highlightedPassageId, setHighlightedPassageId] = useState<string | null>(null);

  // Query & Alignment State
  const [query, setQuery] = useState<string>('');
  const [queryRepresentation, setQueryRepresentation] = useState<QueryRepresentation | null>(null);
  const [scoredCandidates, setScoredCandidates] = useState<ScoredChunk[]>([]);
  const [retrievedEvidence, setRetrievedEvidence] = useState<ScoredChunk[]>([]);
  const [coverageScore, setCoverageScore] = useState<number>(0);
  const [coverageBreakdown, setCoverageBreakdown] = useState<{
    total: number;
    supported: number;
    partial: number;
    unsupported: number;
    unsupportedConcepts: string[];
  }>({
    total: 0,
    supported: 0,
    partial: 0,
    unsupported: 0,
    unsupportedConcepts: [],
  });

  // Retrieval & Scoring Configuration
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>('context_reranked');
  const [weights, setWeights] = useState<ScoringWeights>({
    semantic: 0.35,
    coverage: 0.30,
    relationship: 0.20,
    lexical: 0.15,
  });
  const [topK, setTopK] = useState<number>(4);
  const [contextBudget, setContextBudget] = useState<number>(3000);
  const [lastRun, setLastRun] = useState<RetrievalRun | null>(null);

  // Answer State
  const [generatedAnswer, setGeneratedAnswer] = useState<GeneratedAnswer | null>(null);

  // Health check on mount (no pre-loaded documents)
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(() => setApiConnected(true))
      .catch(() => setApiConnected(false));
  }, []);

  const submitRawText = async (filename: string, fileType: string, rawText: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, fileType, rawTextContent: rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract text');
      await handleDocExtracted(data.document);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitBase64Doc = async (filename: string, fileType: string, base64: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, fileType, contentBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract document');
      await handleDocExtracted(data.document);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    const validExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      setErrorMsg(`Unsupported file format "${ext}". Supported: PDF, DOCX, TXT, MD.`);
      return;
    }
    const reader = new FileReader();
    if (ext === '.txt' || ext === '.md') {
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        await submitRawText(file.name, ext.replace('.', ''), text);
      };
      reader.readAsText(file);
    } else {
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        await submitBase64Doc(file.name, ext.replace('.', ''), base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzePromptFromOverview = async (promptText: string) => {
    setQuery(promptText);
    setActiveTab('alignment');
    await runQueryAnalysisAndRetrieval(
      promptText,
      semanticChunks,
      fixedChunks,
      retrievalMode,
      weights,
      topK,
      contextBudget
    );
  };

  const handleDocExtracted = async (doc: DocumentSource) => {
    setCurrentDoc(doc);
    await runChunkingPipeline(doc, chunkSize, chunkOverlap);
  };

  const runChunkingPipeline = async (doc: DocumentSource, size: number, overlap: number) => {
    setIsProcessing(true);
    try {
      // 1. Fixed-size baseline chunking
      const fixedRes = await fetch('/api/chunking/conventional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: doc.rawText,
          chunkSize: size,
          chunkOverlap: overlap,
          passages: doc.passages,
        }),
      });
      const fixedData = await fixedRes.json();
      setFixedChunks(fixedData.chunks || []);

      // 2. Adaptive semantic chunking
      const adaptiveRes = await fetch('/api/chunking/adaptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passages: doc.passages,
          documentText: doc.rawText,
        }),
      });
      const adaptiveData = await adaptiveRes.json();
      const semChunks: SemanticChunk[] = adaptiveData.chunks || [];
      setSemanticChunks(semChunks);

      // Automatically analyze active query against new chunks
      await runQueryAnalysisAndRetrieval(query, semChunks, fixedData.chunks, retrievalMode, weights, topK, contextBudget);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateFixedParams = async (size: number, overlap: number) => {
    setChunkSize(size);
    setChunkOverlap(overlap);
    if (!currentDoc) return;
    setIsProcessing(true);
    try {
      const fixedRes = await fetch('/api/chunking/conventional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentDoc.rawText,
          chunkSize: size,
          chunkOverlap: overlap,
          passages: currentDoc.passages,
        }),
      });
      const fixedData = await fixedRes.json();
      setFixedChunks(fixedData.chunks || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateAdaptive = async () => {
    if (!currentDoc) return;
    setIsProcessing(true);
    try {
      const adaptiveRes = await fetch('/api/chunking/adaptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passages: currentDoc.passages,
          documentText: currentDoc.rawText,
        }),
      });
      const adaptiveData = await adaptiveRes.json();
      setSemanticChunks(adaptiveData.chunks || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Query Analysis and Alignment Retrieval
  const runQueryAnalysisAndRetrieval = async (
    qText: string,
    sChunks: SemanticChunk[] = semanticChunks,
    fChunks: FixedChunk[] = fixedChunks,
    mode: RetrievalMode = retrievalMode,
    w: ScoringWeights = weights,
    k: number = topK,
    budget: number = contextBudget
  ) => {
    if (!qText.trim()) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      // Step A: Query Analysis
      const qRes = await fetch('/api/query/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: qText }),
      });
      const qData = await qRes.json();
      const representation: QueryRepresentation = qData.representation;
      setQueryRepresentation(representation);

      // Step B: Multi-signal RAG Retrieval
      const ragRes = await fetch('/api/rag/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: qText,
          queryRepresentation: representation,
          mode,
          weights: w,
          topK: k,
          maxContextBudgetChars: budget,
          semanticChunks: sChunks,
          fixedChunks: fChunks,
        }),
      });
      const ragData = await ragRes.json();
      const run: RetrievalRun = ragData.run;

      setLastRun(run);
      setScoredCandidates(run.candidates);
      setRetrievedEvidence(run.retrievedEvidence);
      setCoverageScore(run.coverageScore);
      setCoverageBreakdown(run.coverageBreakdown);

      // Step C: Automatically generate clear, supportive grounded answer with citations
      if (run.retrievedEvidence && run.retrievedEvidence.length > 0) {
        try {
          const ansRes = await fetch('/api/rag/generate-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: qText,
              queryRepresentation: representation,
              retrievedEvidence: run.retrievedEvidence,
              mode,
            }),
          });
          const ansData = await ansRes.json();
          if (ansData.answer) {
            setGeneratedAnswer(ansData.answer);
          }
        } catch (ansErr) {
          console.warn('Auto answer generation failed:', ansErr);
        }
      } else {
        setGeneratedAnswer(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Grounded Answer
  const handleGenerateAnswer = async () => {
    if (!query || retrievedEvidence.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/rag/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          queryRepresentation,
          retrievedEvidence,
          mode: retrievalMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate answer');
      setGeneratedAnswer(data.answer);
      setActiveTab('answer');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Jump to specific passage from citation or Chunk Explorer
  const handleJumpToPassage = (passageId: string) => {
    setHighlightedPassageId(passageId);
    setActiveTab('workspace');
    const scrollToTarget = () => {
      const elem = document.getElementById(`passage-${passageId}`);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    setTimeout(scrollToTarget, 100);
    setTimeout(scrollToTarget, 280);
  };

  // Evaluation runner for benchmark test case
  const handleRunBenchmarkCase = async (bCase: BenchmarkCase, mode: RetrievalMode) => {
    const t0 = Date.now();
    try {
      // 1. Ingest document for this case if different
      const extractRes = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: bCase.documentTitle,
          fileType: 'sample',
          rawTextContent: bCase.documentText,
        }),
      });
      const extractData = await extractRes.json();
      const doc: DocumentSource = extractData.document;

      // 2. Chunks
      const fixedRes = await fetch('/api/chunking/conventional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: doc.rawText, chunkSize: 300, chunkOverlap: 60, passages: doc.passages }),
      });
      const fixedData = await fixedRes.json();

      const adaptiveRes = await fetch('/api/chunking/adaptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passages: doc.passages, documentText: doc.rawText }),
      });
      const adaptiveData = await adaptiveRes.json();

      // 3. Query analysis
      const qRes = await fetch('/api/query/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: bCase.query }),
      });
      const qData = await qRes.json();

      // 4. Retrieval run
      const ragRes = await fetch('/api/rag/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: bCase.query,
          queryRepresentation: qData.representation,
          mode,
          weights,
          topK: 4,
          maxContextBudgetChars: 3000,
          semanticChunks: adaptiveData.chunks,
          fixedChunks: fixedData.chunks,
        }),
      });
      const ragData = await ragRes.json();
      const run: RetrievalRun = ragData.run;

      // 5. Grounded answer
      const ansRes = await fetch('/api/rag/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: bCase.query,
          queryRepresentation: qData.representation,
          retrievedEvidence: run.retrievedEvidence,
          mode,
        }),
      });
      const ansData = await ansRes.json();
      const answer: GeneratedAnswer = ansData.answer;

      // Calculate real empirical metrics
      // Precision@K: fraction of retrieved evidence passages that are in expectedRelevantPassages
      const expectedSet = new Set(bCase.expectedRelevantPassages);
      let matchedPassages = 0;
      run.retrievedEvidence.forEach((cand) => {
        if (cand.passageIds.some((pid) => expectedSet.has(pid))) {
          matchedPassages++;
        }
      });
      const precisionAtK = run.retrievedEvidence.length > 0 ? Number((matchedPassages / run.retrievedEvidence.length).toFixed(3)) : 0;
      const recallAtK = expectedSet.size > 0 ? Number((Math.min(matchedPassages, expectedSet.size) / expectedSet.size).toFixed(3)) : 1.0;

      // MRR: reciprocal rank of first expected passage
      let mrr = 0;
      for (let i = 0; i < run.candidates.length; i++) {
        if (run.candidates[i].passageIds.some((pid) => expectedSet.has(pid))) {
          mrr = Number((1 / (i + 1)).toFixed(3));
          break;
        }
      }

      const totalLatency = Date.now() - t0;

      return {
        caseId: bCase.id,
        caseTitle: bCase.title,
        category: bCase.category,
        mode,
        precisionAtK,
        recallAtK,
        mrr,
        queryCoverage: run.coverageScore,
        faithfulness: answer.faithfulnessScore,
        citationSupportRate: answer.citations.length > 0 ? 1.0 : 0.0,
        latencyMs: totalLatency,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.error('Benchmark execution error:', err);
      return null;
    }
  };

  // Mode evaluation runner on user's active document & prompt
  const handleRunModeEvaluation = async (mode: RetrievalMode) => {
    if (!query || !currentDoc) return null;
    try {
      const ragRes = await fetch('/api/rag/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          queryRepresentation,
          mode,
          weights,
          topK,
          maxContextBudgetChars: contextBudget,
          semanticChunks,
          fixedChunks,
        }),
      });
      const ragData = await ragRes.json();
      return ragData.run;
    } catch (err) {
      console.error('Mode evaluation error:', err);
      return null;
    }
  };

  const navItems = [
    { id: 'overview', label: '1. Document & Prompt Analyzer', icon: Layers },
    { id: 'workspace', label: '2. Document Workspace', icon: FileText },
    { id: 'chunks', label: '3. Chunk Explorer', icon: Boxes },
    { id: 'alignment', label: '4. Query Alignment', icon: Network },
    { id: 'trace', label: '5. Retrieval Trace', icon: Sliders },
    { id: 'answer', label: '6. Answer & Citations', icon: ShieldCheck },
    { id: 'evaluation', label: '7. Evaluation Lab', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-900 selection:text-white">
      {/* Top Header */}
      <Header
        currentDoc={currentDoc}
        onOpenFeatureKey={() => setIsFeatureKeyOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConnected={apiConnected}
      />

      {/* Feature Key Modal */}
      <FeatureKeyModal
        isOpen={isFeatureKeyOpen}
        onClose={() => setIsFeatureKeyOpen(false)}
      />

      {/* Main Tab Navigation Bar */}
      <div className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-[61px] z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Error Alert if any */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab
            currentDoc={currentDoc}
            fixedChunks={fixedChunks}
            semanticChunks={semanticChunks}
            lastRun={lastRun}
            query={query}
            generatedAnswer={generatedAnswer}
            retrievedEvidence={retrievedEvidence}
            onSelectTab={setActiveTab}
            onAnalyzePrompt={handleAnalyzePromptFromOverview}
            onUploadDoc={handleUploadFile}
            onPasteText={(txt) => submitRawText('User Document', 'txt', txt)}
            onJumpToPassage={handleJumpToPassage}
            onGenerateAnswer={handleGenerateAnswer}
            isProcessing={isProcessing}
            apiConnected={apiConnected}
          />
        )}

        {activeTab === 'workspace' && (
          <DocumentWorkspaceTab
            currentDoc={currentDoc}
            onDocExtracted={handleDocExtracted}
            highlightedPassageId={highlightedPassageId}
            onSelectPassage={(id) => setHighlightedPassageId(id)}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'chunks' && (
          <ChunkExplorerTab
            fixedChunks={fixedChunks}
            semanticChunks={semanticChunks}
            chunkSize={chunkSize}
            chunkOverlap={chunkOverlap}
            onUpdateFixedParams={handleUpdateFixedParams}
            onRegenerateAdaptive={handleRegenerateAdaptive}
            onJumpToPassage={handleJumpToPassage}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'alignment' && (
          <QueryAlignmentTab
            query={query}
            setQuery={setQuery}
            queryRepresentation={queryRepresentation}
            generatedAnswer={generatedAnswer}
            onJumpToPassage={handleJumpToPassage}
            onAnalyzeQuery={() =>
              runQueryAnalysisAndRetrieval(
                query,
                semanticChunks,
                fixedChunks,
                retrievalMode,
                weights,
                topK,
                contextBudget
              )
            }
            semanticChunks={semanticChunks}
            scoredCandidates={scoredCandidates}
            coverageScore={coverageScore}
            coverageBreakdown={coverageBreakdown}
            onExecuteRetrieval={() =>
              runQueryAnalysisAndRetrieval(
                query,
                semanticChunks,
                fixedChunks,
                retrievalMode,
                weights,
                topK,
                contextBudget
              )
            }
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'trace' && (
          <RetrievalTraceTab
            candidates={scoredCandidates}
            weights={weights}
            onUpdateWeights={(newWeights) => {
              setWeights(newWeights);
              runQueryAnalysisAndRetrieval(
                query,
                semanticChunks,
                fixedChunks,
                retrievalMode,
                newWeights,
                topK,
                contextBudget
              );
            }}
            retrievalMode={retrievalMode}
            onChangeMode={(newMode) => {
              setRetrievalMode(newMode);
              runQueryAnalysisAndRetrieval(
                query,
                semanticChunks,
                fixedChunks,
                newMode,
                weights,
                topK,
                contextBudget
              );
            }}
            topK={topK}
            setTopK={setTopK}
            contextBudget={contextBudget}
            setContextBudget={setContextBudget}
            onRunRerank={() =>
              runQueryAnalysisAndRetrieval(
                query,
                semanticChunks,
                fixedChunks,
                retrievalMode,
                weights,
                topK,
                contextBudget
              )
            }
            isProcessing={isProcessing}
          />
        )}

        {activeTab === 'answer' && (
          <AnswerCitationsTab
            query={query}
            queryRepresentation={queryRepresentation}
            retrievedEvidence={retrievedEvidence}
            generatedAnswer={generatedAnswer}
            onGenerateAnswer={handleGenerateAnswer}
            onJumpToPassage={handleJumpToPassage}
            isProcessing={isProcessing}
            latencyMs={lastRun?.latencyMs.total}
          />
        )}

        {activeTab === 'evaluation' && (
          <EvaluationLabTab
            currentDoc={currentDoc}
            query={query}
            queryRepresentation={queryRepresentation}
            semanticChunks={semanticChunks}
            fixedChunks={fixedChunks}
            weights={weights}
            onRunModeEvaluation={handleRunModeEvaluation}
            onSelectTab={setActiveTab}
            isProcessing={isProcessing}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-xs text-zinc-500 font-mono">
        Adaptive Semantic RAG Lab · Final-Year Engineering Research Project · Gemini 3.8 Flash & Gemini Embedding 2
      </footer>
    </div>
  );
}
