"""
desktop_gui.py - ממשק גרפי לדסקטופ באמצעות Tkinter (סעיף 6 - שלב ד' במסמך האפיון).
כולל חלון הגדרות מובנה (כונן מערכת, בחירת מודל, כמות תהליכים והגדרות חיבור) ותצוגת 3 חלקי האבחון.
"""

import queue
import threading
import tkinter as tk
from tkinter import ttk, messagebox

from .config import AppConfig
from .ai_agent import run_diagnostic_workflow
from .models import DiagnosticFinalReport


class DiagnosticsDesktopApp:
    """
    אפליקציית דסקטופ מקומית ב-Tkinter המריצה את סוכן ה-AI ברקע (Thread נפרד)
    ומציגה את 3 חלקי הדוח לצד לשונית הגדרות מסודרת.
    """

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("AI System Diagnostics - כלי אבחון איטיות במחשב")
        self.root.geometry("980x720")
        self.root.minsize(760, 560)
        self.config = AppConfig()
        self.worker_events: queue.Queue[tuple[str, object]] = queue.Queue()

        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        self.tab_diagnostics = ttk.Frame(self.notebook, padding=16)
        self.tab_settings = ttk.Frame(self.notebook, padding=16)

        self.notebook.add(self.tab_diagnostics, text="  אבחון מערכת (AI Agent)  ")
        self.notebook.add(self.tab_settings, text="  הגדרות תצורה (Settings)  ")

        self._build_diagnostics_tab()
        self._build_settings_tab()
        self.root.after(100, self._poll_worker_events)

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

        # 3 תיבות תצוגה עבור 3 חלקי הדוח
        output_frame = ttk.Frame(self.tab_diagnostics)
        output_frame.pack(fill=tk.BOTH, expand=True)
        self.output_text = tk.Text(
            output_frame,
            wrap=tk.WORD,
            font=("Consolas", 11),
            bg="#0f172a",
            fg="#f8fafc",
            padx=14,
            pady=14,
            state=tk.DISABLED,
        )
        output_scrollbar = ttk.Scrollbar(output_frame, orient=tk.VERTICAL, command=self.output_text.yview)
        self.output_text.configure(yscrollcommand=output_scrollbar.set)
        self.output_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        output_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _build_settings_tab(self) -> None:
        ttk.Label(
            self.tab_settings,
            text="הגדרות סוכן הדיאגנוסטיקה (נשמר אל ~/.ai_system_diagnostics_config.json)",
            font=("Segoe UI", 11, "bold"),
        ).pack(anchor=tk.E, pady=(0, 16))

        form = ttk.Frame(self.tab_settings)
        form.pack(fill=tk.X)

        # מפתח API מקומי עבור הרצה על מחשב המשתמש
        ttk.Label(form, text="API Key (או דרך משתנה סביבה GEMINI_API_KEY):").grid(row=0, column=1, sticky=tk.E, pady=8)
        self.api_key_var = tk.StringVar(value=self.config.data.get("api_key", ""))
        ttk.Entry(form, textvariable=self.api_key_var, show="*", width=50).grid(row=0, column=0, sticky=tk.W, pady=8, padx=8)

        # שם המודל
        ttk.Label(form, text="שם מודל ה-AI:").grid(row=1, column=1, sticky=tk.E, pady=8)
        self.model_var = tk.StringVar(value=self.config.model_name)
        ttk.Combobox(
            form,
            textvariable=self.model_var,
            values=["gemini-3.8-flash", "gemini-4-argon"],
            width=47,
        ).grid(row=1, column=0, sticky=tk.W, pady=8, padx=8)

        # כונן מערכת
        ttk.Label(form, text="כונן מערכת לבדיקה:").grid(row=2, column=1, sticky=tk.E, pady=8)
        self.drive_var = tk.StringVar(value=self.config.system_drive)
        ttk.Entry(form, textvariable=self.drive_var, width=20).grid(row=2, column=0, sticky=tk.W, pady=8, padx=8)

        # כמות תהליכים לדגימה
        ttk.Label(form, text="מספר תהליכים מובילים (Limit):").grid(row=3, column=1, sticky=tk.E, pady=8)
        self.limit_var = tk.IntVar(value=self.config.default_process_limit)
        ttk.Spinbox(form, from_=3, to=15, textvariable=self.limit_var, width=18).grid(row=3, column=0, sticky=tk.W, pady=8, padx=8)

        save_btn = ttk.Button(self.tab_settings, text="שמור הגדרות", command=self._save_settings)
        save_btn.pack(anchor=tk.E, pady=16)

    def _save_settings(self) -> None:
        try:
            process_limit = int(self.limit_var.get())
            if not 3 <= process_limit <= 15:
                raise ValueError("מספר התהליכים חייב להיות בין 3 ל-15.")
            if not self.model_var.get().strip() or not self.drive_var.get().strip():
                raise ValueError("יש למלא שם מודל ונתיב כונן.")
            self.config.save({
                "api_key": self.api_key_var.get().strip(),
                "model_name": self.model_var.get().strip(),
                "system_drive": self.drive_var.get().strip(),
                "default_process_limit": process_limit,
            })
        except (OSError, ValueError) as exc:
            messagebox.showerror("שמירת הגדרות נכשלה", str(exc))
            return
        messagebox.showinfo("נשמר", "ההגדרות נשמרו בהצלחה לקובץ התצורה המקומי.")

    def _start_diagnosis_thread(self) -> None:
        issue = self.issue_entry.get().strip()
        if not issue:
            messagebox.showwarning("תיאור חסר", "יש לתאר את הבעיה לפני הפעלת האבחון.")
            return

        self.run_btn.config(state=tk.DISABLED)
        self.status_label.config(text="האבחון מתחיל...")
        self.output_text.config(state=tk.NORMAL)
        self.output_text.delete("1.0", tk.END)
        self.output_text.config(state=tk.DISABLED)

        def worker() -> None:
            try:
                report = run_diagnostic_workflow(
                    config=self.config,
                    user_issue_description=issue,
                    on_status_update=lambda msg: self.worker_events.put(("status", msg)),
                )
                self.worker_events.put(("report", report))
            except Exception as exc:
                self.worker_events.put(("error", str(exc)))
            finally:
                self.worker_events.put(("done", None))

        threading.Thread(target=worker, daemon=True).start()

    def _poll_worker_events(self) -> None:
        while True:
            try:
                event, payload = self.worker_events.get_nowait()
            except queue.Empty:
                break

            if event == "status":
                self.status_label.config(text=str(payload))
            elif event == "report":
                self._render_report(payload)
            elif event == "error":
                self.status_label.config(text="האבחון נכשל.")
                messagebox.showerror("שגיאה באבחון", str(payload))
            elif event == "done":
                self.run_btn.config(state=tk.NORMAL)

        self.root.after(100, self._poll_worker_events)

    def _render_report(self, report: DiagnosticFinalReport) -> None:
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

        self.output_text.config(state=tk.NORMAL)
        self.output_text.insert(tk.END, "\n".join(lines))
        self.output_text.config(state=tk.DISABLED)


def launch_desktop_gui() -> None:
    root = tk.Tk()
    DiagnosticsDesktopApp(root)
    root.mainloop()
