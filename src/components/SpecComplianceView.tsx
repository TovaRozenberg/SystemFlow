/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, FileCheck } from 'lucide-react';

export const SpecComplianceView: React.FC = () => {
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
      implementation: 'מומש במלואו בפונקציה run_diagnostic_workflow() בקובץ ai_agent.py, כולל לולאת רב-שיח שמריצה מספר כלים ברצף לפי החלטת ה-AI.',
    },
    {
      section: '5. הגדרת כל 5 הכלים (Tools Definition)',
      requirement: 'get_top_cpu_processes, get_top_memory_processes, get_disk_io_status, get_startup_apps, get_background_services.',
      implementation: 'כל 5 הפונקציות מומשו במלואן בקובץ collectors.py ורשומות כ-FunctionDeclarations מול ה-API (כולל Disk I/O ו-Background Services שנוספו כעת).',
    },
    {
      section: '6. שלב ד׳: ממשק משתמש וגימור + ניהול הגדרות דסקטופ',
      requirement: 'ממשק CLI מעוצב עם ספריית rich או ממשק גרפי לדסקטופ ב-Tkinter, כולל מקום מסודר לשינוי הגדרות ותצורה.',
      implementation: 'שניהם מומשו במלואם! console_ui.py מציג פלט Rich מחולק ל-3 חלקים, ו-desktop_gui.py מספק חלון דסקטופ ב-Tkinter עם לשונית הגדרות ששומרת לקובץ תצורה מקומי (config.py).',
    },
  ];

  return (
    <section className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center gap-2.5">
        <FileCheck className="w-5 h-5 text-emerald-400" />
        <div>
          <h2 className="text-base font-bold text-white">
            בדיקת התאמה מלאה למסמך האפיון והארכיטקטורה (MD Compliance Audit)
          </h2>
          <p className="text-xs text-slate-400">
            כל סעיפי מסמך האפיון שלך ממומשים ב-100% בתוך הקוד המודולרי בתיקיית <code className="text-sky-300 font-mono">python_desktop_app/</code>.
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
  );
};
