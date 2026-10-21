"""
main.py - נקודת הכניסה הראשית של אפליקציית הדסקטופ בפייתון.
מאפשרת הרצה במצב גרפי (Tkinter Desktop GUI) או במצב קונסול עשיר (Rich CLI).

דוגמאות הרצה:
  python -m python_desktop_app.main --gui      # פתיחת חלון אפליקציית הדסקטופ (כולל לשונית הגדרות)
  python -m python_desktop_app.main --cli      # הרצה בטרמינל עם תצוגת Rich מחולקת ל-3 חלקים
"""

import argparse
from rich.console import Console

from .config import AppConfig
from .ai_agent import run_diagnostic_workflow
from .console_ui import display_diagnostic_report_in_console
from .desktop_gui import launch_desktop_gui


def main() -> None:
    parser = argparse.ArgumentParser(description="AI System Diagnostics Desktop Tool")
    parser.add_argument(
        "--gui",
        action="store_true",
        help="הפעל את ממשק המשתמש הגרפי לדסקטופ (Tkinter GUI עם מסך הגדרות).",
    )
    parser.add_argument(
        "--issue",
        type=str,
        default="המחשב מרגיש איטי וגם לוקח לו הרבה זמן לעלות בהדלקה. תבדוק מה מעמיס עליו.",
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
