/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PythonModuleId } from '../types/diagnostics';

export interface PythonModuleFile {
  id: PythonModuleId;
  filename: string;
  titleHe: string;
  descriptionHe: string;
  specSection: string;
  code: string;
}

export function getPythonProjectModules(
  drivePath: string,
  intervalSec: number,
  processLimit: number
): PythonModuleFile[] {
  const escapedDrive = drivePath.replace(/\\/g, '\\\\');

  return [
    {
      id: 'config.py',
      filename: 'python_desktop_app/config.py',
      titleHe: 'ניהול הגדרות ותצורה (Settings)',
      descriptionHe: 'שומר וטוען הגדרות מקובץ JSON מקומי (כולל כונן מערכת, מודל, פרמטרים והגדרות חיבור) עבור אפליקציית הדסקטופ.',
      specSection: 'תשתית דסקטופ והגדרות',
      code: `"""
config.py - ניהול הגדרות ותצורה עבור אפליקציית הדסקטופ בפייתון.
טוען ושומר הגדרות לקובץ settings.json מקומי, עם תמיכה במשתני סביבה (.env).
"""

import json
import os
from pathlib import Path
from typing import Dict, Any

CONFIG_FILE_PATH = Path.home() / ".ai_system_diagnostics_config.json"

DEFAULT_CONFIG: Dict[str, Any] = {
    "provider": "gemini",
    "model_name": "gemini-3.8-flash",
    "api_key": "",
    "system_drive": "${escapedDrive}",
    "default_process_limit": ${processLimit},
    "cpu_sample_interval": ${intervalSec.toFixed(1)},
}


class AppConfig:
    """
    מנהל את הגדרות האפליקציה המקומית.
    מאפשר קריאה ועדכון מתוך מסך ההגדרות של אפליקציית הדסקטופ (Tkinter) או מהטרמינל.
    """

    def __init__(self, config_path: Path = CONFIG_FILE_PATH) -> None:
        self.config_path = config_path
        self.data: Dict[str, Any] = dict(DEFAULT_CONFIG)
        self.load()

    def load(self) -> Dict[str, Any]:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if isinstance(saved, dict):
                        self.data.update(saved)
            except Exception:
                pass

        env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if env_key and not self.data.get("api_key"):
            self.data["api_key"] = env_key

        return self.data

    def save(self, updates: Dict[str, Any]) -> None:
        self.data.update(updates)
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=4, ensure_ascii=False)
        except OSError as exc:
            print(f"Warning: Could not save settings to {self.config_path}: {exc}")

    @property
    def api_key(self) -> str:
        return str(self.data.get("api_key") or os.environ.get("GEMINI_API_KEY") or "")

    @property
    def model_name(self) -> str:
        return str(self.data.get("model_name", "gemini-3.8-flash"))

    @property
    def system_drive(self) -> str:
        return str(self.data.get("system_drive", "${escapedDrive}"))

    @property
    def default_process_limit(self) -> int:
        return int(self.data.get("default_process_limit", ${processLimit}))
`,
    },
    {
      id: 'models.py',
      filename: 'python_desktop_app/models.py',
      titleHe: 'סכמות נתונים (Pydantic Models)',
      descriptionHe: 'מגדיר מבני נתונים חזקים ואימות ה-JSON שחוזר מה-AI בחלוקה ל-3 פרקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה.',
      specSection: 'סעיף 3 - Pydantic',
      code: `"""
models.py - מודלים של Pydantic לאימות מבני הנתונים וה-JSON שחוזר מה-AI (סעיף 3 במסמך האפיון).
"""

from typing import List
from pydantic import BaseModel, Field


class RootCauseItem(BaseModel):
    component_or_process: str = Field(
        description="שם התהליך, השירות, תוכנת האתחול או רכיב החומרה (למשל: chrome.exe, Disk I/O, Docker Desktop)."
    )
    metric_or_evidence: str = Field(
        description="הנתון המדויק שנמצא מהכלים (למשל: '38.4% CPU', '8420 MB RAM', 'Write: 145 MB/s')."
    )
    impact_explanation: str = Field(
        description="הסבר ברור כיצד גורם זה משפיע על ביצועי המחשב ויוצר צוואר בקבוק."
    )


class DiagnosticFinalReport(BaseModel):
    severity: str = Field(
        description="רמת החומרה הכוללת: 'תקין', 'עומס בינוני', או 'עומס גבוה / קריטי'."
    )
    problem_diagnosis: str = Field(
        description="חלק 1 - אבחון הבעיה: סיכום ברור וממוקד של מצב המערכת וצוואר הבקבוק המרכזי."
    )
    main_causes: List[RootCauseItem] = Field(
        description="חלק 2 - הגורמים המרכזיים: רשימת הגורמים, התהליכים או השירותים הספציפיים שיוצרים את העומס."
    )
    action_recommendations: List[str] = Field(
        description="חלק 3 - המלצות לפעולה: צעדים מעשיים, פשוטים ובטוחים לביצוע על ידי המשתמש."
    )
`,
    },
    {
      id: 'collectors.py',
      filename: 'python_desktop_app/collectors.py',
      titleHe: 'איסוף נתונים ו-5 כלי החקירה (psutil + winreg)',
      descriptionHe: 'מממש את תמונת הבסיס (Baseline) ואת כל 5 הכלים ממסמך האפיון: CPU, Memory, Disk I/O, Startup Apps, ו-Background Services.',
      specSection: 'סעיף 5 - Tools Definition',
      code: `"""
collectors.py - שכבת איסוף הנתונים המקומית וכל 5 כלי העומק המוגדרים במסמך האפיון (סעיף 5):
1. get_system_snapshot(drive_path) - תמונת המצב הבסיסית (Baseline Trigger)
2. get_top_cpu_processes(limit) - התהליכים העמוסים ביותר חישובית
3. get_top_memory_processes(limit) - צרכני הזיכרון הכבדים ביותר
4. get_disk_io_status() - נתוני קריאה/כתיבה וצווארי בקבוק בדיסק
5. get_startup_apps() - תוכנות שנטענות עם עליית המחשב (Registry + Startup Folders)
6. get_background_services() - רשימת שירותים פעילים שאינם שייכים לליבת המערכת
"""

import json
import os
import time
from datetime import datetime
from typing import Dict, Any, List
import psutil


def bytes_to_gb(bytes_value: int) -> float:
    return round(bytes_value / (1024 ** 3), 2)


def bytes_to_mb(bytes_value: int) -> float:
    return round(bytes_value / (1024 ** 2), 2)


def get_system_snapshot(drive_path: str = "${escapedDrive}") -> str:
    """אוסף תמונת מצב בסיסית (Baseline Trigger): אחוז מעבד, זיכרון RAM ושטח דיסק פנוי."""
    cpu_usage_percent: float = psutil.cpu_percent(interval=${intervalSec.toFixed(1)})
    logical_cores: int = psutil.cpu_count(logical=True) or 1
    physical_cores: int = psutil.cpu_count(logical=False) or logical_cores

    virtual_mem = psutil.virtual_memory()
    ram_total_gb: float = bytes_to_gb(virtual_mem.total)
    ram_available_gb: float = bytes_to_gb(virtual_mem.available)
    ram_used_gb: float = bytes_to_gb(virtual_mem.total - virtual_mem.available)
    ram_percent: float = virtual_mem.percent

    target_drive = drive_path
    if os.name != "nt" and drive_path.upper().startswith("C:"):
        target_drive = "/"

    try:
        disk_usage = psutil.disk_usage(target_drive)
        disk_total_gb = bytes_to_gb(disk_usage.total)
        disk_free_gb = bytes_to_gb(disk_usage.free)
        disk_used_gb = bytes_to_gb(disk_usage.used)
        disk_percent = disk_usage.percent
        disk_status = "OK"
    except FileNotFoundError:
        disk_total_gb, disk_free_gb, disk_used_gb, disk_percent = 0.0, 0.0, 0.0, 0.0
        disk_status = f"Error: Drive '{target_drive}' not found"

    return json.dumps({
        "timestamp": datetime.now().isoformat(),
        "cpu": {
            "usage_percent": cpu_usage_percent,
            "logical_cores": logical_cores,
            "physical_cores": physical_cores,
        },
        "memory_ram": {
            "total_gb": ram_total_gb,
            "available_gb": ram_available_gb,
            "used_gb": ram_used_gb,
            "used_percent": ram_percent,
        },
        "storage": {
            "drive": drive_path,
            "resolved_path": target_drive,
            "total_gb": disk_total_gb,
            "free_gb": disk_free_gb,
            "used_gb": disk_used_gb,
            "used_percent": disk_percent,
            "status": disk_status,
        },
    }, indent=4, ensure_ascii=False)


def get_top_cpu_processes(limit: int = ${processLimit}, sample_interval: float = 0.5) -> str:
    """מחזיר את התהליכים העמוסים ביותר חישובית (CPU) עם הגנת AccessDenied."""
    logical_cores = psutil.cpu_count(logical=True) or 1

    for proc in psutil.process_iter():
        try:
            proc.cpu_percent(interval=None)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    time.sleep(sample_interval)

    processes_list: List[Dict[str, Any]] = []
    skipped_access_denied = 0

    for proc in psutil.process_iter(["pid", "name", "username", "status"]):
        try:
            p_info = proc.info
            pid = p_info.get("pid")
            name = p_info.get("name") or "Unknown"
            if pid == 0 or name.lower() == "system idle process":
                continue

            raw_cpu = proc.cpu_percent(interval=None)
            if raw_cpu is None:
                continue

            processes_list.append({
                "pid": pid,
                "name": name,
                "cpu_percent": round(raw_cpu / logical_cores, 2),
                "raw_core_percent": round(raw_cpu, 2),
                "status": p_info.get("status") or "running",
                "username": p_info.get("username") or "SYSTEM",
            })
        except psutil.AccessDenied:
            skipped_access_denied += 1
        except (psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    top_cpu = sorted(processes_list, key=lambda x: x["cpu_percent"], reverse=True)[:limit]
    return json.dumps({
        "tool": "get_top_cpu_processes",
        "timestamp": datetime.now().isoformat(),
        "top_count": len(top_cpu),
        "skipped_protected_processes": skipped_access_denied,
        "processes": top_cpu,
    }, indent=4, ensure_ascii=False)


def get_top_memory_processes(limit: int = ${processLimit}) -> str:
    """מחזיר את צרכני הזיכרון הכבדים ביותר (RAM RSS)."""
    processes_list: List[Dict[str, Any]] = []
    skipped_access_denied = 0

    for proc in psutil.process_iter(["pid", "name", "memory_info", "memory_percent", "status"]):
        try:
            p_info = proc.info
            mem_info = p_info.get("memory_info")
            if mem_info is None:
                continue

            processes_list.append({
                "pid": p_info.get("pid"),
                "name": p_info.get("name") or "Unknown",
                "ram_mb": bytes_to_mb(mem_info.rss),
                "ram_percent": round(p_info.get("memory_percent") or 0.0, 2),
                "status": p_info.get("status") or "running",
            })
        except psutil.AccessDenied:
            skipped_access_denied += 1
        except (psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    top_ram = sorted(processes_list, key=lambda x: x["ram_mb"], reverse=True)[:limit]
    return json.dumps({
        "tool": "get_top_memory_processes",
        "timestamp": datetime.now().isoformat(),
        "top_count": len(top_ram),
        "skipped_protected_processes": skipped_access_denied,
        "processes": top_ram,
    }, indent=4, ensure_ascii=False)


def get_disk_io_status(sample_interval: float = 1.0) -> str:
    """מחזיר נתוני קריאה/כתיבה וצווארי בקבוק בדיסק + התהליכים שכותבים הכי הרבה."""
    io_start = psutil.disk_io_counters()
    time.sleep(sample_interval)
    io_end = psutil.disk_io_counters()

    if io_start and io_end:
        read_mb_s = bytes_to_mb(int((io_end.read_bytes - io_start.read_bytes) / sample_interval))
        write_mb_s = bytes_to_mb(int((io_end.write_bytes - io_start.write_bytes) / sample_interval))
        read_iops = round((io_end.read_count - io_start.read_count) / sample_interval, 1)
        write_iops = round((io_end.write_count - io_start.write_count) / sample_interval, 1)
        total_read_gb = bytes_to_gb(io_end.read_bytes)
        total_write_gb = bytes_to_gb(io_end.write_bytes)
    else:
        read_mb_s, write_mb_s, read_iops, write_iops, total_read_gb, total_write_gb = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0

    io_processes: List[Dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "io_counters"]):
        try:
            p_info = proc.info
            io_c = p_info.get("io_counters")
            if io_c is None:
                continue
            r_mb = bytes_to_mb(io_c.read_bytes)
            w_mb = bytes_to_mb(io_c.write_bytes)
            io_processes.append({
                "pid": p_info.get("pid"),
                "name": p_info.get("name") or "Unknown",
                "total_read_mb": r_mb,
                "total_write_mb": w_mb,
                "combined_io_mb": round(r_mb + w_mb, 2),
            })
        except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    top_io = sorted(io_processes, key=lambda x: x["combined_io_mb"], reverse=True)[:5]
    return json.dumps({
        "tool": "get_disk_io_status",
        "timestamp": datetime.now().isoformat(),
        "realtime_throughput": {
            "read_mb_per_sec": read_mb_s,
            "write_mb_per_sec": write_mb_s,
            "read_iops": read_iops,
            "write_iops": write_iops,
            "bottleneck_suspected": (read_mb_s + write_mb_s) > 120.0 or (read_iops + write_iops) > 500,
        },
        "cumulative_since_boot": {
            "total_read_gb": total_read_gb,
            "total_write_gb": total_write_gb,
        },
        "top_io_processes": top_io,
    }, indent=4, ensure_ascii=False)


def get_startup_apps() -> str:
    """שולף תוכנות שנטענות עם עליית המחשב (Registry KEY_READ + Startup Folders)."""
    startup_items: List[Dict[str, str]] = []
    errors_or_warnings: List[str] = []

    if os.name != "nt":
        return json.dumps({
            "tool": "get_startup_apps",
            "timestamp": datetime.now().isoformat(),
            "supported_os": False,
            "total_count": 0,
            "startup_programs": [],
        }, indent=4, ensure_ascii=False)

    import winreg

    registry_targets = [
        (winreg.HKEY_CURRENT_USER, r"Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKCU\\\\Run (Current User)"),
        (winreg.HKEY_CURRENT_USER, r"Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce", "HKCU\\\\RunOnce (Current User)"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKLM\\\\Run (All Users)"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce", "HKLM\\\\RunOnce (All Users)"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run", "HKLM\\\\Run (32-bit WOW64)"),
    ]

    for hive, subkey_path, scope_label in registry_targets:
        try:
            with winreg.OpenKey(hive, subkey_path, 0, winreg.KEY_READ) as reg_key:
                idx = 0
                while True:
                    try:
                        val_name, val_data, _ = winreg.EnumValue(reg_key, idx)
                        startup_items.append({
                            "name": str(val_name),
                            "command_or_path": str(val_data),
                            "source_type": "Registry",
                            "location": scope_label,
                        })
                        idx += 1
                    except OSError:
                        break
        except (FileNotFoundError, PermissionError, Exception):
            continue

    return json.dumps({
        "tool": "get_startup_apps",
        "timestamp": datetime.now().isoformat(),
        "supported_os": True,
        "total_count": len(startup_items),
        "warnings": errors_or_warnings,
        "startup_programs": startup_items,
    }, indent=4, ensure_ascii=False)


def get_background_services(limit: int = 15) -> str:
    """רשימת שירותים פעילים (Windows Services) שאינם שייכים לליבת המערכת (svchost)."""
    non_core_services: List[Dict[str, Any]] = []

    if os.name != "nt" or not hasattr(psutil, "win_service_iter"):
        return json.dumps({
            "tool": "get_background_services",
            "timestamp": datetime.now().isoformat(),
            "supported_os": False,
            "services": [],
        }, indent=4, ensure_ascii=False)

    for service in psutil.win_service_iter():
        try:
            info = service.as_dict()
            if info.get("status") != "running":
                continue
            binpath = str(info.get("binpath") or "")
            if "c:\\\\windows\\\\system32\\\\svchost.exe" in binpath.lower():
                continue

            non_core_services.append({
                "name": info.get("name"),
                "display_name": info.get("display_name"),
                "status": info.get("status"),
                "start_type": info.get("start_type"),
                "pid": info.get("pid"),
                "binpath": binpath,
            })
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError, Exception):
            continue

    return json.dumps({
        "tool": "get_background_services",
        "timestamp": datetime.now().isoformat(),
        "supported_os": True,
        "total_non_core_running": len(non_core_services),
        "services": non_core_services[:limit],
    }, indent=4, ensure_ascii=False)
`,
    },
    {
      id: 'ai_agent.py',
      filename: 'python_desktop_app/ai_agent.py',
      titleHe: 'מנוע ה-AI ולולאת ה-Function Calling',
      descriptionHe: 'מחבר את כל 5 הכלים ל-API של המודל, מריץ את לולאת החקירה (Baseline -> Triage -> Tool Execution -> Feedback Loop) ומחזיר דוח מובנה.',
      specSection: 'סעיף 4 - Agent Workflow',
      code: `"""
ai_agent.py - מנוע ההחלטות (AI Agent) ולולאת התקשורת (The Loop) לפי סעיפים 4 ו-5 במסמך האפיון.
"""

import json
from typing import Callable, Dict, List, Optional
from google import genai
from google.genai import types

from .config import AppConfig
from .models import DiagnosticFinalReport
from .collectors import (
    get_system_snapshot,
    get_top_cpu_processes,
    get_top_memory_processes,
    get_disk_io_status,
    get_startup_apps,
    get_background_services,
)

AVAILABLE_DIAGNOSTIC_TOOLS: Dict[str, Callable] = {
    "get_top_cpu_processes": get_top_cpu_processes,
    "get_top_memory_processes": get_top_memory_processes,
    "get_disk_io_status": get_disk_io_status,
    "get_startup_apps": get_startup_apps,
    "get_background_services": get_background_services,
}

DIAGNOSTIC_TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_top_cpu_processes",
        description="מחזיר את התהליכים העמוסים ביותר חישובית (CPU).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"limit": types.Schema(type=types.Type.INTEGER)},
        ),
    ),
    types.FunctionDeclaration(
        name="get_top_memory_processes",
        description="מחזיר את צרכני הזיכרון (RAM) הכבדים ביותר במערכת.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"limit": types.Schema(type=types.Type.INTEGER)},
        ),
    ),
    types.FunctionDeclaration(
        name="get_disk_io_status",
        description="מחזיר נתוני קריאה/כתיבה בזמן אמת וצווארי בקבוק בדיסק.",
        parameters=types.Schema(type=types.Type.OBJECT, properties={}),
    ),
    types.FunctionDeclaration(
        name="get_startup_apps",
        description="שולף תוכנות שנטענות עם עליית המחשב (Startup).",
        parameters=types.Schema(type=types.Type.OBJECT, properties={}),
    ),
    types.FunctionDeclaration(
        name="get_background_services",
        description="רשימת שירותים פעילים שאינם שייכים לליבת המערכת.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={"limit": types.Schema(type=types.Type.INTEGER)},
        ),
    ),
]

DIAGNOSTIC_SYSTEM_PROMPT = """אתה טכנאי מחשבים מומחה ומאבחן ביצועי מערכת בכיר.
1. נתח את תמונת הבסיס (Baseline Snapshot).
2. הפעל את הכלים הרלוונטיים מתוך 5 הכלים שלך כדי לאתר את שורש האיטיות.
3. החזר דוח סופי בעברית המחולק ל-3 חלקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה."""


def run_diagnostic_workflow(
    config: Optional[AppConfig] = None,
    user_issue_description: Optional[str] = None,
    on_status_update: Optional[Callable[[str], None]] = None,
) -> DiagnosticFinalReport:
    app_config = config or AppConfig()

    def notify(msg: str) -> None:
        if on_status_update:
            on_status_update(msg)

    client_kwargs = {"api_key": app_config.api_key} if app_config.api_key else {}
    client = genai.Client(**client_kwargs)
    model_name = app_config.model_name

    notify("[1/3] אוסף תמונת מצב ראשונית (Baseline Snapshot)...")
    baseline_json = get_system_snapshot(app_config.system_drive)

    user_prompt = f"תמונת מצב בסיסית (JSON):\\n{baseline_json}\\n"
    if user_issue_description:
        user_prompt += f"תיאור הבעיה: {user_issue_description}\\n"

    contents: List[types.Content] = [
        types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
    ]

    tool_config = types.GenerateContentConfig(
        system_instruction=DIAGNOSTIC_SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=DIAGNOSTIC_TOOL_DECLARATIONS)],
        temperature=0.2,
    )

    notify("[2/3] מבצע הערכה ראשונית (Triage)...")
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=tool_config,
    )

    turn = 0
    while response.function_calls and turn < 5:
        turn += 1
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)

        tool_parts: List[types.Part] = []
        for call in response.function_calls:
            func_name = call.name
            func_args = call.args or {}
            notify(f" -> מפעיל כלי מקומי: {func_name}({func_args})")

            target_fn = AVAILABLE_DIAGNOSTIC_TOOLS.get(func_name)
            if target_fn is not None:
                try:
                    parsed_res = json.loads(target_fn(**func_args))
                except Exception as exc:
                    parsed_res = {"error": str(exc)}
            else:
                parsed_res = {"error": f"Unknown tool: {func_name}"}

            tool_parts.append(
                types.Part.from_function_response(name=func_name, response={"result": parsed_res})
            )

        contents.append(types.Content(role="user", parts=tool_parts))
        response = client.models.generate_content(model=model_name, contents=contents, config=tool_config)

    notify("[3/3] מפיק דוח אבחון סופי מחולק ל-3 פרקים...")
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text="סכם לדוח אבחון סופי ב-3 חלקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה.")],
        )
    )

    structured_response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=DIAGNOSTIC_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=DiagnosticFinalReport,
            temperature=0.2,
        ),
    )

    return DiagnosticFinalReport.model_validate_json(structured_response.text)
`,
    },
    {
      id: 'console_ui.py',
      filename: 'python_desktop_app/console_ui.py',
      titleHe: 'תצוגת טרמינל מעוצבת (Rich CLI)',
      descriptionHe: 'מציג את הדוח הסופי בקונסול באמצעות Panel ו-Table של ספריית rich בחלוקה ל-3 פרקים ברורים.',
      specSection: 'סעיף 6 שלב ד׳ - Rich CLI',
      code: `"""
console_ui.py - תצוגת קונסול עשירה ומסודרת באמצעות ספריית rich (סעיף 6 - שלב ד').
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box
from .models import DiagnosticFinalReport


def display_diagnostic_report_in_console(report: DiagnosticFinalReport) -> None:
    console = Console()

    severity_color = "green"
    if "גבוה" in report.severity or "קריטי" in report.severity:
        severity_color = "red"
    elif "בינוני" in report.severity:
        severity_color = "yellow"

    console.rule("[bold white]דוח אבחון מערכת חכם · AI System Diagnostics[/bold white]", style="cyan")
    console.print()

    # 1. אבחון הבעיה
    console.print(
        Panel(
            f"[bold {severity_color}]רמת חומרה: {report.severity}[/bold {severity_color}]\\n\\n"
            f"[white]{report.problem_diagnosis}[/white]",
            title="[bold cyan]1. אבחון הבעיה[/bold cyan]",
            title_align="right",
            border_style="cyan",
            padding=(1, 2),
        )
    )
    console.print()

    # 2. הגורמים המרכזיים
    causes_table = Table(
        title="[bold amber1]2. הגורמים המרכזיים שזוהו במערכת[/bold amber1]",
        box=box.ROUNDED,
        border_style="yellow",
        header_style="bold yellow",
        expand=True,
        show_lines=True,
    )
    causes_table.add_column("רכיב / תהליך", style="bold cyan", width=24)
    causes_table.add_column("נתון שנמדד", style="bold magenta", width=22)
    causes_table.add_column("השפעה על המערכת", style="white")

    for cause in report.main_causes:
        causes_table.add_row(
            cause.component_or_process,
            cause.metric_or_evidence,
            cause.impact_explanation,
        )

    console.print(causes_table)
    console.print()

    # 3. המלצות לפעולה
    recs = "\\n\\n".join(
        f"[bold green]{i}.[/bold green] [white]{r}[/white]"
        for i, r in enumerate(report.action_recommendations, 1)
    )
    console.print(
        Panel(
            recs,
            title="[bold green]3. המלצות לפעולה[/bold green]",
            title_align="right",
            border_style="green",
            padding=(1, 2),
        )
    )
`,
    },
    {
      id: 'desktop_gui.py',
      filename: 'python_desktop_app/desktop_gui.py',
      titleHe: 'ממשק גרפי לדסקטופ (Tkinter GUI + Settings)',
      descriptionHe: 'חלון אפליקציית דסקטופ ב-Tkinter עם לשונית אבחון ולשונית הגדרות מסודרת (שינוי הגדרות חיבור, מודל וכונן).',
      specSection: 'סעיף 6 שלב ד׳ - Desktop GUI',
      code: `"""
desktop_gui.py - ממשק גרפי לדסקטופ באמצעות Tkinter (סעיף 6 - שלב ד' במסמך האפיון).
כולל לשונית אבחון מערכת ולשונית הגדרות תצורה (Settings).
"""

import threading
import tkinter as tk
from tkinter import ttk, messagebox
from .config import AppConfig
from .ai_agent import run_diagnostic_workflow


class DiagnosticsDesktopApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("AI System Diagnostics - כלי אבחון איטיות במחשב")
        self.root.geometry("980x720")
        self.config = AppConfig()

        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        self.tab_diagnostics = ttk.Frame(self.notebook, padding=16)
        self.tab_settings = ttk.Frame(self.notebook, padding=16)

        self.notebook.add(self.tab_diagnostics, text="  אבחון מערכת (AI Agent)  ")
        self.notebook.add(self.tab_settings, text="  הגדרות תצורה (Settings)  ")

        self._build_diagnostics_tab()
        self._build_settings_tab()

    def _build_diagnostics_tab(self) -> None:
        top_frame = ttk.Frame(self.tab_diagnostics)
        top_frame.pack(fill=tk.X, pady=(0, 12))

        ttk.Label(top_frame, text="תיאור הבעיה / מיקוד הבדיקה:").pack(anchor=tk.E)
        self.issue_entry = ttk.Entry(top_frame, width=80, justify="right")
        self.issue_entry.insert(0, "המחשב מרגיש איטי וגם לוקח לו הרבה זמן לעלות בהדלקה.")
        self.issue_entry.pack(fill=tk.X, pady=6)

        btn_frame = ttk.Frame(top_frame)
        btn_frame.pack(fill=tk.X)

        self.run_btn = ttk.Button(
            btn_frame,
            text="הפעל סריקה ואבחון AI",
            command=self._start_diagnosis_thread,
        )
        self.run_btn.pack(side=tk.RIGHT)

        self.status_label = ttk.Label(btn_frame, text="מוכן להרצה.")
        self.status_label.pack(side=tk.RIGHT, padx=12)

        self.output_text = tk.Text(
            self.tab_diagnostics,
            wrap=tk.WORD,
            font=("Consolas", 11),
            bg="#0f172a",
            fg="#f8fafc",
            padx=14,
            pady=14,
        )
        self.output_text.pack(fill=tk.BOTH, expand=True)

    def _build_settings_tab(self) -> None:
        ttk.Label(
            self.tab_settings,
            text="הגדרות אפליקציית הדסקטופ (נשמר אוטומטית אל ~/.ai_system_diagnostics_config.json)",
            font=("Segoe UI", 11, "bold"),
        ).pack(anchor=tk.E, pady=(0, 16))

        form = ttk.Frame(self.tab_settings)
        form.pack(fill=tk.X)

        ttk.Label(form, text="API Key (או דרך משתנה סביבה GEMINI_API_KEY):").grid(row=0, column=1, sticky=tk.E, pady=8)
        self.api_key_var = tk.StringVar(value=self.config.data.get("api_key", ""))
        ttk.Entry(form, textvariable=self.api_key_var, show="*", width=50).grid(row=0, column=0, sticky=tk.W, pady=8, padx=8)

        ttk.Label(form, text="שם מודל ה-AI:").grid(row=1, column=1, sticky=tk.E, pady=8)
        self.model_var = tk.StringVar(value=self.config.model_name)
        ttk.Combobox(form, textvariable=self.model_var, values=["gemini-3.8-flash", "gemini-4-argon"], width=47).grid(row=1, column=0, sticky=tk.W, pady=8, padx=8)

        ttk.Label(form, text="כונן מערכת לבדיקה:").grid(row=2, column=1, sticky=tk.E, pady=8)
        self.drive_var = tk.StringVar(value=self.config.system_drive)
        ttk.Entry(form, textvariable=self.drive_var, width=20).grid(row=2, column=0, sticky=tk.W, pady=8, padx=8)

        ttk.Button(self.tab_settings, text="שמור הגדרות", command=self._save_settings).pack(anchor=tk.E, pady=16)

    def _save_settings(self) -> None:
        self.config.save({
            "api_key": self.api_key_var.get().strip(),
            "model_name": self.model_var.get().strip(),
            "system_drive": self.drive_var.get().strip(),
        })
        messagebox.showinfo("נשמר", "ההגדרות נשמרו בהצלחה.")

    def _start_diagnosis_thread(self) -> None:
        self.run_btn.config(state=tk.DISABLED)
        self.output_text.delete("1.0", tk.END)
        issue = self.issue_entry.get().strip()

        def worker() -> None:
            try:
                report = run_diagnostic_workflow(
                    config=self.config,
                    user_issue_description=issue,
                    on_status_update=lambda msg: self.root.after(0, lambda: self.status_label.config(text=msg)),
                )
                self.root.after(0, lambda: self._render_report(report))
            except Exception as exc:
                self.root.after(0, lambda: messagebox.showerror("שגיאה", str(exc)))
            finally:
                self.root.after(0, lambda: self.run_btn.config(state=tk.NORMAL))

        threading.Thread(target=worker, daemon=True).start()

    def _render_report(self, report) -> None:
        self.status_label.config(text=f"האבחון הושלם (חומרה: {report.severity})")
        lines = [
            f"=== 1. אבחון הבעיה (רמת חומרה: {report.severity}) ===",
            report.problem_diagnosis,
            "",
            "=== 2. הגורמים המרכזיים ===",
        ]
        for c in report.main_causes:
            lines.append(f"• {c.component_or_process} [{c.metric_or_evidence}]: {c.impact_explanation}")
        lines.append("")
        lines.append("=== 3. המלצות לפעולה ===")
        for idx, rec in enumerate(report.action_recommendations, start=1):
            lines.append(f"{idx}. {rec}")
        self.output_text.insert(tk.END, "\\n".join(lines))


def launch_desktop_gui() -> None:
    root = tk.Tk()
    DiagnosticsDesktopApp(root)
    root.mainloop()
`,
    },
    {
      id: 'main.py',
      filename: 'python_desktop_app/main.py',
      titleHe: 'נקודת כניסה ראשית (CLI / Desktop GUI)',
      descriptionHe: 'קובץ ההרצה הראשי שמחבר את כל המודולים יחד ומאפשר הפעלה כחלון דסקטופ (--gui) או כטרמינל מעוצב (--cli).',
      specSection: 'נקודת כניסה ראשית',
      code: `"""
main.py - נקודת הכניסה הראשית של אפליקציית הדסקטופ בפייתון.
"""

import argparse
from rich.console import Console
from .config import AppConfig
from .ai_agent import run_diagnostic_workflow
from .console_ui import display_diagnostic_report_in_console
from .desktop_gui import launch_desktop_gui


def main() -> None:
    parser = argparse.ArgumentParser(description="AI System Diagnostics Desktop Tool")
    parser.add_argument("--gui", action="store_true", help="הפעל את ממשק הדסקטופ הגרפי (Tkinter GUI).")
    parser.add_argument(
        "--issue",
        type=str,
        default="המחשב מרגיש איטי וגם לוקח לו הרבה זמן לעלות בהדלקה.",
        help="תיאור הבעיה עבור סוכן ה-AI.",
    )
    args = parser.parse_args()

    if args.gui:
        launch_desktop_gui()
    else:
        console = Console()
        config = AppConfig()
        report = run_diagnostic_workflow(
            config=config,
            user_issue_description=args.issue,
            on_status_update=lambda msg: console.print(f"[bold cyan]{msg}[/bold cyan]"),
        )
        display_diagnostic_report_in_console(report)


if __name__ == "__main__":
    main()
`,
    },
  ];
}
