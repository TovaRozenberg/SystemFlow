import json
import os
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
import psutil
from pydantic import BaseModel, Field

# שימוש ב-SDK המודרני של גוגל בפייתון: pip install google-genai
from google import genai
from google.genai import types

# שימוש בספריית rich לעיצוב הפלט במסוף: pip install rich
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box


# ==============================================================================
# סכמת הפלט המובנה (Structured Output) לחלוקה מדויקת ל-3 חלקים
# ==============================================================================

class RootCauseItem(BaseModel):
    component_or_process: str = Field(
        description="שם התהליך, תוכנת האתחול או רכיב החומרה (למשל: chrome.exe, Docker Desktop, RAM)."
    )
    metric_or_evidence: str = Field(
        description="הנתון המדויק שנמצא מהכלים (למשל: '38.4% CPU', '8420 MB RAM', 'HKCU\\Run')."
    )
    impact_explanation: str = Field(
        description="הסבר קצר כיצד גורם זה משפיע על ביצועי המחשב."
    )


class DiagnosticFinalReport(BaseModel):
    severity: str = Field(
        description="רמת החומרה הכוללת: 'תקין', 'עומס בינוני', או 'עומס גבוה / קריטי'."
    )
    problem_diagnosis: str = Field(
        description="חלק 1 - אבחון הבעיה: סיכום ברור וממוקד של מצב המערכת והבעיה המרכזית שזוהתה."
    )
    main_causes: List[RootCauseItem] = Field(
        description="חלק 2 - הגורמים המרכזיים: רשימת הגורמים והתהליכים הספציפיים שיוצרים את העומס."
    )
    action_recommendations: List[str] = Field(
        description="חלק 3 - המלצות לפעולה: צעדים מעשיים, ברורים ובטוחים לביצוע על ידי המשתמש."
    )


# ==============================================================================
# פונקציות איסוף נתונים וכלי עומק (psutil + winreg)
# ==============================================================================

def bytes_to_gb(bytes_value: int) -> float:
    """
    ממיר ערך בבייטים לגיגה-בייט (GB) ומעגל ל-2 ספרות אחרי הנקודה.
    """
    return round(bytes_value / (1024 ** 3), 2)


def bytes_to_mb(bytes_value: int) -> float:
    """
    ממיר ערך בבייטים למגה-בייט (MB) ומעגל ל-2 ספרות אחרי הנקודה.
    """
    return round(bytes_value / (1024 ** 2), 2)


def get_system_snapshot(drive_path: str = "C:\\") -> str:
    """
    אוסף 'תמונת מצב' כללית של המערכת באמצעות ספריית psutil:
    - אחוז שימוש נוכחי במעבד (CPU)
    - סך הכל זיכרון RAM וזיכרון פנוי
    - שטח אחסון פנוי בכונן המערכת (ברירת מחדל: C:)
    """
    cpu_usage_percent: float = psutil.cpu_percent(interval=1.0)
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
        disk_total_gb = 0.0
        disk_free_gb = 0.0
        disk_used_gb = 0.0
        disk_percent = 0.0
        disk_status = f"Error: Drive '{target_drive}' not found"

    snapshot: Dict[str, Any] = {
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
    }

    return json.dumps(snapshot, indent=4, ensure_ascii=False)


def get_top_cpu_processes(limit: int = 5, sample_interval: float = 0.5) -> str:
    """
    כלי עומק (AI Tool): מחזיר את רשימת התהליכים שצורכים הכי הרבה CPU כרגע.
    כולל טיפול בשגיאות הרשאה (AccessDenied) ותהליכים שנסגרו תוך כדי ריצה (NoSuchProcess).
    """
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

            normalized_cpu = round(raw_cpu / logical_cores, 2)

            processes_list.append({
                "pid": pid,
                "name": name,
                "cpu_percent": normalized_cpu,
                "raw_core_percent": round(raw_cpu, 2),
                "status": p_info.get("status") or "running",
                "username": p_info.get("username") or "SYSTEM",
            })
        except psutil.AccessDenied:
            skipped_access_denied += 1
            continue
        except (psutil.NoSuchProcess, psutil.ZombieProcess):
            continue
        except Exception:
            continue

    top_cpu = sorted(processes_list, key=lambda x: x["cpu_percent"], reverse=True)[:limit]

    result = {
        "tool": "get_top_cpu_processes",
        "timestamp": datetime.now().isoformat(),
        "top_count": len(top_cpu),
        "skipped_protected_processes": skipped_access_denied,
        "processes": top_cpu,
    }

    return json.dumps(result, indent=4, ensure_ascii=False)


