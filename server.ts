import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, FunctionDeclaration, Content, Part, Schema } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DIAGNOSTIC_SYSTEM_PROMPT = `אתה טכנאי מחשבים מומחה ומאבחן ביצועי מערכת בכיר (AI System Diagnostics Agent).
תפקידך לקבל את 'תמונת המצב הכללית' (System Snapshot) של המחשב בפורמט JSON ולנתח את בריאות המערכת.

הנחיות עבודה לפי מסמך האפיון:
1. בחן תחילה את תמונת המצב הכללית (אחוז שימוש ב-CPU, אחוז ניצול זיכרון RAM, ושטח פנוי בכונן המערכת).
2. בצע Triage והפעל את כלי החקירה הרלוונטיים מתוך 5 הכלים העומדים לרשותך:
   - get_top_cpu_processes לבדיקת התהליכים העמוסים ביותר חישובית.
   - get_top_memory_processes לבדיקת צרכני הזיכרון (RAM) הכבדים ביותר.
   - get_disk_io_status לבדיקת נתוני קריאה/כתיבה וצווארי בקבוק בדיסק.
   - get_startup_apps לבדיקת תוכנות שנטענות אוטומטית עם עליית המחשב.
   - get_background_services לבדיקת שירותי רקע פעילים שאינם שייכים לליבת המערכת.
3. לאחר שקיבלת את תוצאות הכלים, ספק למשתמש דוח אבחון ברור, מקצועי ומסודר בעברית המחולק ל-3 חלקים ברורים:
   - אבחון הבעיה (problem_diagnosis)
   - הגורמים המרכזיים (main_causes)
   - המלצות לפעולה (action_recommendations)`;

const diagnosticToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_top_cpu_processes',
    description: 'מחזיר את התהליכים העמוסים ביותר חישובית (CPU).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: 'מספר התהליכים המובילים להחזרה (ברירת מחדל: 5).',
        },
      },
    },
  },
  {
    name: 'get_top_memory_processes',
    description: 'מחזיר את צרכני הזיכרון (RAM) הכבדים ביותר במערכת.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: 'מספר התהליכים המובילים להחזרה (ברירת מחדל: 5).',
        },
      },
    },
  },
  {
    name: 'get_disk_io_status',
    description: 'מחזיר נתוני קריאה/כתיבה בזמן אמת (MB/s, IOPS) וצווארי בקבוק בדיסק.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_startup_apps',
    description: 'שולף תוכנות שנטענות אוטומטית עם עליית המחשב (Registry + Startup Folders).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_background_services',
    description: 'מחזיר רשימת שירותי רקע פעילים (Services) שאינם שייכים לליבת מערכת ההפעלה.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: 'מספר שירותים מקסימלי להחזרה (ברירת מחדל: 15).',
        },
      },
    },
  },
];

const finalReportResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    severity: {
      type: Type.STRING,
      description: "רמת החומרה הכוללת: 'תקין', 'עומס בינוני', או 'עומס גבוה / קריטי'.",
    },
    problem_diagnosis: {
      type: Type.STRING,
      description: 'חלק 1 - אבחון הבעיה: סיכום ברור וממוקד של מצב המערכת והבעיה המרכזית שזוהתה.',
    },
    main_causes: {
      type: Type.ARRAY,
      description: 'חלק 2 - הגורמים המרכזיים: רשימת הגורמים והתהליכים הספציפיים שיוצרים את העומס.',
      items: {
        type: Type.OBJECT,
        properties: {
          component_or_process: {
            type: Type.STRING,
            description: 'שם התהליך, השירות, תוכנת האתחול או רכיב החומרה (למשל: chrome.exe, Disk I/O, Docker Desktop).',
          },
          metric_or_evidence: {
            type: Type.STRING,
            description: "הנתון המדויק שנמצא מהכלים (למשל: '38.4% CPU', '8420 MB RAM', 'Write: 145 MB/s').",
          },
          impact_explanation: {
            type: Type.STRING,
            description: 'הסבר קצר כיצד גורם זה משפיע על ביצועי המחשב.',
          },
        },
        required: ['component_or_process', 'metric_or_evidence', 'impact_explanation'],
      },
    },
    action_recommendations: {
      type: Type.ARRAY,
      description: 'חלק 3 - המלצות לפעולה: צעדים מעשיים, ברורים ובטוחים לביצוע על ידי המשתמש.',
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ['severity', 'problem_diagnosis', 'main_causes', 'action_recommendations'],
};

