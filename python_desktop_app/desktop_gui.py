"""
desktop_gui.py - ממשק גרפי לדסקטופ באמצעות Tkinter (סעיף 6 - שלב ד' במסמך האפיון).
כולל חלון הגדרות מובנה (כונן מערכת, בחירת מודל, כמות תהליכים והגדרות חיבור) ותצוגת 3 חלקי האבחון.
"""

import threading
import tkinter as tk
from tkinter import ttk, messagebox

from .config import AppConfig
from .ai_agent import run_diagnostic_workflow


class DiagnosticsDesktopApp:
    """
    אפליקציית דסקטופ מקומית ב-Tkinter המריצה את סוכן ה-AI ברקע (Thread נפרד)
    ומציגה את 3 חלקי הדוח לצד לשונית הגדרות מסודרת.
    """

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

        # 3 תיבות תצוגה עבור 3 חלקי הדוח
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
        self.config.save({
            "api_key": self.api_key_var.get().strip(),
            "model_name": self.model_var.get().strip(),
            "system_drive": self.drive_var.get().strip(),
            "default_process_limit": int(self.limit_var.get()),
        })
        messagebox.showinfo("נשמר", "ההגדרות נשמרו בהצלחה לקובץ התצורה המקומי.")

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

        self.output_text.insert(tk.END, "\n".join(lines))


def launch_desktop_gui() -> None:
    root = tk.Tk()
    DiagnosticsDesktopApp(root)
    root.mainloop()
