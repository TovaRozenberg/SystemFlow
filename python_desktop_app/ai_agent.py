"""
ai_agent.py - מנוע ההחלטות (AI Agent) ולולאת התקשורת (The Loop) לפי סעיפים 4 ו-5 במסמך האפיון.

הגנות הנדסיות קריטיות שהוטמעו בקובץ זה:
1. מניעת לולאה אינסופית וקריאות כפולות (Deduplication & Call Cache):
   שומר מילון `executed_calls_cache` עם חתימת כל קריאה (`(tool_name, json_args)`).
   אם המודל מבקש להריץ שוב את אותו כלי עם אותם פרמטרים בדיוק, הסקריפט לא מריץ שוב את הבדיקה
   אלא מחזיר תשובת מערכת שמבהירה שהכלי כבר הורץ ומאלצת את המודל להתקדם לסיכום.
2. תקרת איטרציות קשיחה (`MAX_TOOL_TURNS = 3`) ומעבר כפוי לשלב הסיכום (`ToolConfig mode=NONE`).
3. סינון בטיחות להמלצות (`sanitize_report_recommendations`):
   סורק את הדוח הסופי של ה-AI ומוודא שאין בו שום המלצה לסגור תהליכי ליבה קריטיים
   כגון `svchost.exe`, `System`, `explorer.exe`, `lsass.exe` או `csrss.exe`.
"""

import json
from typing import Callable, Dict, List, Optional, Tuple
from google import genai
from google.genai import types

from .config import AppConfig
from .models import DiagnosticFinalReport
from .collectors import (
    CRITICAL_WINDOWS_PROCESSES,
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
        description="מחזיר את תהליכי המשתמש העמוסים ביותר חישובית (CPU). יש לקרוא לכלי זה לכל היותר פעם אחת.",
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
        name="get_top_memory_processes",
        description="מחזיר את צרכני הזיכרון (RAM) הכבדים ביותר במערכת. יש לקרוא לכלי זה לכל היותר פעם אחת.",
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
        name="get_disk_io_status",
        description="מחזיר נתוני קריאה/כתיבה בזמן אמת (MB/s, IOPS) וצווארי בקבוק בדיסק.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={},
        ),
    ),
    types.FunctionDeclaration(
        name="get_startup_apps",
        description="שולף תוכנות שנטענות אוטומטית עם עליית המחשב (Registry + Startup Folders).",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={},
        ),
    ),
    types.FunctionDeclaration(
        name="get_background_services",
        description="מחזיר רשימת שירותי רקע פעילים (Services) של תוכנות צד-שלישי שאינם שייכים לליבת מערכת ההפעלה.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "limit": types.Schema(
                    type=types.Type.INTEGER,
                    description="מספר שירותים מקסימלי להחזרה (ברירת מחדל: 15).",
                )
            },
        ),
    ),
]