interface ToolTraceStep {
  step: number;
  toolName: string;
  args: Record<string, unknown>;
  resultPreview: unknown;
}

app.post('/api/diagnose', async (req, res) => {
  try {
    const {
      snapshot,
      topCpuReport,
      topMemoryReport,
      diskIoReport,
      startupReport,
      backgroundServicesReport,
      userIssue,
    } = req.body;

    const userPrompt =
      `להלן תמונת המצב הכללית של המחשב שלי כרגע (JSON):\n` +
      `${JSON.stringify(snapshot, null, 2)}\n\n` +
      (userIssue
        ? `תלונת המשתמש / מיקוד הבדיקה: ${userIssue}\n`
        : `אנא נתח את תמונת המצב והפעל את הכלים המתאימים מתוך 5 הכלים שלך.`);

    const contents: Content[] = [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ];

    const toolTrace: ToolTraceStep[] = [];
    const modelName = 'gemini-3.8-flash';

    let response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: DIAGNOSTIC_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: diagnosticToolDeclarations }],
        temperature: 0.2,
      },
    });

    let turnCount = 0;
    const maxToolTurns = 5;

    while (response.functionCalls && response.functionCalls.length > 0 && turnCount < maxToolTurns) {
      turnCount += 1;
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      const functionResponseParts: Part[] = [];

      for (const call of response.functionCalls) {
        const funcName = call.name || 'unknown';
        const funcArgs = (call.args as Record<string, unknown>) || {};
        let toolOutput: unknown = {};

        if (funcName === 'get_top_cpu_processes') {
          const limit = typeof funcArgs.limit === 'number' ? funcArgs.limit : 5;
          toolOutput = {
            ...topCpuReport,
            processes: Array.isArray(topCpuReport?.processes)
              ? topCpuReport.processes.slice(0, limit)
              : [],
          };
        } else if (funcName === 'get_top_memory_processes') {
          const limit = typeof funcArgs.limit === 'number' ? funcArgs.limit : 5;
          toolOutput = {
            ...topMemoryReport,
            processes: Array.isArray(topMemoryReport?.processes)
              ? topMemoryReport.processes.slice(0, limit)
              : [],
          };
        } else if (funcName === 'get_disk_io_status') {
          toolOutput = diskIoReport;
        } else if (funcName === 'get_startup_apps') {
          toolOutput = startupReport;
        } else if (funcName === 'get_background_services') {
          toolOutput = backgroundServicesReport;
        } else {
          toolOutput = { error: `Unknown tool: ${funcName}` };
        }

        toolTrace.push({
          step: turnCount,
          toolName: funcName,
          args: funcArgs,
          resultPreview: toolOutput,
        });

        functionResponseParts.push({
          functionResponse: {
            name: funcName,
            response: { result: toolOutput },
          },
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponseParts,
      });

      response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: DIAGNOSTIC_SYSTEM_PROMPT,
          tools: [{ functionDeclarations: diagnosticToolDeclarations }],
          temperature: 0.2,
        },
      });
    }

    contents.push({
      role: 'user',
      parts: [
        {
          text: 'כעת הפק את דוח האבחון הסופי בפורמט המובנה המחולק ל-3 חלקים: אבחון הבעיה, הגורמים המרכזיים, והמלצות לפעולה.',
        },
      ],
    });

    const structuredResponse = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: DIAGNOSTIC_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: finalReportResponseSchema,
        temperature: 0.2,
      },
    });

    let structuredReport = null;
    try {
      structuredReport = JSON.parse(structuredResponse.text || '{}');
    } catch {
      structuredReport = null;
    }

    res.json({
      report: response.text || '',
      structuredReport,
      toolTrace,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאה בלתי צפויה בשרת ה-AI';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
