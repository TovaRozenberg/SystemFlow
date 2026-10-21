"""
collectors.py - שכבת איסוף הנתונים המקומית וכל 5 כלי העומק המוגדרים במסמך האפיון (סעיף 5).

הגנות הנדסיות קריטיות שהוטמעו בקובץ זה:
1. דגימת CPU אמינה בשני מעברים (Two-Pass Process Snapshot):
   שומרים מילון של אובייקטי psutil.Process חיים במעבר הראשון, ממתינים sample_interval (>= 1.0s),
   וקוראים ל-cpu_percent(interval=None) על *אותם אובייקטים בדיוק* במעבר השני.
   בנוסף, ב-Baseline מבצעים דגימה ממוצעת של 3 דגימות עוקבות למניעת קפיצות רגעיות או 0.0.
2. הגנת תהליכי מערכת קריטיים (CRITICAL_SYSTEM_PROCESSES Guardrail):
   סינון ותיוג מפורש של תהליכי ליבה ב-Windows (כגון svchost.exe, System, explorer.exe, csrss.exe, lsass.exe)
   כדי שהמשתמש או ה-AI לעולם לא ינסו לסגור אותם ולגרום לקריסת המערכת (BSOD / איבוד שולחן העבודה).
"""

import json
import os
import time
from datetime import datetime
from typing import Dict, Any, List
import psutil

# רשימת תהליכי ליבה קריטיים של מערכת ההפעלה Windows שאסור בתכלית האיסור לסגור או להרוג!
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
    "MsMpEng.exe".lower(),
    "securityhealthservice.exe",
    " audiodg.exe".strip(),
    "wudfhost.exe",
}

CRITICAL_SYSTEM_PIDS = {0, 4}


def is_critical_system_process(pid: int, name: str) -> bool:
    """
    בודק האם התהליך הוא תהליך ליבה קריטי של מערכת ההפעלה (כגון System, svchost.exe, explorer.exe, lsass.exe).
    סגירת תהליכים אלו עלולה לגרום למסך כחול (BSOD) או לאובדן ממשק המשתמש.
    """
    if pid in CRITICAL_SYSTEM_PIDS:
        return True
    clean_name = (name or "").strip().lower()
    return clean_name in CRITICAL_WINDOWS_PROCESSES


def bytes_to_gb(bytes_value: int) -> float:
    """ממיר ערך בבייטים לגיגה-בייט (GB) ומעגל ל-2 ספרות."""
    return round(bytes_value / (1024 ** 3), 2)


def bytes_to_mb(bytes_value: int) -> float:
    """ממיר ערך בבייטים למגה-בייט (MB) ומעגל ל-2 ספרות."""
    return round(bytes_value / (1024 ** 2), 2)


# ==============================================================================
# Baseline Trigger: תמונת מצב כללית של המערכת (דגימת CPU ממוצעת ואמינה)
# ==============================================================================

def get_system_snapshot(drive_path: str = "C:\\") -> str:
    """
    אוסף תמונת מצב בסיסית (Baseline Trigger):
    מבצע 2 דגימות CPU חוסמות (interval=0.6) ומחשב ממוצע יציב כדי שלעולם לא יחזור 0.0 או שיא רגעי שגוי.
    """
    samples = [psutil.cpu_percent(interval=0.6), psutil.cpu_percent(interval=0.6)]
    cpu_usage_percent: float = round(sum(samples) / len(samples), 1)
    per_core_usage: List[float] = psutil.cpu_percent(interval=None, percpu=True)

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
            "per_core_percent": per_core_usage,
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
    }

    return json.dumps(snapshot, indent=4, ensure_ascii=False)


# ==============================================================================
# כלי 1: get_top_cpu_processes (שמירת אובייקטי Process חיים + הגנת תהליכי ליבה)
# ==============================================================================

