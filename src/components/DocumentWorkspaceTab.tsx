import React, { useState } from 'react';
import {
  Upload,
  FileText,
  FileCode,
  Search,
  Hash,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DocumentSource, DocumentPassage } from '../types/rag.ts';

interface DocumentWorkspaceTabProps {
  currentDoc: DocumentSource | null;
  onDocExtracted: (doc: DocumentSource) => void;
  highlightedPassageId?: string | null;
  onSelectPassage?: (passageId: string) => void;
  isProcessing: boolean;
}

export const DocumentWorkspaceTab: React.FC<DocumentWorkspaceTabProps> = ({
  currentDoc,
  onDocExtracted,
  highlightedPassageId,
  onSelectPassage,
  isProcessing,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    const validExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(ext)) {
      setUploadError(`Unsupported file format "${ext}". Supported formats: PDF, DOCX, TXT, MD.`);
      return;
    }

    try {
      const reader = new FileReader();
      if (ext === '.txt' || ext === '.md') {
        reader.onload = async (e) => {
          const text = e.target?.result as string;
          await submitTextForExtraction(file.name, ext.replace('.', ''), text);
        };
        reader.readAsText(file);
      } else {
        // PDF or DOCX - read as Base64
        reader.onload = async (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(',')[1];
          await submitBase64ForExtraction(file.name, ext.replace('.', ''), base64);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      setUploadError(err.message || 'File read error');
    }
  };

  const submitTextForExtraction = async (name: string, fileType: string, rawText: string) => {
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: name,
          fileType,
          rawTextContent: rawText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract text');
      onDocExtracted(data.document);
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const submitBase64ForExtraction = async (name: string, fileType: string, base64: string) => {
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: name,
          fileType,
          contentBase64: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract document');
      onDocExtracted(data.document);
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    submitTextForExtraction('Pasted Research Text', 'txt', pastedText);
    setShowPasteModal(false);
    setPastedText('');
  };

  const handleCopyPassage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPassages = (currentDoc?.passages || []).filter(p =>
    !searchTerm
      ? true
      : p.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.heading && p.heading.toLowerCase().includes(searchTerm.toLowerCase())) ||
        highlightedPassageId === p.id
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Upload & Direct Paste Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Dropzone */}
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center min-h-[190px] ${
              dragOver
                ? 'border-purple-500 bg-purple-950/20'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
            }`}
          >
            <Upload className="w-8 h-8 text-purple-400 mb-2" />
            <div className="text-sm font-medium text-zinc-200">
              Upload Document File
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Supports PDF, DOCX, TXT, or MD documents
            </p>

            <div className="mt-4">
              <label className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium cursor-pointer transition shadow-md shadow-purple-950/40">
                Browse Files
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                />
              </label>
            </div>
          </div>

          {uploadError && (
            <div className="mt-3 p-3 rounded-lg border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Direct Text Paste Area */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col justify-between space-y-3">
          <div>
            <div className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-1">
              Or Paste Text Directly
            </div>
            <p className="text-xs text-zinc-500 mb-2">
              Paste custom paragraphs, technical notes, or text passages.
            </p>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste text passage here (e.g. The apple is red. It contains fibre and vitamin C.)..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || isProcessing}
              className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition cursor-pointer"
            >
              {isProcessing ? 'Processing...' : 'Analyze & Chunk Text'}
            </button>
          </div>
        </div>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Paste Research Document Text</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter markdown or raw text with paragraphs and optional section headers (#).
            </p>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste text here..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-3.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                className="px-4 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
              >
                Process & Extract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Document Structure & Passages */}
      {currentDoc ? (
        <div className="space-y-4">
          {/* Metadata Bar */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span>{currentDoc.name}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {currentDoc.fileType}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 flex items-center gap-3 mt-0.5 font-mono">
                  <span>{currentDoc.metadata.totalChars.toLocaleString()} characters</span>
                  <span>·</span>
                  <span>{currentDoc.metadata.totalWords.toLocaleString()} words</span>
                  <span>·</span>
                  <span>~{currentDoc.metadata.approxTokens.toLocaleString()} tokens</span>
                  <span>·</span>
                  <span>{currentDoc.pages.length} page(s)</span>
                  <span>·</span>
                  <span>{currentDoc.passages.length} passages</span>
                </div>
              </div>
            </div>

            {/* Passage Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search extracted passages..."
                className="w-full pl-9 pr-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Passages Grid / List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span>Structured Passage Tree ({filteredPassages.length} passages)</span>
              <span className="text-zinc-500 font-mono text-[11px]">
                Click passage to inspect · IDs mapped to citations
              </span>
            </div>

            <div className="space-y-3">
              {filteredPassages.map((p) => {
                const isHighlighted = highlightedPassageId === p.id;
                return (
                  <div
                    key={p.id}
                    id={`passage-${p.id}`}
                    onClick={() => onSelectPassage?.(p.id)}
                    className={`p-4 rounded-xl border transition cursor-pointer relative ${
                      isHighlighted
                        ? 'border-purple-500 bg-purple-950/40 ring-2 ring-purple-500 shadow-xl shadow-purple-950/50'
                        : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-purple-300 font-semibold">
                          {p.id}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          Page {p.pageNumber} · Paragraph {p.paragraphIndex}
                        </span>
                        {p.heading && (
                          <span className="text-xs font-semibold text-blue-300 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-500/30">
                            {p.heading}
                          </span>
                        )}
                        {isHighlighted && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-600 text-white font-medium shadow-md shadow-purple-950 animate-pulse flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Highlighted From Chunk Explorer</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPassage(p.id, p.text);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                          title="Copy passage text"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {p.text}
                    </p>

                    <div className="mt-2 text-[10px] text-zinc-500 font-mono flex items-center gap-3">
                      <span>Offsets: [{p.charStart}..{p.charEnd}]</span>
                      <span>{p.text.length} chars</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center border border-zinc-800/80 rounded-xl bg-zinc-900/30">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-zinc-300">No Document Loaded</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Upload a PDF, DOCX, TXT, or MD document above, or paste raw text to analyze and generate adaptive semantic chunks.
          </p>
        </div>
      )}
    </div>
  );
};
