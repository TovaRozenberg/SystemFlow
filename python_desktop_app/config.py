"""
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
    "system_drive": "C:\\",
    "default_process_limit": 5,
    "cpu_sample_interval": 1.0,
}


class AppConfig:
    """
    מנהל את הגדרות האפליקציה המקומית (כונן ברירת מחדל, מודל, מפתח API ופרמטרי דגימה).
    מאפשר קריאה ועדכון מתוך מסך ההגדרות של אפליקציית הדסקטופ או מהטרמינל.
    """

    def __init__(self, config_path: Path = CONFIG_FILE_PATH) -> None:
        self.config_path = config_path
        self.data: Dict[str, Any] = dict(DEFAULT_CONFIG)
        self.load()

    def load(self) -> Dict[str, Any]:
        """טוען הגדרות מקובץ ה-JSON המקומי או ממשתני הסביבה."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if isinstance(saved, dict):
                        self.data.update(saved)
            except Exception:
                pass

        # עדיפות למשתנה סביבה אם לא הוגדר בקובץ המקומי
        env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if env_key and not self.data.get("api_key"):
            self.data["api_key"] = env_key

        return self.data

    def save(self, updates: Dict[str, Any]) -> None:
        """שומר עדכוני הגדרות (כגון שינוי מודל, כונן או מפתח) לקובץ ההגדרות המקומי."""
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
        return str(self.data.get("system_drive", "C:\\"))

    @property
    def default_process_limit(self) -> int:
        return int(self.data.get("default_process_limit", 5))
