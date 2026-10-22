/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RefreshCw, Terminal } from 'lucide-react';
import { StructuredDiagnosticReport, ToolTraceStep } from '../types/diagnostics';

interface RichConsoleViewProps {
  userIssue: string;
  onUserIssueChange: (val: string) => void;
  onRunAgent: () => void;
  isRunningAi: boolean;
  aiError: string;
  aiToolTrace: ToolTraceStep[];
  structuredReport: StructuredDiagnosticReport;
}

export const RichConsoleView: React.FC<RichConsoleViewProps> = ({
  userIssue,
  onUserIssueChange,
  onRunAgent,
  isRunningAi,
  aiError,
  aiToolTrace,
  structuredReport,
}) => {
  return (
    <section className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-white">
              ניתוח נתוני דוגמה בעזרת AI · דוח בשלושה חלקים
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            המודל מקבל את נתוני ההדגמה המצורפים ומחזיר סיכום מובנה. חבילת Python נפרדת כוללת איסוף מקומי, אך אינה מחוברת לממשק הזה.
          </p>
        </div>

        <button
          onClick={onRunAgent}
          disabled={isRunningAi || !userIssue.trim()}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          {isRunningAi ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>מריץ סוכן AI ומפעיל כלים...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>נתח את נתוני הדוגמה</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="user-issue-input" className="block text-xs font-medium text-slate-300">
          תיאור הבעיה לניתוח נתוני הדוגמה:
        </label>
        <textarea
          id="user-issue-input"
          rows={3}
          maxLength={1000}
          value={userIssue}
          onChange={(e) => onUserIssueChange(e.target.value)}
          className="w-full resize-y bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-400"
        />
        <p className="text-[11px] text-slate-500" aria-live="polite">
          {userIssue.length}/1000 תווים · הטקסט נשלח לשרת כנתון לניתוח, לא כהוראה למודל.
        </p>
        <div className="flex flex-wrap items-center gap-2" aria-label="תרחישי הדגמה מהירים">
          <span className="text-[11px] text-slate-400">תרחישים מהירים:</span>
          {[
            'בדוק מה מעמיס על הזיכרון בדוגמה.',
            'נתח את השימוש במעבד ובדיסק בדוגמה.',
            'הצע צעדים בטוחים על סמך נתוני האתחול והשירותים.',
          ].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onUserIssueChange(example)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-sky-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {aiError && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-200" role="alert">
          שגיאה: {aiError}
        </div>
      )}

      <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden" aria-busy={isRunningAi}>
        <div
          className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400"
          dir="ltr"
        >
          <span>AI analysis · demonstration data</span>
          <span>sample report · not live telemetry</span>
        </div>

        <div className="p-4 sm:p-6 space-y-6 font-mono text-xs sm:text-sm">
          <div className="space-y-1 text-xs border-b border-slate-800/80 pb-4" aria-live="polite">
            {aiToolTrace.length > 0 ? (
              <>
                <div className="text-sky-400 font-semibold">הכלים הבאים עיינו בנתוני הדוגמה:</div>
                {aiToolTrace.map((trace, index) => (
                  <div key={`${trace.toolName}-${index}`} className="pr-4 text-slate-300 break-all" dir="ltr">
                    <span className="text-amber-400">-&gt; {trace.deduplicated ? 'Cached result:' : 'Demo data:'}</span>{' '}
                    <span className="text-white font-semibold">
                      {trace.toolName}({JSON.stringify(trace.args)})
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-slate-400 font-sans">
                עדיין לא הורץ ניתוח. הדוח שמוצג למטה הוא דוגמה להמחשה בלבד.
              </p>
            )}
            {isRunningAi && <p className="text-sky-400 font-sans">מנתח את נתוני הדוגמה...</p>}
          </div>

          <div className="flex items-center gap-4 text-sky-400">
            <div className="h-px bg-sky-500/40 flex-1" />
            <span className="font-bold text-white tracking-wide">
              דוח אבחון מערכת חכם · AI System Diagnostics
            </span>
            <div className="h-px bg-sky-500/40 flex-1" />
          </div>

          {/* 1. אבחון הבעיה */}
          <div className="rounded-lg border border-sky-500/60 bg-slate-900/30 p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sky-400 font-bold text-sm">1. אבחון הבעיה</span>
              <span
                className={`text-xs font-bold ${
                  structuredReport.severity.includes('גבוה') ||
                  structuredReport.severity.includes('קריטי')
                    ? 'text-red-400'
                    : structuredReport.severity.includes('בינוני')
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                רמת חומרה: {structuredReport.severity}
              </span>
            </div>
            <p className="text-slate-100 leading-relaxed font-sans text-sm">
              {structuredReport.problem_diagnosis}
            </p>
          </div>

          {/* 2. הגורמים המרכזיים */}
          <div className="space-y-2">
            <div className="text-amber-400 font-bold text-sm">
              2. הגורמים המרכזיים שזוהו במערכת
            </div>
            <div className="rounded-lg border border-amber-500/60 overflow-hidden bg-slate-900/20">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/40 bg-amber-950/20 text-amber-300 text-xs">
                    <th className="py-2.5 px-4 font-bold border-l border-amber-500/30">
                      רכיב / תהליך
                    </th>
                    <th className="py-2.5 px-4 font-bold border-l border-amber-500/30 text-left">
                      נתון שנמדד
                    </th>
                    <th className="py-2.5 px-4 font-bold">השפעה על המערכת</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/30 text-xs">
                  {structuredReport.main_causes.map((cause, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td
                        className="py-3 px-4 font-mono font-semibold text-sky-300 border-l border-amber-500/30 whitespace-nowrap"
                        dir="ltr"
                      >
                        {cause.component_or_process}
                      </td>
                      <td
                        className="py-3 px-4 font-mono font-semibold text-fuchsia-300 border-l border-amber-500/30 text-left whitespace-nowrap"
                        dir="ltr"
                      >
                        {cause.metric_or_evidence}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-200 leading-relaxed">
                        {cause.impact_explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. המלצות לפעולה */}
          <div className="rounded-lg border border-emerald-500/60 bg-slate-900/30 p-5 space-y-3">
            <div className="text-emerald-400 font-bold text-sm">3. המלצות לפעולה</div>
            <ol className="space-y-2.5 font-sans text-sm text-slate-100 leading-relaxed">
              {structuredReport.action_recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-emerald-400 shrink-0">
                    {idx + 1}.
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};
