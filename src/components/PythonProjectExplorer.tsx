/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileCode, Copy, Check, Download, FolderTree } from 'lucide-react';
import { PythonModuleId } from '../types/diagnostics';
import { PythonModuleFile } from '../data/pythonProjectFiles';

interface PythonProjectExplorerProps {
  modules: PythonModuleFile[];
}

export const PythonProjectExplorer: React.FC<PythonProjectExplorerProps> = ({ modules }) => {
  const [selectedId, setSelectedId] = useState<PythonModuleId>('collectors.py');
  const [copied, setCopied] = useState<boolean>(false);

  const activeModule = modules.find((m) => m.id === selectedId) || modules[0];

  const handleCopyFile = async () => {
    await navigator.clipboard.writeText(activeModule.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (mod: PythonModuleFile) => {
    const blob = new Blob([mod.code], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = mod.id;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">
              ארכיטקטורת קבצים מודולרית לדסקטופ · תיקיית python_desktop_app/
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            הקוד פוצל ל-7 מודולים נקיים וקצרים לפי תחומי אחריות (הגדרות, מודלים, איסוף נתונים, סוכן AI, ממשק קונסול וממשק דסקטופ גרפי).
          </p>
        </div>

        <button
          onClick={() => handleDownloadFile(activeModule)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>הורד את {activeModule.id}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Sidebar File Tree (4 columns) */}
        <div className="lg:col-span-4 border-l border-slate-800 bg-slate-950/50 p-4 space-y-2">
          <div className="text-xs font-mono text-slate-400 px-2 pb-2 border-b border-slate-800/80" dir="ltr">
            python_desktop_app/ (7 files)
          </div>
          {modules.map((mod) => {
            const isSelected = mod.id === activeModule.id;
            return (
              <button
                key={mod.id}
                onClick={() => setSelectedId(mod.id)}
                className={`w-full text-right p-3 rounded-lg border transition-colors cursor-pointer flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-slate-800/90 border-sky-500/50 text-white'
                    : 'bg-slate-900/40 border-slate-800/70 text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{mod.titleHe}</span>
                  <span className="text-xs font-mono text-sky-400 shrink-0" dir="ltr">
                    {mod.id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{mod.descriptionHe}</p>
                <div className="text-[11px] text-amber-300/90 font-mono pt-0.5">
                  {mod.specSection}
                </div>
              </button>
            );
          })}
        </div>

        {/* Code Viewer (8 columns) */}
        <div className="lg:col-span-8 flex flex-col bg-slate-950/80">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2" dir="ltr">
              <FileCode className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-semibold text-slate-200">
                {activeModule.filename}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyFile}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>הועתק ללוח</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>העתק מודול ({activeModule.id})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-5 overflow-x-auto flex-1 max-h-[640px]" dir="ltr">
            <pre className="text-xs sm:text-[13px] leading-relaxed font-mono text-slate-200 select-all">
              <code>{activeModule.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};
