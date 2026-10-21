/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SystemSnapshot {
  timestamp: string;
  cpu: {
    usage_percent: number;
    logical_cores: number;
    physical_cores: number;
  };
  memory_ram: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    used_percent: number;
  };
  storage: {
    drive: string;
    resolved_path: string;
    total_gb: number;
    free_gb: number;
    used_gb: number;
    used_percent: number;
    status: string;
  };
}

export interface CpuProcessItem {
  pid: number;
  name: string;
  cpu_percent: number;
  raw_core_percent: number;
  status: string;
  username: string;
}

export interface RamProcessItem {
  pid: number;
  name: string;
  ram_mb: number;
  ram_percent: number;
  status: string;
}

export interface DiskIoProcessItem {
  pid: number;
  name: string;
  total_read_mb: number;
  total_write_mb: number;
  combined_io_mb: number;
}

export interface StartupProgramItem {
  name: string;
  command_or_path: string;
  source_type: 'Registry' | 'Startup Folder';
  location: string;
}

export interface BackgroundServiceItem {
  name: string;
  display_name: string;
  status: string;
  start_type: string;
  pid: number;
  binpath: string;
}

export interface TopCpuReport {
  tool: string;
  timestamp: string;
  top_count: number;
  skipped_protected_processes: number;
  processes: CpuProcessItem[];
}

export interface TopMemoryReport {
  tool: string;
  timestamp: string;
  top_count: number;
  skipped_protected_processes: number;
  processes: RamProcessItem[];
}

export interface DiskIoReport {
  tool: string;
  timestamp: string;
  realtime_throughput: {
    read_mb_per_sec: number;
    write_mb_per_sec: number;
    read_iops: number;
    write_iops: number;
    bottleneck_suspected: boolean;
  };
  cumulative_since_boot: {
    total_read_gb: number;
    total_write_gb: number;
  };
  top_io_processes: DiskIoProcessItem[];
}

export interface StartupProgramsReport {
  tool: string;
  timestamp: string;
  supported_os: boolean;
  total_count: number;
  warnings: string[];
  startup_programs: StartupProgramItem[];
}

export interface BackgroundServicesReport {
  tool: string;
  timestamp: string;
  supported_os: boolean;
  total_non_core_running: number;
  returned_count: number;
  services: BackgroundServiceItem[];
}

export interface ToolTraceStep {
  step: number;
  toolName: string;
  args: Record<string, unknown>;
  resultPreview: unknown;
}

export interface RootCauseItem {
  component_or_process: string;
  metric_or_evidence: string;
  impact_explanation: string;
}

export interface StructuredDiagnosticReport {
  severity: string;
  problem_diagnosis: string;
  main_causes: RootCauseItem[];
  action_recommendations: string[];
}

export type DesktopTabId = 'agent' | 'tools' | 'python_project' | 'spec_audit';
export type PythonModuleId = 'config.py' | 'models.py' | 'collectors.py' | 'ai_agent.py' | 'console_ui.py' | 'desktop_gui.py' | 'main.py';