def get_top_ram_processes(limit: int = 5) -> str:
    """
    כלי עומק (AI Tool): מחזיר את רשימת התהליכים שתופסים הכי הרבה זיכרון RAM כרגע.
    כולל טיפול מלא בחריגות הרשאה (AccessDenied) ותהליכים שנעלמו (NoSuchProcess).
    """
    processes_list: List[Dict[str, Any]] = []
    skipped_access_denied = 0

    for proc in psutil.process_iter(["pid", "name", "memory_info", "memory_percent", "status"]):
        try:
            p_info = proc.info
            mem_info = p_info.get("memory_info")
            if mem_info is None:
                continue

            ram_rss_bytes = mem_info.rss
            ram_mb = bytes_to_mb(ram_rss_bytes)
            ram_percent = round(p_info.get("memory_percent") or 0.0, 2)

            processes_list.append({
                "pid": p_info.get("pid"),
                "name": p_info.get("name") or "Unknown",
                "ram_mb": ram_mb,
                "ram_percent": ram_percent,
                "status": p_info.get("status") or "running",
            })
        except psutil.AccessDenied:
            skipped_access_denied += 1
            continue
        except (psutil.NoSuchProcess, psutil.ZombieProcess):
            continue
        except Exception:
            continue

    top_ram = sorted(processes_list, key=lambda x: x["ram_mb"], reverse=True)[:limit]

    result = {
        "tool": "get_top_ram_processes",
        "timestamp": datetime.now().isoformat(),
        "top_count": len(top_ram),
        "skipped_protected_processes": skipped_access_denied,
        "processes": top_ram,
    }

    return json.dumps(result, indent=4, ensure_ascii=False)


