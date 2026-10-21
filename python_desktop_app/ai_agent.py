"""
ai_agent.py - מנוע ההחלטות (AI Agent) ולולאת התקשורת (The Loop) לפי סעיפים 4 ו-5 במסמך האפיון.
מגדיר את כל 5 הכלים ב-API, מנהל את רב-השיח, ומחזיר דוח מובנה של 3 חלקים.
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

# 1. מיפוי 5 כלי החקירה המקומיים לפי סעיף 5 במסמך האפיון
AVAILABLE_DIAGNOSTIC_TOOLS: Dict[str, Callable] = {
    "get_top_cpu_processes": get_top_cpu_processes,
    "get_top_memory_processes": get_top_memory_processes,
    "get_disk_io_status": get_disk_io_status,
    "get_startup_apps": get_startup_apps,
    "get_background_services": get_background_services,
}

# 2. הצהרת 5 הכלים עבור ה-API (Function Calling)
DIAGNOSTIC_TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_top_cpu_processes",
        description="מחזיר את התהליכים העמוסים ביותר חישובית (CPU).",
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
        description="מחזיר את צרכני הזיכרון (RAM) הכבדים ביותר במערכת.",
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
        description="מחזיר רשימת שירותי רקע פעילים (Services) שאינם שייכים לליבת מערכת ההפעלה.",
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
תפקידך לאתר את שורש הבעיה לאיטיות המחשב ולהציע פתרונות מעשיים.

זרימת העבודה שלך:
1. קבל את תמונת הבסיס (Baseline Snapshot: CPU %, RAM %, Disk Space).
2. בצע Triage (הערכה ראשונית) והחלט אילו מתוך 5 כלי החקירה להפעיל:
   - `get_top_cpu_processes` לבדיקת תהליכים שמעמיסים על המעבד.
   - `get_top_memory_processes` לבדיקת צרכני זיכרון RAM כבדים.
   - `get_disk_io_status` לבדיקת צווארי בקבוק בקריאה/כתיבה לדיסק.
   - `get_startup_apps` לבדיקת תוכנות שעולות עם הדלקת המחשב.
   - `get_background_services` לבדיקת שירותי רקע פעילים של תוכנות צד-שלישי.
3. בסיום החקירה, גבש דוח סופי בעברית ברורה המחולק ל-3 חלקים:
   - אבחון הבעיה (problem_diagnosis)
   - הגורמים המרכזיים (main_causes)
   - המלצות לפעולה (action_recommendations)
"""


def run_diagnostic_workflow(
    config: Optional[AppConfig] = None,
    user_issue_description: Optional[str] = None,
    on_status_update: Optional[Callable[[str], None]] = None,
) -> DiagnosticFinalReport:
    """
    מריץ את כל מחזור החיים של הסוכן (Baseline -> Triage -> Tool Execution Loop -> Synthesis).
    """
    app_config = config or AppConfig()

    def notify(msg: str) -> None:
        if on_status_update:
            on_status_update(msg)

    client_kwargs = {}
    if app_config.api_key:
        client_kwargs["api_key"] = app_config.api_key

    client = genai.Client(**client_kwargs)
    model_name = app_config.model_name

    # 1. Baseline Trigger
    notify("[1/3] אוסף תמונת מצב ראשונית (Baseline Snapshot)...")
    baseline_json = get_system_snapshot(app_config.system_drive)

    user_prompt = f"להלן תמונת המצב הבסיסית של המחשב (JSON):\n{baseline_json}\n\n"
    if user_issue_description:
        user_prompt += f"תיאור הבעיה מהמשתמש: {user_issue_description}\n"
    else:
        user_prompt += "אנא בצע הערכה ראשונית והפעל את כלי החקירה הרלוונטיים כדי לאתר צווארי בקבוק."

    contents: List[types.Content] = [
        types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
    ]

    tool_config = types.GenerateContentConfig(
        system_instruction=DIAGNOSTIC_SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=DIAGNOSTIC_TOOL_DECLARATIONS)],
        temperature=0.2,
    )

    # 2. Triage
    notify("[2/3] שולח נתוני בסיס ל-AI (Triage)...")
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=tool_config,
    )

    # 3 & 4. Tool Execution & Feedback Loop
    max_turns = 5
    turn = 0

    while response.function_calls and turn < max_turns:
        turn += 1
        if response.candidates and response.candidates[0].content:
            contents.append(response.candidates[0].content)

        tool_parts: List[types.Part] = []

        for call in response.function_calls:
            func_name = call.name
            func_args = call.args or {}
            notify(f" -> ה-AI מפעיל כלי חקירה: {func_name}({func_args})")

            target_fn = AVAILABLE_DIAGNOSTIC_TOOLS.get(func_name)
            if target_fn is not None:
                try:
                    raw_res = target_fn(**func_args)
                    parsed_res = json.loads(raw_res)
                except Exception as exc:
                    parsed_res = {"error": f"Failed running {func_name}: {str(exc)}"}
            else:
                parsed_res = {"error": f"Unknown tool: {func_name}"}

            tool_parts.append(
                types.Part.from_function_response(
                    name=func_name,
                    response={"result": parsed_res},
                )
            )

        contents.append(types.Content(role="user", parts=tool_parts))

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=tool_config,
        )

    # 5. Synthesis & Recommendation (Structured Output)
    notify("[3/3] מגבש דוח אבחון סופי מחולק ל-3 פרקים...")
    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text="כעת סכם את הממצאים לדוח אבחון סופי המורכב מ-3 חלקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה."
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
