/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Cpu, MemoryStick, HardDrive, Power, Layers, Activity } from 'lucide-react';
import {
  SystemSnapshot,
  TopCpuReport,
  TopMemoryReport,
  DiskIoReport,
  StartupProgramsReport,
  BackgroundServicesReport,
} from '../types/diagnostics';

interface ToolsInspectorViewProps {
  snapshot: SystemSnapshot;
  topCpuReport: TopCpuReport;
  topMemoryReport: TopMemoryReport;
  diskIoReport: DiskIoReport;
  startupReport: StartupProgramsReport;
  backgroundServicesReport: BackgroundServicesReport;
  processLimit: number;
}

export const ToolsInspectorView: React.FC<ToolsInspectorViewProps> = ({
  snapshot,
  topCpuReport,
  topMemoryReport,
  diskIoReport,
  startupReport,
  backgroundServicesReport,
  processLimit,
}) => {
  const [startupFilter, setStartupFilter] = useState<'all' | 'Registry' | 'Startup Folder'>('all');

  const filteredStartup = startupReport.startup_programs.filter((item) =>
    startupFilter === 'all' ? true : item.source_type === startupFilter
  );

  return (
    <div className="space-y-8">
      {/* Baseline Trigger Summary Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">שימוש כללי במעבד (CPU)</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-white">
                {snapshot.cpu.usage_percent.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {snapshot.cpu.logical_cores} ליבות לוגיות · {snapshot.cpu.physical_cores} פיזיות
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-transform duration-200 origin-right"
                style={{ width: `${Math.min(snapshot.cpu.usage_percent, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono" dir="ltr">
            Baseline · get_system_snapshot()
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">זיכרון עבודה (RAM)</span>
            <MemoryStick className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-white">
                {snapshot.memory_ram.available_gb} GB
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                פנוי מתוך {snapshot.memory_ram.total_gb} GB ({snapshot.memory_ram.used_percent}% בשימוש)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-transform duration-200 origin-right"
                style={{ width: `${Math.min(snapshot.memory_ram.used_percent, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono" dir="ltr">
            Baseline · memory_ram.available_gb
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200">
              אחסון כונן מערכת ({snapshot.storage.drive})
            </span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-white">
                {snapshot.storage.free_gb} GB
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                פנוי מתוך {snapshot.storage.total_gb} GB ({snapshot.storage.used_percent}% בשימוש)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-transform duration-200 origin-right"
                style={{ width: `${Math.min(snapshot.storage.used_percent, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono" dir="ltr">
            Baseline · storage.free_gb
          </div>
        </div>
      </section>

      {/* Tool 1 & Tool 2: CPU & Memory Processes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                כלי 1: התהליכים העמוסים ביותר במעבד
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                get_top_cpu_processes(limit={processLimit})
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              דולגו {topCpuReport.skipped_protected_processes} מוגנים
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-900/40">
                  <th className="py-2.5 px-4 font-medium">שם תהליך</th>
                  <th className="py-2.5 px-4 font-medium text-left">PID</th>
                  <th className="py-2.5 px-4 font-medium">משתמש</th>
                  <th className="py-2.5 px-4 font-medium text-left">צריכת CPU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {topCpuReport.processes.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-slate-800/40 transition-colors h-10">
                    <td className="py-2 px-4 font-mono font-semibold text-slate-100" dir="ltr">
                      {proc.name}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-400 text-left" dir="ltr">
                      {proc.pid}
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-400" dir="ltr">
                      {proc.username}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums font-semibold text-sky-400 text-left" dir="ltr">
                      {proc.cpu_percent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                כלי 2: צרכני הזיכרון הכבדים ביותר (RAM)
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                get_top_memory_processes(limit={processLimit})
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              דולגו {topMemoryReport.skipped_protected_processes} מוגנים
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-900/40">
                  <th className="py-2.5 px-4 font-medium">שם תהליך</th>
                  <th className="py-2.5 px-4 font-medium text-left">PID</th>
                  <th className="py-2.5 px-4 font-medium text-left">נפח ב-RAM (MB)</th>
                  <th className="py-2.5 px-4 font-medium text-left">אחוז מהזיכרון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {topMemoryReport.processes.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-slate-800/40 transition-colors h-10">
                    <td className="py-2 px-4 font-mono font-semibold text-slate-100" dir="ltr">
                      {proc.name}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-400 text-left" dir="ltr">
                      {proc.pid}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums font-semibold text-emerald-400 text-left" dir="ltr">
                      {proc.ram_mb.toFixed(2)} MB
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-300 text-left" dir="ltr">
                      {proc.ram_percent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tool 3 & Tool 5: Disk I/O Status & Background Services */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool 3: get_disk_io_status */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-sky-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  כלי 3: קריאה/כתיבה וצווארי בקבוק בדיסק (Disk I/O)
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                  get_disk_io_status() · Read: {diskIoReport.realtime_throughput.read_mb_per_sec} MB/s · Write: {diskIoReport.realtime_throughput.write_mb_per_sec} MB/s
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-300">
              {diskIoReport.realtime_throughput.read_iops + diskIoReport.realtime_throughput.write_iops} IOPS
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-900/40">
                  <th className="py-2.5 px-4 font-medium">תהליך</th>
                  <th className="py-2.5 px-4 font-medium text-left">PID</th>
                  <th className="py-2.5 px-4 font-medium text-left">קריאה מצטברת</th>
                  <th className="py-2.5 px-4 font-medium text-left">כתיבה מצטברת</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {diskIoReport.top_io_processes.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-slate-800/40 transition-colors h-10">
                    <td className="py-2 px-4 font-mono font-semibold text-slate-100" dir="ltr">
                      {proc.name}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-400 text-left" dir="ltr">
                      {proc.pid}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-sky-300 text-left" dir="ltr">
                      {proc.total_read_mb.toFixed(1)} MB
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-amber-300 text-left" dir="ltr">
                      {proc.total_write_mb.toFixed(1)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tool 5: get_background_services */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  כלי 5: שירותי רקע פעילים (ללא ליבת Windows)
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                  get_background_services() · Non-Core Running Services
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {backgroundServicesReport.total_non_core_running} שירותים פעילים
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-900/40">
                  <th className="py-2.5 px-4 font-medium">שם שירות</th>
                  <th className="py-2.5 px-4 font-medium">תיאור תצוגה</th>
                  <th className="py-2.5 px-4 font-medium text-left">PID</th>
                  <th className="py-2.5 px-4 font-medium text-left">סוג הפעלה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {backgroundServicesReport.services.map((srv) => (
                  <tr key={srv.name} className="hover:bg-slate-800/40 transition-colors h-10">
                    <td className="py-2 px-4 font-mono font-semibold text-slate-100" dir="ltr">
                      {srv.name}
                    </td>
                    <td className="py-2 px-4 text-slate-300 truncate max-w-[200px]" dir="ltr">
                      {srv.display_name}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-400 text-left" dir="ltr">
                      {srv.pid}
                    </td>
                    <td className="py-2 px-4 font-mono text-emerald-400 text-left" dir="ltr">
                      {srv.start_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tool 4: get_startup_apps */}
      <section className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Power className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">
                כלי 4: תוכנות שעולות באתחול המחשב (Startup Apps)
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                get_startup_apps() · winreg (KEY_READ) + Startup Folders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setStartupFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                startupFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              הכל ({startupReport.startup_programs.length})
            </button>
            <button
              onClick={() => setStartupFilter('Registry')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                startupFilter === 'Registry'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Registry בלבד
            </button>
            <button
              onClick={() => setStartupFilter('Startup Folder')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                startupFilter === 'Startup Folder'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              תיקיות Startup
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-900/40">
                <th className="py-2.5 px-4 font-medium">שם תוכנה</th>
                <th className="py-2.5 px-4 font-medium">מקור</th>
                <th className="py-2.5 px-4 font-medium text-left">מיקום (Hive / Folder)</th>
                <th className="py-2.5 px-4 font-medium text-left">פקודה / נתיב הרצה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredStartup.map((item) => (
                <tr key={`${item.location}-${item.name}`} className="hover:bg-slate-800/40 transition-colors h-10">
                  <td className="py-2 px-4 font-mono font-semibold text-slate-100 whitespace-nowrap" dir="ltr">
                    {item.name}
                  </td>
                  <td className="py-2 px-4 text-slate-300 whitespace-nowrap">
                    {item.source_type}
                  </td>
                  <td className="py-2 px-4 font-mono text-amber-300 text-left whitespace-nowrap" dir="ltr">
                    {item.location}
                  </td>
                  <td
                    className="py-2 px-4 font-mono text-slate-400 text-left truncate max-w-md"
                    dir="ltr"
                    title={item.command_or_path}
                  >
                    {item.command_or_path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