def get_windows_startup_programs() -> str:
    """
    כלי עומק (AI Tool): שולף בצורה בטוחה (Read-Only) את רשימת התוכנות שעולות באתחול (Startup) ב-Windows.
    """
    startup_items: List[Dict[str, str]] = []
    errors_or_warnings: List[str] = []

    if os.name != "nt":
        return json.dumps({
            "tool": "get_windows_startup_programs",
            "timestamp": datetime.now().isoformat(),
            "supported_os": False,
            "message": "פונקציה זו מיועדת לסביבת Windows (os.name == 'nt').",
            "total_count": 0,
            "startup_programs": [],
        }, indent=4, ensure_ascii=False)

    import winreg

    registry_targets = [
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKCU\\Run (Current User)"),
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\RunOnce", "HKCU\\RunOnce (Current User)"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKLM\\Run (All Users)"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\RunOnce", "HKLM\\RunOnce (All Users)"),
        (winreg.HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run", "HKLM\\Run (32-bit WOW64)"),
    ]

    for hive, subkey_path, scope_label in registry_targets:
        try:
            with winreg.OpenKey(hive, subkey_path, 0, winreg.KEY_READ) as reg_key:
                index = 0
                while True:
                    try:
                        value_name, value_data, _ = winreg.EnumValue(reg_key, index)
                        startup_items.append({
                            "name": str(value_name),
                            "command_or_path": str(value_data),
                            "source_type": "Registry",
                            "location": scope_label,
                        })
                        index += 1
                    except OSError:
                        break
        except FileNotFoundError:
            continue
        except PermissionError:
            errors_or_warnings.append(f"PermissionDenied reading {scope_label}")
            continue
        except Exception as exc:
            errors_or_warnings.append(f"Error reading {scope_label}: {str(exc)}")
            continue

    appdata = os.environ.get("APPDATA", "")
    programdata = os.environ.get("PROGRAMDATA", "")

    startup_folders = [
        (
            os.path.join(appdata, r"Microsoft\Windows\Start Menu\Programs\Startup"),
            "Startup Folder (Current User)",
        ),
        (
            os.path.join(programdata, r"Microsoft\Windows\Start Menu\Programs\Startup"),
            "Startup Folder (All Users)",
        ),
    ]

    for folder_path, folder_label in startup_folders:
        if not folder_path or not os.path.isdir(folder_path):
            continue
        try:
            for entry in os.scandir(folder_path):
                if entry.name.lower() == "desktop.ini":
                    continue
                if entry.is_file():
                    startup_items.append({
                        "name": entry.name,
                        "command_or_path": entry.path,
                        "source_type": "Startup Folder",
                        "location": folder_label,
                    })
        except PermissionError:
            errors_or_warnings.append(f"PermissionDenied scanning {folder_label}")
        except Exception as exc:
            errors_or_warnings.append(f"Error scanning {folder_label}: {str(exc)}")

    result = {
        "tool": "get_windows_startup_programs",
        "timestamp": datetime.now().isoformat(),
        "supported_os": True,
        "total_count": len(startup_items),
        "warnings": errors_or_warnings,
        "startup_programs": startup_items,
    }

    return json.dumps(result, indent=4, ensure_ascii=False)


# ==============================================================================
# חיבור ל-API של מודל השפה (Gemini Function Calling + Structured Output)
# ==============================================================================

AVAILABLE_DIAGNOSTIC_TOOLS = {
    "get_top_cpu_processes": get_top_cpu_processes,
    "get_top_ram_processes": get_top_ram_processes,
    "get_windows_startup_programs": get_windows_startup_programs,
}

DIAGNOSTIC_TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_top_cpu_processes",
        description=(
            "מחזיר את רשימת התהליכים שצורכים הכי הרבה מעבד (CPU) כרגע. "
            "הפעל כלי זה כאשר אחוז השימוש במעבד גבוה או כשיש חשד להאטה בגלל תהליך רקע."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "limit": types.Schema(
                    type=types.Type.INTEGER,
                    description="מספר התהליכים המובילים להחזרה (ברירת מחדל: 5).",
                )
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_top_ram_processes",
        description=(
            "מחזיר את רשימת התהליכים שתופסים הכי הרבה זיכרון עבודה (RAM) כרגע. "
            "הפעל כלי זה כאשר ניצול ה-RAM גבוה או כשיש חשד לזליגת זיכרון."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "limit": types.Schema(
                    type=types.Type.INTEGER,
                    description="מספר התהליכים המובילים להחזרה (ברירת מחדל: 5).",
                )
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_windows_startup_programs",
        description=(
            "שולף את רשימת התוכנות שעולות אוטומטית באתחול המחשב (Windows Startup) "
            "מה-Registry ומתיקיות ה-Startup. הפעל כלי זה לבדיקת עומס בעליית המחשב או תוכנות רקע קבועות."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={},
        ),
    ),
]

DIAGNOSTIC_SYSTEM_PROMPT = """אתה מומחה בכיר לאבחון תקלות מחשב וביצועי מערכת (System Diagnostics AI).
תפקידך לקבל את 'תמונת המצב הכללית' (System Snapshot) של המחשב בפורמט JSON ולנתח את בריאות המערכת.

הנחיות עבודה:
1. בחן תחילה את תמונת המצב הכללית (אחוז שימוש ב-CPU, אחוז ניצול זיכרון RAM, ושטח פנוי בכונן C:).
2. במידה ואתה מזהה עומס במעבד, ניצול זיכרון גבוה, או צורך לבדוק אילו תוכנות עולות באתחול המחשב (Startup) - השתמש בכלים (Tools) העומדים לרשותך:
   - get_top_cpu_processes לבדיקת התהליכים שמעמיסים על ה-CPU.
   - get_top_ram_processes לבדיקת התהליכים שצורכים הכי הרבה זיכרון RAM.
   - get_windows_startup_programs לבדיקת תוכנות שעולות באתחול המחשב.
3. בסיום איסוף הנתונים, נסח תשובה מקצועית בעברית המחולקת ל-3 חלקים ברורים:
   - אבחון הבעיה (problem_diagnosis)
   - הגורמים המרכזיים (main_causes)
   - המלצות לפעולה (action_recommendations)
"""


def run_ai_diagnostic_agent(
    drive_path: str = "C:\\",
    user_issue_description: Optional[str] = None,
) -> DiagnosticFinalReport:
    """
    מנהל את תהליך הדיאגנוסטיקה המלא מול ה-API ומחזיר אובייקט מובנה (DiagnosticFinalReport)
    המוכן להדפסה מעוצבת בקונסול באמצעות ספריית rich.
    """
    client = genai.Client()
    model_name = "gemini-3.8-flash"
    console = Console()

    console.print("[bold cyan][1/3] אוסף תמונת מצב ראשונית של המערכת (Snapshot)...[/bold cyan]")
    initial_snapshot_json = get_system_snapshot(drive_path)

    user_prompt = (
        f"להלן תמונת המצב הכללית של המחשב שלי כרגע (JSON):\n"
        f"{initial_snapshot_json}\n\n"
    )
    if user_issue_description:
        user_prompt += f"תלונת המשתמש / מיקוד הבדיקה: {user_issue_description}\n"
    else:
        user_prompt += (
            "אנא נתח את תמונת המצב. אם יש צורך במידע מעמיק יותר על תהליכי CPU, "
            "תהליכי RAM או תוכנות שעולות באתחול (Startup), הפעל את הכלים המתאימים."
        )

    contents: List[types.Content] = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_prompt)],
        )
    ]

    tool_config = types.GenerateContentConfig(
        system_instruction=DIAGNOSTIC_SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=DIAGNOSTIC_TOOL_DECLARATIONS)],
        temperature=0.2,
    )

    console.print("[bold cyan][2/3] שולח נתונים ל-AI ובודק האם נדרשת הפעלת כלי עומק...[/bold cyan]")
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=tool_config,
    )

    max_tool_turns = 5
    turn_count = 0

    while response.function_calls and turn_count < max_tool_turns:
        turn_count += 1
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)

        tool_response_parts: List[types.Part] = []

        for tool_call in response.function_calls:
            func_name = tool_call.name
            func_args = tool_call.args or {}
            console.print(f"  [yellow]-> ה-AI מפעיל כלי מקומי:[/yellow] [bold white]{func_name}({func_args})[/bold white]")

            target_function = AVAILABLE_DIAGNOSTIC_TOOLS.get(func_name)
            if target_function is not None:
                try:
                    raw_tool_json = target_function(**func_args)
                    parsed_tool_data = json.loads(raw_tool_json)
                except Exception as exc:
                    parsed_tool_data = {"error": f"Failed executing {func_name}: {str(exc)}"}
            else:
                parsed_tool_data = {"error": f"Unknown tool requested: {func_name}"}

            tool_response_parts.append(
                types.Part.from_function_response(
                    name=func_name,
                    response={"result": parsed_tool_data},
                )
            )

        contents.append(
            types.Content(
                role="user",
                parts=tool_response_parts,
            )
        )

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=tool_config,
        )

    # שלב סופי: בקשת התשובה הסופית בפורמט JSON מובנה (Structured Output) לפי הסכמה
    console.print("[bold cyan][3/3] מפיק דוח אבחון סופי מחולק ל-3 פרקים...[/bold cyan]\n")
    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text="כעת סכם את כל הממצאים לדוח אבחון סופי המורכב מ-3 חלקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה."
                )
            ],
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


