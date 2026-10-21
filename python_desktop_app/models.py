"""
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
