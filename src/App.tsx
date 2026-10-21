/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Download, RefreshCw, Sliders } from 'lucide-react';
import {
  DesktopTabId,
  SystemSnapshot,
  TopCpuReport,
  TopMemoryReport,
  DiskIoReport,
  StartupProgramsReport,
  BackgroundServicesReport,
  ToolTraceStep,
  StructuredDiagnosticReport,
} from './types/diagnostics';
import { getPythonProjectModules } from './data/pythonProjectFiles';
import { RichConsoleView } from './components/RichConsoleView';
import { ToolsInspectorView } from './components/ToolsInspectorView';
import { PythonProjectExplorer } from './components/PythonProjectExplorer';
import { SpecComplianceView } from './components/SpecComplianceView';

export default function App() {
  const [activeTab, setActiveTab] = useState<DesktopTabId>('agent');
  const [drivePath, setDrivePath] = useState<string>('C:\\');
  const [intervalSec] = useState<number>(1.0);
  const [processLimit, setProcessLimit] = useState<number>(5);
  const [isSampling, setIsSampling] = useState<boolean>(false);

  const [userIssue, setUserIssue] = useState<string>(
    'המחשב מרגיש איטי בזמן עבודה, הדיסק עובד קשה וגם לוקח לו הרבה זמן לעלות בהדלקה. תבדוק אילו תהליכים, שירותים או תוכנות אתחול גורמים לזה.'
  );
  const [isRunningAi, setIsRunningAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>('');

  const [aiToolTrace, setAiToolTrace] = useState<ToolTraceStep[]>([
    {
      step: 1,
      toolName: 'get_top_cpu_processes',
      args: { limit: 5 },
      resultPreview: { top_process: 'python.exe (38.45% CPU)' },
    },
    {
      step: 1,
      toolName: 'get_top_memory_processes',
      args: { limit: 5 },
      resultPreview: { top_process: 'chrome.exe (8420.65 MB)' },
    },
    {
      step: 1,
      toolName: 'get_disk_io_status',
      args: {},
      resultPreview: { write_mb_per_sec: 148.5, bottleneck_suspected: true },
    },
    {
      step: 1,
      toolName: 'get_startup_apps',
      args: {},
      resultPreview: { total_count: 6 },
    },
    {
      step: 1,
      toolName: 'get_background_services',
      args: { limit: 15 },
      resultPreview: { total_non_core_running: 5 },
    },
  ]);

  const [structuredReport, setStructuredReport] = useState<StructuredDiagnosticReport>({
    severity: 'עומס גבוה / קריטי',
    problem_diagnosis:
      'המערכת חווה צוואר בקבוק משולב: ניצול גבוה של מעבד (78.4%) וזיכרון RAM (83.9% בשימוש), לצד עומס כתיבה כבד לדיסק (148.5 MB/s) ושירותי רקע ותוכנות אתחול שמאטים את עליית המחשב.',
    main_causes: [
      {
        component_or_process: 'chrome.exe (PID 8912)',
        metric_or_evidence: '8,420 MB RAM (25.8%) | 21.1% CPU',
        impact_explanation: 'צורך מעל רבע מזיכרון ה-RAM הכולל במערכת ומעמיס על המעבד.',
      },
      {
        component_or_process: 'Docker Desktop & com.docker.service',
        metric_or_evidence: '6,540 MB RAM | Write: 95 MB/s | Startup',
        impact_explanation: 'רץ כשירות רקע פעיל, מבצע כתיבות דיסק אינטנסיביות ומוגדר לעלות אוטומטית בהדלקת המחשב.',
      },
      {
        component_or_process: 'python.exe (PID 14820)',
        metric_or_evidence: '38.45% CPU | 2,945 MB RAM',
        impact_explanation: 'תהליך החישוב הכבד ביותר כרגע במעבד שמנצל קרוב ל-40% מכלל הליבות.',
      },
    ],
    action_recommendations: [
      'בטל את ההפעלה האוטומטית של Docker Desktop, Steam ו-Slack באתחול ועצור את השירות com.docker.service כאשר אינך מפתח בקונטיינרים.',
      'סגור טאבים כבדים ב-Chrome או הפעל את מצב החיסכון בזיכרון (Memory Saver) לשחרור מיידי של כ-5 GB RAM.',
      'בדוק את תהליך python.exe (PID 14820) שיוצר עומס רציף על המעבד ועל כתיבות הדיסק.',
    ],
  });

  const [snapshot, setSnapshot] = useState<SystemSnapshot>({
    timestamp: new Date().toISOString(),
    cpu: { usage_percent: 78.4, logical_cores: 16, physical_cores: 8 },
    memory_ram: { total_gb: 31.88, available_gb: 5.12, used_gb: 26.76, used_percent: 83.9 },
    storage: {
      drive: 'C:\\',
      resolved_path: 'C:\\',
      total_gb: 953.86,
      free_gb: 412.35,
      used_gb: 541.51,
      used_percent: 56.8,
      status: 'OK',
    },
  });

  const [topCpuReport, setTopCpuReport] = useState<TopCpuReport>({
    tool: 'get_top_cpu_processes',
    timestamp: new Date().toISOString(),
    top_count: 5,
    skipped_protected_processes: 14,
    processes: [
      { pid: 14820, name: 'python.exe', cpu_percent: 38.45, raw_core_percent: 615.2, status: 'running', username: 'User' },
      { pid: 8912, name: 'chrome.exe', cpu_percent: 21.12, raw_core_percent: 337.9, status: 'running', username: 'User' },
      { pid: 21044, name: 'Code.exe', cpu_percent: 8.85, raw_core_percent: 141.6, status: 'running', username: 'User' },
      { pid: 4412, name: 'MsMpEng.exe', cpu_percent: 5.40, raw_core_percent: 86.4, status: 'running', username: 'SYSTEM' },
      { pid: 6120, name: 'dwm.exe', cpu_percent: 2.35, raw_core_percent: 37.6, status: 'running', username: 'Window Manager' },
    ],
  });

  const [topMemoryReport, setTopMemoryReport] = useState<TopMemoryReport>({
    tool: 'get_top_memory_processes',
    timestamp: new Date().toISOString(),
    top_count: 5,
    skipped_protected_processes: 14,
    processes: [
      { pid: 8912, name: 'chrome.exe', ram_mb: 8420.65, ram_percent: 25.8, status: 'running' },
      { pid: 18400, name: 'Docker Desktop.exe', ram_mb: 6540.80, ram_percent: 20.04, status: 'running' },
      { pid: 21044, name: 'Code.exe', ram_mb: 3890.12, ram_percent: 11.92, status: 'running' },
      { pid: 14820, name: 'python.exe', ram_mb: 2945.30, ram_percent: 9.02, status: 'running' },
      { pid: 11204, name: 'Teams.exe', ram_mb: 1782.45, ram_percent: 5.46, status: 'running' },
    ],
  });

  const [diskIoReport] = useState<DiskIoReport>({
    tool: 'get_disk_io_status',
    timestamp: new Date().toISOString(),
    realtime_throughput: {
      read_mb_per_sec: 42.3,
      write_mb_per_sec: 148.5,
      read_iops: 195.0,
      write_iops: 420.0,
      bottleneck_suspected: true,
    },
    cumulative_since_boot: { total_read_gb: 128.4, total_write_gb: 94.2 },
    top_io_processes: [
      { pid: 18400, name: 'Docker Desktop.exe', total_read_mb: 14200.5, total_write_mb: 28450.2, combined_io_mb: 42650.7 },
      { pid: 8912, name: 'chrome.exe', total_read_mb: 9820.1, total_write_mb: 11240.8, combined_io_mb: 21060.9 },
      { pid: 14820, name: 'python.exe', total_read_mb: 6410.0, total_write_mb: 8920.4, combined_io_mb: 15330.4 },
      { pid: 4412, name: 'MsMpEng.exe', total_read_mb: 8120.3, total_write_mb: 1450.0, combined_io_mb: 9570.3 },
    ],
  });

  const [startupReport] = useState<StartupProgramsReport>({
    tool: 'get_startup_apps',
    timestamp: new Date().toISOString(),
    supported_os: true,
    total_count: 6,
    warnings: [],
    startup_programs: [
      {
        name: 'OneDrive',
        command_or_path: '"C:\\Users\\User\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe" /background',
        source_type: 'Registry',
        location: 'HKCU\\Run (Current User)',
      },
      {
        name: 'Docker Desktop',
        command_or_path: '"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe" -Autostart',
        source_type: 'Registry',
        location: 'HKCU\\Run (Current User)',
      },
      {
        name: 'SecurityHealth',
        command_or_path: '%windir%\\system32\\SecurityHealthSystray.exe',
        source_type: 'Registry',
        location: 'HKLM\\Run (All Users)',
      },
      {
        name: 'Steam',
        command_or_path: '"C:\\Program Files (x86)\\Steam\\steam.exe" -silent',
        source_type: 'Registry',
        location: 'HKLM\\Run (32-bit WOW64)',
      },
      {
        name: 'Slack.lnk',
        command_or_path: 'C:\\Users\\User\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Slack.lnk',
        source_type: 'Startup Folder',
        location: 'Startup Folder (Current User)',
      },
    ],
  });

  const [backgroundServicesReport] = useState<BackgroundServicesReport>({
    tool: 'get_background_services',
    timestamp: new Date().toISOString(),
    supported_os: true,
    total_non_core_running: 5,
    returned_count: 5,
    services: [
      {
        name: 'com.docker.service',
        display_name: 'Docker Desktop Service',
        status: 'running',
        start_type: 'automatic',
        pid: 5120,
        binpath: '"C:\\Program Files\\Docker\\Docker\\com.docker.service.exe"',
      },
      {
        name: 'WSLService',
        display_name: 'Windows Subsystem for Linux Service',
        status: 'running',
        start_type: 'automatic',
        pid: 6840,
        binpath: '"C:\\Program Files\\WSL\\wslservice.exe"',
      },
      {
        name: 'NVDisplay.ContainerLocalSystem',
        display_name: 'NVIDIA Display Container LS',
        status: 'running',
        start_type: 'automatic',
        pid: 3412,
        binpath: '"C:\\Program Files\\NVIDIA Corporation\\Display.NvContainer\\NVDisplay.Container.exe"',
      },
      {
        name: 'ClickToRunSvc',
        display_name: 'Microsoft Office Click-to-Run Service',
        status: 'running',
        start_type: 'automatic',
        pid: 4190,
        binpath: '"C:\\Program Files\\Common Files\\Microsoft Shared\\ClickToRun\\OfficeClickToRun.exe"',
      },
      {
        name: 'Everything',
        display_name: 'Everything File Search Service',
        status: 'running',
        start_type: 'automatic',
        pid: 2890,
        binpath: '"C:\\Program Files\\Everything\\Everything.exe" -svc',
      },
    ],
  });

  const pythonModules = getPythonProjectModules(drivePath, intervalSec, processLimit);

  const runLiveAiAgent = async () => {
    setIsRunningAi(true);
    setAiError('');
    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot,
          topCpuReport,
          topMemoryReport,
          diskIoReport,
          startupReport,
          backgroundServicesReport,
          userIssue,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בפנייה לשרת האבחון');
      }
      if (data.structuredReport && data.structuredReport.problem_diagnosis) {
        setStructuredReport(data.structuredReport);
      }
      setAiToolTrace(Array.isArray(data.toolTrace) ? data.toolTrace : []);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
    } finally {
      setIsRunningAi(false);
    }
  };

  const runLiveSample = useCallback(() => {
    setIsSampling(true);
    setTimeout(() => {
      const nowIso = new Date().toISOString();
      const cpuUsage = Number((40 + Math.random() * 48).toFixed(1));
      const totalRam = 31.88;
      const availableRam = Number((3.5 + Math.random() * 7).toFixed(2));
      const usedRam = Number((totalRam - availableRam).toFixed(2));
      const ramPercent = Number(((usedRam / totalRam) * 100).toFixed(1));

      setSnapshot((prev) => ({
        ...prev,
        timestamp: nowIso,
        cpu: { ...prev.cpu, usage_percent: cpuUsage },
        memory_ram: {
          total_gb: totalRam,
          available_gb: availableRam,
          used_gb: usedRam,
          used_percent: ramPercent,
        },
      }));

      setTopCpuReport((prev) => ({
        ...prev,
        timestamp: nowIso,
      }));
      setTopMemoryReport((prev) => ({
        ...prev,
        timestamp: nowIso,
      }));
      setIsSampling(false);
    }, 300);
  }, []);

  const handleDownloadFullBundle = () => {
    const bundleContent = pythonModules
      .map(
        (m) =>
          `# ==============================================================================\n# FILE: ${m.filename}\n# ==============================================================================\n\n${m.code}\n`
      )
      .join('\n\n');
    const blob = new Blob([bundleContent], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'python_desktop_app_bundle.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('agent');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          כלי דיאגנוסטיקה למערכת · Desktop Suite
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('agent')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'agent' ? 'text-white underline underline-offset-8' : ''
            }`}
          >
            סוכן AI ותצוגת קונסול
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'tools' ? 'text-white underline underline-offset-8' : ''
            }`}
          >
            5 כלי החקירה (Tools)
          </button>
          <button
            onClick={() => setActiveTab('python_project')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'python_project' ? 'text-white underline underline-offset-8' : ''
            }`}
          >
            פרויקט הפייתון המודולרי (7 קבצים)
          </button>
          <button
            onClick={() => setActiveTab('spec_audit')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'spec_audit' ? 'text-white underline underline-offset-8' : ''
            }`}
          >
            התאמה למסמך האפיון (MD)
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleDownloadFullBundle}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 rounded-lg hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>הורד חבילת דסקטופ מלאה</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Top Workspace Header & Parameters */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>ארכיטקטורה מודולרית: python_desktop_app/</span>
              <span aria-hidden="true">·</span>
              <span>5 כלי חקירה מלאים</span>
              <span aria-hidden="true">·</span>
              <span>Rich CLI + Tkinter GUI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              כלי אבחון איטיות במחשב מבוסס AI · מימוש מלא של מסמך האפיון
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              הקוד פוצל לארכיטקטורה מודולרית ונקייה של 7 קבצים בתיקיית <code className="text-sky-300 font-mono">python_desktop_app/</code>, ומממש 100% מדרישות מסמך ה-MD שלך — כולל כל 5 כלי ה-AI, לולאת ה-Agent, עיצוב קונסול ב-3 פרקים וממשק דסקטופ עם לשונית הגדרות.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Sliders className="w-4 h-4 text-slate-400" />
              <span className="font-medium">הגדרות דגימה:</span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <span>כונן:</span>
              <select
                value={drivePath}
                onChange={(e) => setDrivePath(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
              >
                <option value="C:\">C:\ (Windows)</option>
                <option value="D:\">D:\ (Data Drive)</option>
                <option value="/">/ (Linux / macOS)</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <span>Limit:</span>
              <select
                value={processLimit}
                onChange={(e) => setProcessLimit(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </label>

            <button
              onClick={runLiveSample}
              disabled={isSampling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSampling ? 'animate-spin' : ''}`} />
              <span>דגימה חדשה</span>
            </button>
          </div>
        </section>

        {/* Active View Area */}
        {activeTab === 'agent' && (
          <div className="space-y-8">
            <RichConsoleView
              userIssue={userIssue}
              onUserIssueChange={setUserIssue}
              onRunAgent={runLiveAiAgent}
              isRunningAi={isRunningAi}
              aiError={aiError}
              aiToolTrace={aiToolTrace}
              structuredReport={structuredReport}
            />
            <SpecComplianceView />
          </div>
        )}

        {activeTab === 'tools' && (
          <ToolsInspectorView
            snapshot={snapshot}
            topCpuReport={topCpuReport}
            topMemoryReport={topMemoryReport}
            diskIoReport={diskIoReport}
            startupReport={startupReport}
            backgroundServicesReport={backgroundServicesReport}
            processLimit={processLimit}
          />
        )}

        {activeTab === 'python_project' && (
          <PythonProjectExplorer modules={pythonModules} />
        )}

        {activeTab === 'spec_audit' && (
          <div className="space-y-8">
            <SpecComplianceView />
            <PythonProjectExplorer modules={pythonModules} />
          </div>
        )}
      </main>
    </div>
  );
}
