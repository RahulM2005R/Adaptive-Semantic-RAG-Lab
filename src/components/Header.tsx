import React from 'react';
import {
  Layers,
  BookOpen,
  HelpCircle,
  Cpu,
} from 'lucide-react';
import { DocumentSource } from '../types/rag.ts';

interface HeaderProps {
  currentDoc: DocumentSource | null;
  onOpenFeatureKey: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentDoc,
  onOpenFeatureKey,
  activeTab,
  setActiveTab,
  apiConnected,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding & Research Context */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-purple-950/50">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-zinc-100 tracking-tight text-base sm:text-lg">
                Adaptive Semantic RAG Lab
              </h1>
              <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded border border-purple-500/30 bg-purple-950/40 text-purple-300">
                PROPOSITION CHUNKING
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              User Document Analyzer & Query Concept Alignment
            </p>
          </div>
        </div>

        {/* Center / Right: Active Doc & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {currentDoc ? (
            <div className="flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md text-zinc-300">
              <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate max-w-[180px] font-medium text-zinc-200">
                {currentDoc.name}
              </span>
              <span className="text-zinc-500 font-mono text-[11px]">
                ({currentDoc.passages.length} passages)
              </span>
            </div>
          ) : (
            <div className="text-xs bg-amber-950/30 border border-amber-800/40 text-amber-300 px-3 py-1.5 rounded-md">
              No Document Ingested
            </div>
          )}

          {/* Model Status */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border ${
              apiConnected
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
            title="Gemini 3.8 Flash & Gemini Embedding 2 active"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">Gemini 3.8 Flash</span>
          </div>

          {/* Feature Key Modal Trigger */}
          <button
            onClick={onOpenFeatureKey}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition cursor-pointer"
            title="Open Feature Key & Visual Language Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Feature Key</span>
          </button>
        </div>
      </div>
    </header>
  );
};