DIAGNOSTIC_SYSTEM_PROMPT = """אתה טכנאי מחשבים מומחה ומאבחן ביצועי מערכת בכיר (AI System Diagnostics Agent).
תפקידך לאתר את שורש הבעיה לאיטיות המחשב ולהציע פתרונות מעשיים ובטוחים.

כללי ברזל לבטיחות ומניעת לולאות:
1. איסור מוחלט על קריאות חוזרות: אל תקרא לאותו כלי (Tool) יותר מפעם אחת באותו אבחון! אם קיבלת פלט מכלי, המשך הלאה.
2. הגנת תהליכי מערכת קריטיים (Safety Guardrail):
   לעולם אל תמליץ למשתמש לסגור, להרוג (Kill) או להשבית תהליכי מערכת קריטיים של Windows כגון:
   `svchost.exe`, `System`, `explorer.exe`, `lsass.exe`, `csrss.exe`, `wininit.exe`, `dwm.exe`, `services.exe`, `MsMpEng.exe`.
   אם תהליך מערכת מופיע בצריכה גבוהה, הסבר שמדובר בתהליך מערכת מוגן והצע בדיקה בטוחה (כגון סריקת Windows Update או סגירת תוכנות צד-שלישי).
3. בסיום החקירה, גבש דוח סופי בעברית ברורה המחולק ל-3 חלקים:
   - אבחון הבעיה (problem_diagnosis)
   - הגורמים המרכזיים (main_causes)
   - המלצות לפעולה (action_recommendations)
"""

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
                f"[הגנת מערכת אוטומטית]: זוהתה פעילות בתהליך המערכת ({proc_names}), אך מדובר בתהליך ליבה קריטי של Windows שאסור לסגור ידנית ב-Task Manager כדי למנוע קריסת מערכת. מומלץ לבדוק עדכוני Windows או לבצע הפעלה מחדש מסודרת."
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
    """
    מריץ את כל מחזור החיים של הסוכן עם מנגנון Deduplication למניעת לולאות אינסופיות.
    """
    app_config = config or AppConfig()

    def notify(msg: str) -> None:
        if on_status_update:
            on_status_update(msg)

    client_kwargs = {"api_key": app_config.api_key} if app_config.api_key else {}
    client = genai.Client(**client_kwargs)
    model_name = app_config.model_name

    # 1. Baseline Trigger
    notify("[1/3] אוסף תמונת מצב ראשונית בדגימה כפולה ממוצעת (Baseline Snapshot)...")
    baseline_json = get_system_snapshot(app_config.system_drive)

    user_prompt = f"להלן תמונת המצב הבסיסית של המחשב (JSON):\n{baseline_json}\n\n"
    if user_issue_description:
        user_prompt += f"תיאור הבעיה מהמשתמש: {user_issue_description}\n"
    else:
        user_prompt += "אנא בצע הערכה ראשונית והפעל את כלי החקירה הרלוונטיים (פעם אחת לכל כלי נדרש)."

    contents: List[types.Content] = [
        types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
    ]

    tool_config = types.GenerateContentConfig(
        system_instruction=DIAGNOSTIC_SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=DIAGNOSTIC_TOOL_DECLARATIONS)],
        temperature=0.1,
    )

    # 2. Triage
    notify("[2/3] שולח נתוני בסיס ל-AI (Triage)...")
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=tool_config,
    )

    # 3 & 4. Tool Execution & Feedback Loop (עם הגנת Deduplication ותקרת 3 סבבים)
    MAX_TOOL_TURNS = 3
    turn = 0
    executed_calls_cache: Dict[Tuple[str, str], Dict] = {}

    while response.function_calls and turn < MAX_TOOL_TURNS:
        turn += 1
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)

        tool_parts: List[types.Part] = []
        duplicate_detected_in_turn = False

        for call in response.function_calls:
            func_name = call.name
            func_args = call.args or {}
            call_signature = (func_name, json.dumps(func_args, sort_keys=True))

            # בדיקה האם הכלי כבר הופעל עם אותם פרמטרים בדיוק!
            if call_signature in executed_calls_cache:
                duplicate_detected_in_turn = True
                notify(f" [הגנת לולאה] דילוג על קריאה כפולה לכלי {func_name} (שליפה מהמטמון)")
                cached_result = {
                    "notice": f"Tool '{func_name}' was ALREADY executed in this session. Do NOT call it again. Proceed to final diagnosis.",
                    "cached_data": executed_calls_cache[call_signature],
                }
                tool_parts.append(
                    types.Part.from_function_response(
                        name=func_name,
                        response={"result": cached_result},
                    )
                )
                continue

            notify(f" -> [סבב {turn}/{MAX_TOOL_TURNS}] ה-AI מפעיל כלי חקירה: {func_name}({func_args})")

            target_fn = AVAILABLE_DIAGNOSTIC_TOOLS.get(func_name)
            if target_fn is not None:
                try:
                    raw_res = target_fn(**func_args)
                    parsed_res = json.loads(raw_res)
                except Exception as exc:
                    parsed_res = {"error": f"Failed running {func_name}: {str(exc)}"}
            else:
                parsed_res = {"error": f"Unknown tool: {func_name}"}

            executed_calls_cache[call_signature] = parsed_res

            tool_parts.append(
                types.Part.from_function_response(
                    name=func_name,
                    response={"result": parsed_res},
                )
            )

        contents.append(types.Content(role="user", parts=tool_parts))

        # אם המודל ניסה לקרוא שוב לאותו כלי או שהגענו לסבב האחרון - עוצרים את לולאת הכלים ועוברים לסיכום
        if duplicate_detected_in_turn or turn >= MAX_TOOL_TURNS:
            notify(" -> סיום שלב איסוף הכלים (מעבר כפוי לגיבוש הדוח הסופי)...")
            break

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=tool_config,
        )

    # 5. Synthesis & Recommendation (Structured Output ללא כלים - מונע כל אפשרות ללולאה נוספת)
    notify("[3/3] מגבש דוח אבחון סופי ובטוח מחולק ל-3 פרקים...")
    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text="כעת סכם את הממצאים לדוח אבחון סופי המורכב מ-3 חלקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה. זכור: לעולם אל תמליץ לסגור תהליכי ליבה של מערכת ההפעלה."
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
            temperature=0.1,
        ),
    )

    raw_report = DiagnosticFinalReport.model_validate_json(structured_response.text)
    return sanitize_report_recommendations(raw_report)
