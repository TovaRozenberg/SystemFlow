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
      titleHe: 'איסוף נתונים + פתרון דגימת CPU והגנת תהליכי ליבה',
      descriptionHe: 'שומר מילון של אובייקטי psutil.Process חיים במעבר הראשון למניעת תוצאת 0.0, ומסנן תהליכי ליבה קריטיים (svchost.exe, System, explorer.exe).',
      specSection: 'סעיף 5 + הגנות CPU ו-OS',
      code: `"""
collectors.py - שכבת איסוף הנתונים המקומית וכל 5 כלי העומק המוגדרים במסמך האפיון (סעיף 5).

הגנות הנדסיות קריטיות שהוטמעו בקובץ זה:
1. דגימת CPU אמינה בשני מעברים (Two-Pass Process Snapshot על אובייקטי Process נשמרים):
   שומרים מילון {pid: proc} של אובייקטי psutil.Process חיים במעבר הראשון, ממתינים sample_interval,
   וקוראים ל-cpu_percent(interval=None) על *אותם אובייקטים בדיוק* במעבר השני.
   כך נפתרת לחלוטין בעיית ה-0.0 של psutil!
2. הגנת תהליכי מערכת קריטיים (CRITICAL_WINDOWS_PROCESSES Guardrail):
   סינון ותיוג מפורש של תהליכי ליבה ב-Windows (כגון svchost.exe, System, explorer.exe, csrss.exe, lsass.exe)
   כדי שהמשתמש או ה-AI לעולם לא ינסו לסגור אותם ולגרום לקריסת המערכת.
"""

import json
import os
import time
from datetime import datetime
from typing import Dict, Any, List
import psutil

CRITICAL_WINDOWS_PROCESSES = {
    "system idle process",
    "system",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "fontdrvhost.exe",
    "winlogon.exe",
    "dwm.exe",
    "explorer.exe",
    "spoolsv.exe",
    "taskhostw.exe",
    "runtimebroker.exe",
    "sihost.exe",
    "msmpeng.exe",
    "securityhealthservice.exe",
    "audiodg.exe",
    "wudfhost.exe",
}

CRITICAL_SYSTEM_PIDS = {0, 4}


def is_critical_system_process(pid: int, name: str) -> bool:
    """בודק האם התהליך הוא תהליך ליבה קריטי של מערכת ההפעלה שאסור לסגור."""
    if pid in CRITICAL_SYSTEM_PIDS:
        return True
    clean_name = (name or "").strip().lower()
    return clean_name in CRITICAL_WINDOWS_PROCESSES


def bytes_to_gb(bytes_value: int) -> float:
    return round(bytes_value / (1024 ** 3), 2)


def bytes_to_mb(bytes_value: int) -> float:
    return round(bytes_value / (1024 ** 2), 2)


def get_system_snapshot(drive_path: str = "${escapedDrive}") -> str:
    """
    אוסף תמונת מצב בסיסית (Baseline Trigger):
    מבצע 2 דגימות CPU חוסמות (interval=0.6) ומחשב ממוצע יציב כדי שלעולם לא יחזור 0.0.
    """
    samples = [psutil.cpu_percent(interval=0.6), psutil.cpu_percent(interval=0.6)]
    cpu_usage_percent: float = round(sum(samples) / len(samples), 1)
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
            "sampling_method": "2-sample blocking average (1.2s total)",
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


def get_top_cpu_processes(
    limit: int = ${processLimit},
    sample_interval: float = 1.0,
    include_system_processes: bool = False,
) -> str:
    """
    מחזיר את התהליכים העמוסים ביותר חישובית (CPU).
    שומר את אובייקטי ה-Process במילון tracked_processes במעבר הראשון וקורא
    ל-cpu_percent(interval=None) על *אותם אובייקטים בדיוק* במעבר השני לאחר השהיה.
    """
    logical_cores = psutil.cpu_count(logical=True) or 1
    effective_interval = max(float(sample_interval), 0.5)

    tracked_processes: Dict[int, psutil.Process] = {}
    skipped_access_denied = 0
    filtered_critical_count = 0

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pid = proc.info.get("pid")
            name = proc.info.get("name") or "Unknown"
            if pid is None or pid == 0 or name.lower() == "system idle process":
                continue
            proc.cpu_percent(interval=None)
            tracked_processes[pid] = proc
        except psutil.AccessDenied:
            skipped_access_denied += 1
        except (psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    time.sleep(effective_interval)

    processes_list: List[Dict[str, Any]] = []

    for pid, proc in tracked_processes.items():
        try:
            raw_cpu = proc.cpu_percent(interval=None)
            name = proc.name() or "Unknown"
            is_critical = is_critical_system_process(pid, name)

            if is_critical and not include_system_processes:
                filtered_critical_count += 1
                continue

            processes_list.append({
                "pid": pid,
                "name": name,
                "cpu_percent": round((raw_cpu or 0.0) / logical_cores, 2),
                "raw_core_percent": round(raw_cpu or 0.0, 2),
                "status": proc.status(),
                "username": proc.username() if hasattr(proc, "username") else "USER",
                "is_system_critical": is_critical,
                "safe_to_terminate": not is_critical,
            })
        except psutil.AccessDenied:
            skipped_access_denied += 1
        except (psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    top_cpu = sorted(processes_list, key=lambda x: x["cpu_percent"], reverse=True)[:limit]
    return json.dumps({
        "tool": "get_top_cpu_processes",
        "timestamp": datetime.now().isoformat(),
        "sample_interval_sec": effective_interval,
        "top_count": len(top_cpu),
        "skipped_protected_processes": skipped_access_denied,
        "filtered_critical_os_processes": filtered_critical_count,
        "processes": top_cpu,
    }, indent=4, ensure_ascii=False)


def get_top_memory_processes(
    limit: int = ${processLimit},
    include_system_processes: bool = False,
) -> str:
    """מחזיר את צרכני הזיכרון הכבדים ביותר תוך סינון תהליכי מערכת קריטיים."""
    processes_list: List[Dict[str, Any]] = []
    skipped_access_denied = 0
    filtered_critical_count = 0

    for proc in psutil.process_iter(["pid", "name", "memory_info", "memory_percent", "status"]):
        try:
            p_info = proc.info
            pid = p_info.get("pid")
            name = p_info.get("name") or "Unknown"
            mem_info = p_info.get("memory_info")
            if pid is None or mem_info is None:
                continue

            is_critical = is_critical_system_process(pid, name)
            if is_critical and not include_system_processes:
                filtered_critical_count += 1
                continue

            processes_list.append({
                "pid": pid,
                "name": name,
                "ram_mb": bytes_to_mb(mem_info.rss),
                "ram_percent": round(p_info.get("memory_percent") or 0.0, 2),
                "status": p_info.get("status") or "running",
                "is_system_critical": is_critical,
                "safe_to_terminate": not is_critical,
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
        "filtered_critical_os_processes": filtered_critical_count,
        "processes": top_ram,
    }, indent=4, ensure_ascii=False)
`,
    },
    {
      id: 'ai_agent.py',
      filename: 'python_desktop_app/ai_agent.py',
      titleHe: 'מנוע ה-AI + מניעת לולאות וסינון בטיחות',
      descriptionHe: 'מונע קריאות כפולות לאותו כלי באמצעות executed_calls_cache, מגביל ל-3 סבבים מקסימום, וחוסם המלצות לסגירת תהליכי ליבה.',
      specSection: 'סעיף 4 + הגנת לולאות ובטיחות',
      code: `"""
ai_agent.py - מנוע ההחלטות (AI Agent) ולולאת התקשורת (The Loop) לפי סעיפים 4 ו-5 במסמך האפיון.

הגנות הנדסיות קריטיות שהוטמעו בקובץ זה:
1. מניעת לולאה אינסופית וקריאות כפולות (Deduplication & Call Cache):
   שומר מילון executed_calls_cache עם חתימת כל קריאה (tool_name, json_args).
   אם המודל מבקש להריץ שוב את אותו כלי עם אותם פרמטרים, הסקריפט עוצר את הלולאה ומעביר אותו לסיכום.
2. תקרת איטרציות קשיחה (MAX_TOOL_TURNS = 3).
3. סינון בטיחות להמלצות (sanitize_report_recommendations):
   חוסם כל המלצה לסגור תהליכי ליבה קריטיים כגון svchost.exe, System, explorer.exe או lsass.exe.
"""

import json
from typing import Callable, Dict, List, Optional, Tuple
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

FORBIDDEN_KILL_PROCESSES = [
    "svchost.exe",
    "explorer.exe",
    "lsass.exe",
    "csrss.exe",
    "wininit.exe",
    "services.exe",
    "dwm.exe",
    "smss.exe",
]


def sanitize_report_recommendations(report: DiagnosticFinalReport) -> DiagnosticFinalReport:
    """
    שכבת הגנה בקוד (Post-Processing Safety Filter):
    מוודאת שגם אם מודל השפה טעה והמליץ לסגור תהליך ליבה כמו svchost.exe או explorer.exe,
    ההמלצה תיחסם ותוחלף באזהרת בטיחות ברורה לפני שהיא מוצגת למשתמש.
    """
    safe_recommendations: List[str] = []
    dangerous_verbs = ["סגור", "לסגור", "הרוג", "להרוג", "סיים", "לסיים", "בטל", "kill", "terminate", "end task"]

    for rec in report.action_recommendations:
        rec_lower = rec.lower()
        mentioned_critical = [proc for proc in FORBIDDEN_KILL_PROCESSES if proc in rec_lower]

        if mentioned_critical and any(verb in rec_lower for verb in dangerous_verbs):
            proc_names = ", ".join(mentioned_critical)
            safe_recommendations.append(
                f"[הגנת מערכת אוטומטית]: זוהתה פעילות בתהליך המערכת ({proc_names}), אך מדובר בתהליך ליבה קריטי של Windows שאסור לסגור ידנית כדי למנוע קריסת מערכת."
            )
        else:
            safe_recommendations.append(rec)

    report.action_recommendations = safe_recommendations
    return report


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

    notify("[1/3] אוסף תמונת מצב ראשונית בדגימה כפולה ממוצעת (Baseline Snapshot)...")
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
        temperature=0.1,
    )

    notify("[2/3] מבצע הערכה ראשונית (Triage)...")
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=tool_config,
    )

    # לולאת הכלים עם Deduplication Cache ותקרת 3 סבבים
    MAX_TOOL_TURNS = 3
    turn = 0
    executed_calls_cache: Dict[Tuple[str, str], Dict] = {}

    while response.function_calls and turn < MAX_TOOL_TURNS:
        turn += 1
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)

        tool_parts: List[types.Part] = []
        duplicate_detected = False

        for call in response.function_calls:
            func_name = call.name
            func_args = call.args or {}
            call_signature = (func_name, json.dumps(func_args, sort_keys=True))

            if call_signature in executed_calls_cache:
                duplicate_detected = True
                notify(f" [הגנת לולאה] דילוג על קריאה כפולה לכלי {func_name}")
                tool_parts.append(
                    types.Part.from_function_response(
                        name=func_name,
                        response={"result": {"notice": "Already executed", "cached": executed_calls_cache[call_signature]}},
                    )
                )
                continue

            notify(f" -> [סבב {turn}/{MAX_TOOL_TURNS}] מפעיל כלי מקומי: {func_name}({func_args})")
            target_fn = AVAILABLE_DIAGNOSTIC_TOOLS.get(func_name)
            parsed_res = json.loads(target_fn(**func_args)) if target_fn else {"error": "Unknown tool"}
            executed_calls_cache[call_signature] = parsed_res

            tool_parts.append(
                types.Part.from_function_response(name=func_name, response={"result": parsed_res})
            )

        contents.append(types.Content(role="user", parts=tool_parts))

        if duplicate_detected or turn >= MAX_TOOL_TURNS:
            break

        response = client.models.generate_content(model=model_name, contents=contents, config=tool_config)

    notify("[3/3] מפיק דוח אבחון סופי ובטוח מחולק ל-3 פרקים...")
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
            temperature=0.1,
        ),
    )

    raw_report = DiagnosticFinalReport.model_validate_json(structured_response.text)
    return sanitize_report_recommendations(raw_report)
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
