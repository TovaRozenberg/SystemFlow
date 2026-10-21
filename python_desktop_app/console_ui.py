"""
console_ui.py - תצוגת קונסול עשירה ומסודרת באמצעות ספריית rich (סעיף 6 - שלב ד' במסמך האפיון).
מחלקת את הדוח ל-3 חלקים לוגיים ברורים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box

from .models import DiagnosticFinalReport


def display_diagnostic_report_in_console(report: DiagnosticFinalReport) -> None:
    """
    מדפיסה את דוח האבחון הסופי למסוף באמצעות ספריית rich.
    """
    console = Console()

    severity_color = "green"
    if "גבוה" in report.severity or "קריטי" in report.severity:
        severity_color = "red"
    elif "בינוני" in report.severity:
        severity_color = "yellow"

    console.rule("[bold white]דוח אבחון מערכת חכם · AI System Diagnostics[/bold white]", style="cyan")
    console.print()

    # 1. אבחון הבעיה (Panel)
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

    # 2. הגורמים המרכזיים (Table)
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

    # 3. המלצות לפעולה (Panel)
    recommendations_lines = [
        f"[bold green]{idx}.[/bold green] [white]{rec}[/white]"
        for idx, rec in enumerate(report.action_recommendations, start=1)
    ]

    recommendations_panel = Panel(
        "\n\n".join(recommendations_lines),
        title="[bold green]3. המלצות לפעולה[/bold green]",
        title_align="right",
        border_style="green",
        padding=(1, 2),
    )
    console.print(recommendations_panel)
    console.rule(style="dim cyan")
