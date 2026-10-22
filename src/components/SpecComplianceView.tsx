/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, FileCheck, ShieldCheck } from 'lucide-react';

export const SpecComplianceView: React.FC = () => {
  const safetyFixes = [
    {
      title: '1. פתרון בעיית ה-0.0 בדגימת CPU של psutil (Two-Pass על אובייקטי Process נשמרים)',
      problem:
        'קריאה ל-psutil.cpu_percent(interval=None) ללא השהיה, או קריאה ל-process_iter() בשתי לולאות נפרדות שיוצרות מופעי Process חדשים, מחזירה 0.0 או ערך שגוי.',
      solution:
        'בקובץ collectors.py: במעבר הראשון אנו שומרים מילון חי tracked_processes[pid] = proc של אובייקטי ה-Process בזיכרון, ממתינים sample_interval=1.0s, ובמעבר השני קוראים ל-proc.cpu_percent(interval=None) על אותם אובייקטים בדיוק. בנוסף, ה-Baseline מבצע ממוצע של 2 דגימות חוסמות (interval=0.6).',
    },
    {
      title: '2. מניעת לולאת Agent אינסופית וקריאות כפולות לאותו כלי (Deduplication Cache + Turn Cap)',
      problem:
        'מודל השפה עלול להיכנס ללולאה אינסופית או לקרוא שוב ושוב לאותו כלי אם הפלט לא סיפק אותו.',
      solution:
        'בקובץ ai_agent.py: הוספנו מילון executed_calls_cache ששומר את חתימת הקריאה (שם הכלי + הפרמטרים). אם המודל מבקש להריץ כלי שכבר הורץ, הלולאה לא מריצה שוב את הבדיקה אלא מחזירה את התוצאה מהמטמון ומכריחה מעבר מיידי לשלב הסיכום (שבו מבוטלים הכלים ומוגדר response_schema בלבד), לצד תקרה קשיחה של MAX_TOOL_TURNS = 3.',
    },
    {
      title: '3. הגנה מפני סגירת תהליכי ליבה קריטיים (svchost.exe, System, explorer.exe, lsass.exe)',
      problem:
        'המלצה למשתמש לסגור תהליכי מערכת קריטיים עלולה לגרום למסך כחול (BSOD) או לאובדן שולחן העבודה.',
      solution:
        'הגנה כפולה (Defense-in-Depth): ראשית, ב-collectors.py מוגדרת רשימת CRITICAL_WINDOWS_PROCESSES שמסננת תהליכי ליבה מרשימת המועמדים לסגירה (ומתייגת safe_to_terminate: False). שנית, ב-ai_agent.py פונקציית sanitize_report_recommendations() סורקת את הדוח הסופי של ה-AI וחוסמת אוטומטית כל שורת המלצה שמכילה פקודת סגירה לתהליך מערכת קריטי.',
    },
  ];

  const auditItems = [
    {
      section: '1 & 2. ארכיטקטורת לקוח מקומי + מנוע החלטות AI',
      requirement: 'תוכנה שרצה על מחשב המשתמש, דוגמת משאבי חומרה ותוכנה ומתקשרת מול מודל שפה הפועל כ-Agent.',
      implementation: 'מומש במלואו בחבילה המודולרית python_desktop_app/ עם הפרדה מלאה בין שכבת האיסוף (collectors.py) למנוע ההחלטות (ai_agent.py).',
    },
    {
      section: '3. טכנולוגיות וספריות ליבה',
      requirement: 'Python 3.10+, psutil, winreg, SDK של מודל השפה, ו-Pydantic לאימות מבני הנתונים.',
      implementation: 'מומש במלואו: שימוש ב-psutil, קריאה בטוחה ב-winreg (KEY_READ), אימות פלט קשיח עם Pydantic (models.py), ושימוש ב-google-genai.',
    },
    {
      section: '4. זרימת עבודה (Agent Workflow - 5 שלבים)',
      requirement: '1. Baseline Trigger -> 2. Triage -> 3. Tool Execution -> 4. Feedback Loop -> 5. Synthesis & Recommendation.',
      implementation: 'מומש במלואו בפונקציה run_diagnostic_workflow() בקובץ ai_agent.py, כולל הגנת Deduplication למניעת לולאות אינסופיות.',
    },
    {
      section: '5. הגדרת כל 5 הכלים (Tools Definition)',
      requirement: 'get_top_cpu_processes, get_top_memory_processes, get_disk_io_status, get_startup_apps, get_background_services.',
      implementation: 'כל 5 הפונקציות מומשו במלואן בקובץ collectors.py ורשומות כ-FunctionDeclarations מול ה-API.',
    },
    {
      section: '6. שלב ד׳: ממשק משתמש וגימור + ניהול הגדרות דסקטופ',
      requirement: 'ממשק CLI מעוצב עם ספריית rich או ממשק גרפי לדסקטופ ב-Tkinter, כולל מקום מסודר לשינוי הגדרות ותצורה.',
      implementation: 'שניהם מומשו במלואם! console_ui.py מציג פלט Rich מחולק ל-3 חלקים, ו-desktop_gui.py מספק חלון דסקטופ ב-Tkinter עם לשונית הגדרות ששומרת לקובץ תצורה מקומי (config.py).',
    },
  ];

  return (
    <div className="space-y-8">
      {/* 3 Critical Engineering Safeguards Section */}
      <section className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-base font-bold text-white">
              3 הגנות הנדסיות קריטיות שהוטמעו בקוד (CPU Sampling, Anti-Loop &amp; OS Safety)
            </h2>
            <p className="text-xs text-slate-400">
              מענה הנדסי מלא לשלושת הסיכונים שציינת ב-psutil, בלולאת ה-Agent ובהמלצות לתהליכי ליבה של Windows.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {safetyFixes.map((fix, idx) => (
            <div key={idx} className="p-5 space-y-2 hover:bg-slate-900/40">
              <h3 className="text-sm font-bold text-sky-300">{fix.title}</h3>
              <p className="text-xs text-slate-400">
                <strong className="text-amber-300">הסיכון הטכני:</strong> {fix.problem}
              </p>
              <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                <strong className="text-emerald-400">הפתרון בקוד שלנו:</strong> {fix.solution}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* MD Specification Compliance Table */}
      <section className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center gap-2.5">
          <FileCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-white">
              מיפוי דרישות ומימושים בחבילת Python
            </h2>
            <p className="text-xs text-slate-400">
              סקירה תיאורית של רכיבים מרכזיים בחבילת <code className="text-sky-300 font-mono">python_desktop_app/</code>; אין לראות בה תחליף להרצת בדיקות על סביבת היעד.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {auditItems.map((item, idx) => (
            <div key={idx} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-900/40">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="text-sm font-bold text-white">{item.section}</h3>
                </div>
                <p className="text-xs text-slate-400 pr-6">
                  <strong className="text-slate-300">דרישה במסמך:</strong> {item.requirement}
                </p>
              </div>
              <div className="md:max-w-md bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 text-xs text-emerald-300 leading-relaxed">
                <strong className="text-white block mb-1">מימוש בפרויקט:</strong>
                {item.implementation}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