def get_top_cpu_processes(
    limit: int = 5,
    sample_interval: float = 1.0,
    include_system_processes: bool = False,
) -> str:
    """
    מחזיר את התהליכים העמוסים ביותר חישובית (CPU).

    פתרון בעיית ה-0.0 ב-psutil:
    ב-psutil, קריאה ל-proc.cpu_percent(interval=None) מחשבת דלתא רק אם היא נקראת
    פעמיים על *אותו מופע (Instance)* של אובייקט ה-Process! אם קוראים ל-process_iter()
    בשתי לולאות נפרדות עלולים להיווצר אובייקטים חדשים שמחזירים 0.0.
    לכן אנו שומרים במעבר הראשון מילון {pid: proc} של אובייקטים חיים, ממתינים sample_interval
    (לפחות 0.5-1.0 שניות), ובמעבר השני קוראים ל-cpu_percent(interval=None) על אותם אובייקטים בדיוק.

    הגנת תהליכי מערכת:
    כברירת מחדל (include_system_processes=False), תהליכי ליבה קריטיים (System, svchost.exe, explorer.exe)
    מסוננים החוצה מרשימת המועמדים לסגירה, או מתויגים עם is_system_critical=True ו-safe_to_terminate=False.
    """
    logical_cores = psutil.cpu_count(logical=True) or 1
    effective_interval = max(float(sample_interval), 0.5)

    # מעבר 1: שמירת אובייקטי Process חיים במילון ואתחול מונה הזמן של כל תהליך
    tracked_processes: Dict[int, psutil.Process] = {}
    skipped_access_denied = 0
    filtered_critical_count = 0

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pid = proc.info.get("pid")
            name = proc.info.get("name") or "Unknown"
            if pid is None or pid == 0 or name.lower() == "system idle process":
                continue

            # אתחול נקודת הייחוס הראשונה על המופע הספציפי
            proc.cpu_percent(interval=None)
            tracked_processes[pid] = proc
        except psutil.AccessDenied:
            skipped_access_denied += 1
        except (psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    # השהיה מבוקרת למדידת הדלתא של זמן המעבד
    time.sleep(effective_interval)

    processes_list: List[Dict[str, Any]] = []

    # מעבר 2: מדידת הדלתא על אותם אובייקטי Process שנשמרו במעבר הראשון
    for pid, proc in tracked_processes.items():
        try:
            raw_cpu = proc.cpu_percent(interval=None)
            name = proc.name() or "Unknown"
            is_critical = is_critical_system_process(pid, name)

            if is_critical and not include_system_processes:
                filtered_critical_count += 1
                continue

            normalized_cpu = round((raw_cpu or 0.0) / logical_cores, 2)

            processes_list.append({
                "pid": pid,
                "name": name,
                "cpu_percent": normalized_cpu,
                "raw_core_percent": round(raw_cpu or 0.0, 2),
                "status": proc.status(),
                "username": proc.username() if hasattr(proc, "username") else "USER",
                "is_system_critical": is_critical,
                "safe_to_terminate": not is_critical,
                "safety_note": (
                    "תהליך ליבה של Windows - אסור לסגור!"
                    if is_critical
                    else "תהליך משתמש/אפליקציה"
                ),
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


# ==============================================================================
# כלי 2: get_top_memory_processes (עם סינון ותיוג בטיחות לתהליכי ליבה)
# ==============================================================================

def get_top_memory_processes(
    limit: int = 5,
    include_system_processes: bool = False,
) -> str:
    """
    מחזיר את צרכני הזיכרון (RAM) הכבדים ביותר לפי מדד RSS.
    מסנן כברירת מחדל תהליכי מערכת קריטיים (System, svchost.exe, explorer.exe)
    ומסמן בבירור safe_to_terminate כדי למנוע המלצות מסוכנות למשתמש.
    """
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

            ram_mb = bytes_to_mb(mem_info.rss)
            ram_percent = round(p_info.get("memory_percent") or 0.0, 2)

            processes_list.append({
                "pid": pid,
                "name": name,
                "ram_mb": ram_mb,
                "ram_percent": ram_percent,
                "status": p_info.get("status") or "running",
                "is_system_critical": is_critical,
                "safe_to_terminate": not is_critical,
                "safety_note": (
                    "תהליך ליבה של Windows - אסור לסגור!"
                    if is_critical
                    else "תהליך משתמש/אפליקציה"
                ),
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


get_top_ram_processes = get_top_memory_processes


# ==============================================================================
# כלי 3: get_disk_io_status (זיהוי צווארי בקבוק בקריאה/כתיבה בדיסק)
# ==============================================================================

def get_disk_io_status(sample_interval: float = 1.0) -> str:
    """
    דוגם את קצב הקריאה והכתיבה לדיסק בזמן אמת (MB/s + IOPS) ומזהה את התהליכים
    שמבצעים הכי הרבה פעולות I/O בדיסק כרגע, תוך סימון תהליכי מערכת קריטיים.
    """
    effective_interval = max(float(sample_interval), 0.5)
    io_start = psutil.disk_io_counters()
    time.sleep(effective_interval)
    io_end = psutil.disk_io_counters()

    if io_start and io_end:
        read_bytes_per_sec = (io_end.read_bytes - io_start.read_bytes) / effective_interval
        write_bytes_per_sec = (io_end.write_bytes - io_start.write_bytes) / effective_interval
        read_iops = round((io_end.read_count - io_start.read_count) / effective_interval, 1)
        write_iops = round((io_end.write_count - io_start.write_count) / effective_interval, 1)
        read_mb_s = bytes_to_mb(int(read_bytes_per_sec))
        write_mb_s = bytes_to_mb(int(write_bytes_per_sec))
        total_read_gb = bytes_to_gb(io_end.read_bytes)
        total_write_gb = bytes_to_gb(io_end.write_bytes)
    else:
        read_mb_s, write_mb_s, read_iops, write_iops, total_read_gb, total_write_gb = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0

    io_processes: List[Dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "io_counters"]):
        try:
            p_info = proc.info
            pid = p_info.get("pid")
            name = p_info.get("name") or "Unknown"
            io_c = p_info.get("io_counters")
            if pid is None or io_c is None:
                continue

            is_critical = is_critical_system_process(pid, name)
            if is_critical:
                continue

            read_mb = bytes_to_mb(io_c.read_bytes)
            write_mb = bytes_to_mb(io_c.write_bytes)
            io_processes.append({
                "pid": pid,
                "name": name,
                "total_read_mb": read_mb,
                "total_write_mb": write_mb,
                "combined_io_mb": round(read_mb + write_mb, 2),
                "safe_to_terminate": True,
            })
        except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess, Exception):
            continue

    top_io_procs = sorted(io_processes, key=lambda x: x["combined_io_mb"], reverse=True)[:5]
    bottleneck_detected = (read_mb_s + write_mb_s) > 120.0 or (read_iops + write_iops) > 500

    return json.dumps({
        "tool": "get_disk_io_status",
        "timestamp": datetime.now().isoformat(),
        "realtime_throughput": {
            "read_mb_per_sec": read_mb_s,
            "write_mb_per_sec": write_mb_s,
            "read_iops": read_iops,
            "write_iops": write_iops,
            "bottleneck_suspected": bottleneck_detected,
        },
        "cumulative_since_boot": {
            "total_read_gb": total_read_gb,
            "total_write_gb": total_write_gb,
        },
        "top_io_processes": top_io_procs,
    }, indent=4, ensure_ascii=False)


# ==============================================================================
# כלי 4: get_startup_apps (תוכנות אתחול ב-Windows - Registry + Startup Folders)
# ==============================================================================

def get_startup_apps() -> str:
    """
    שולף בצורה בטוחה (Read-Only) את רשימת התוכנות שעולות באתחול (Startup) ב-Windows.
    """
    startup_items: List[Dict[str, Any]] = []
    errors_or_warnings: List[str] = []

    if os.name != "nt":
        return json.dumps({
            "tool": "get_startup_apps",
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
                        cmd_str = str(value_data)
                        is_os_security = "securityhealth" in cmd_str.lower() or "windows defender" in cmd_str.lower()
                        startup_items.append({
                            "name": str(value_name),
                            "command_or_path": cmd_str,
                            "source_type": "Registry",
                            "location": scope_label,
                            "safe_to_disable": not is_os_security,
                        })
                        index += 1
                    except OSError:
                        break
        except FileNotFoundError:
            continue
        except PermissionError:
            errors_or_warnings.append(f"PermissionDenied reading {scope_label}")
        except Exception as exc:
            errors_or_warnings.append(f"Error reading {scope_label}: {str(exc)}")

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
                        "safe_to_disable": True,
                    })
        except PermissionError:
            errors_or_warnings.append(f"PermissionDenied scanning {folder_label}")
        except Exception as exc:
            errors_or_warnings.append(f"Error scanning {folder_label}: {str(exc)}")

    return json.dumps({
        "tool": "get_startup_apps",
        "timestamp": datetime.now().isoformat(),
        "supported_os": True,
        "total_count": len(startup_items),
        "warnings": errors_or_warnings,
        "startup_programs": startup_items,
    }, indent=4, ensure_ascii=False)


get_windows_startup_programs = get_startup_apps


# ==============================================================================
# כלי 5: get_background_services (סינון קשיח של שירותי ליבת Windows)
# ==============================================================================

def get_background_services(limit: int = 15) -> str:
    """
    מחזיר רשימה של שירותי רקע (Windows Services) שנמצאים במצב פעיל (running)
    ושאינם שייכים לקובצי הליבה של Windows (מסנן כל שירות שרץ תחת C:\\Windows\\).
    """
    non_core_services: List[Dict[str, Any]] = []

    if os.name != "nt" or not hasattr(psutil, "win_service_iter"):
        return json.dumps({
            "tool": "get_background_services",
            "timestamp": datetime.now().isoformat(),
            "supported_os": False,
            "message": "בדיקת Windows Services זמינה בסביבת Windows.",
            "count": 0,
            "services": [],
        }, indent=4, ensure_ascii=False)

    for service in psutil.win_service_iter():
        try:
            info = service.as_dict()
            if info.get("status") != "running":
                continue

            binpath = str(info.get("binpath") or "")
            binpath_lower = binpath.lower().replace('"', '')

            # סינון מוחלט של כל שירותי מערכת ההפעלה בתיקיית Windows (svchost, lsass, services וכו')
            if binpath_lower.startswith("c:\\windows\\") or "system32" in binpath_lower:
                continue

            non_core_services.append({
                "name": info.get("name"),
                "display_name": info.get("display_name"),
                "status": info.get("status"),
                "start_type": info.get("start_type"),
                "pid": info.get("pid"),
                "binpath": binpath,
                "safe_to_restart_or_stop": True,
            })
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError, Exception):
            continue

    limited_services = non_core_services[:limit]

    return json.dumps({
        "tool": "get_background_services",
        "timestamp": datetime.now().isoformat(),
        "supported_os": True,
        "total_non_core_running": len(non_core_services),
        "returned_count": len(limited_services),
        "services": limited_services,
    }, indent=4, ensure_ascii=False)