# ==============================================================================
# תצוגת קונסול מעוצבת באמצעות ספריית rich (חלוקה ל-3 חלקים ברורים)
# ==============================================================================

def display_diagnostic_report_in_console(report: DiagnosticFinalReport) -> None:
    """
    מדפיסה את דוח האבחון הסופי למסוף בצורה מסודרת, צבעונית וקריאה באמצעות ספריית rich,
    מחולקת ל-3 חלקים: 1. אבחון הבעיה, 2. הגורמים המרכזיים, 3. המלצות לפעולה.
    """
    console = Console()

    # קביעת צבע המסגרת לפי רמת החומרה
    severity_color = "green"
    if "גבוה" in report.severity or "קריטי" in report.severity:
        severity_color = "red"
    elif "בינוני" in report.severity:
        severity_color = "yellow"

    console.rule("[bold white]דוח אבחון מערכת חכם · AI System Diagnostics[/bold white]", style="cyan")
    console.print()

    # --------------------------------------------------------------------------
    # חלק 1: אבחון הבעיה (Panel)
    # --------------------------------------------------------------------------
    diagnosis_panel = Panel(
        f"[bold {severity_color}]רמת חומרה: {report.severity}[/bold {severity_color}]\n\n"
        f"[white]{report.problem_diagnosis}[/white]",
        title="[bold cyan]1. אבחון הבעיה[/bold cyan]",
        title_align="right",
        border_style="cyan",
        padding=(1, 2),
    )
    console.print(diagnosis_panel)
    console.print()

    # --------------------------------------------------------------------------
    # חלק 2: הגורמים המרכזיים (Table)
    # --------------------------------------------------------------------------
    causes_table = Table(
        title="[bold amber1]2. הגורמים המרכזיים שזוהו במערכת[/bold amber1]",
        box=box.ROUNDED,
        border_style="yellow",
        header_style="bold yellow",
        expand=True,
        show_lines=True,
    )
    causes_table.add_column("רכיב / תהליך", style="bold cyan", width=22)
    causes_table.add_column("נתון שנמדד", style="bold magenta", width=20)
    causes_table.add_column("השפעה על המערכת", style="white")

    for cause in report.main_causes:
        causes_table.add_row(
            cause.component_or_process,
            cause.metric_or_evidence,
            cause.impact_explanation,
        )

    console.print(causes_table)
    console.print()

    # --------------------------------------------------------------------------
    # חלק 3: המלצות לפעולה (Panel עם רשימה ממוספרת)
    # --------------------------------------------------------------------------
    recommendations_lines = []
    for idx, rec in enumerate(report.action_recommendations, start=1):
        recommendations_lines.append(f"[bold green]{idx}.[/bold green] [white]{rec}[/white]")

    recommendations_panel = Panel(
        "\n\n".join(recommendations_lines),
        title="[bold green]3. המלצות לפעולה[/bold green]",
        title_align="right",
        border_style="green",
        padding=(1, 2),
    )
    console.print(recommendations_panel)
    console.rule(style="dim cyan")


if __name__ == "__main__":
    final_structured_report = run_ai_diagnostic_agent(
        drive_path="C:\\",
        user_issue_description="המחשב מרגיש איטי וגם לוקח לו הרבה זמן לעלות בהדלקה. תבדוק מה מעמיס עליו.",
    )
    display_diagnostic_report_in_console(final_structured_report)
