import { z } from 'zod';
import { AIEventPlanSchema } from '@/lib/schemas/ai-plan.schema';
import {
  validateAIResponse,
  buildSafePrompt,
  AI_SAFETY_CONFIG,
  classifyAIError,
  isRetryableError,
  getRetryDelay,
  getRateLimitDelay,
  recordRequest,
} from '@/lib/ai/safety';

const RequestBodySchema = z.object({
  eventName: z.string().max(200),
  eventCategory: z.string(),
  eventDescription: z.string().max(2000).optional().default(''),
  startDate: z.string(),
  endDate: z.string(),
  expectedGuests: z.number().int().min(0),
  totalBudgetMajor: z.number().min(0),
  currency: z.string(),
  priorities: z.string().optional().default(''),
});

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'Gemini API key not configured. Set GEMINI_API_KEY in .env.local' },
      { status: 501 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // Rate limit check
  const delay = getRateLimitDelay();
  if (delay > 0) {
    return Response.json(
      { error: `Rate limited. Please wait ${Math.ceil(delay / 1000)} seconds.` },
      { status: 429 }
    );
  }

  const systemInstruction = `You are an expert event planner. Generate a comprehensive event plan as a JSON object.
The plan must include a budget breakdown, task checklist, risk assessment, vendor categories, theme ideas, and practical tips.
All budget amounts should be in ${input.currency} major units and must sum to approximately ${input.totalBudgetMajor} total.
Tasks should have practical due dates as offset days from the event start date (negative = before event, 0 = event day, positive = after).
Return ONLY a valid JSON object with this exact structure:
{
  "summary": "brief event plan summary",
  "themeIdeas": ["theme 1", "theme 2", ...],
  "budgetItems": [{ "name": "item", "category": "venue|catering|decoration|entertainment|photography|transportation|accommodation|marketing|equipment|staffing|miscellaneous", "estimatedAmountMajor": 1000, "notes": "details" }],
  "tasks": [{ "title": "task", "description": "details", "priority": "low|medium|high|critical", "dueOffsetDays": -7 }],
  "risks": [{ "description": "risk", "severity": "low|medium|high|critical", "likelihood": "unlikely|possible|likely|very_likely", "mitigation": "how to prevent", "contingency": "backup plan" }],
  "vendorCategories": [{ "service": "service type", "description": "what they provide", "estimatedBudgetMajor": 500 }],
  "tips": ["tip 1", "tip 2", ...]
}`;

  const prompt = buildSafePrompt(systemInstruction, {
    eventName: input.eventName,
    eventCategory: input.eventCategory,
    eventDescription: input.eventDescription,
    dates: `${input.startDate} to ${input.endDate}`,
    expectedGuests: String(input.expectedGuests),
    totalBudget: `${input.totalBudgetMajor} ${input.currency}`,
    priorities: input.priorities,
  });

  // Attempt with retry
  let lastError = '';
  for (let attempt = 0; attempt <= AI_SAFETY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      recordRequest();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_SAFETY_CONFIG.REQUEST_TIMEOUT_MS);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        let providerError = '';
        let providerStatus = '';
        try {
          const errorJson = await response.json();
          providerError = errorJson?.error?.message || '';
          providerStatus = errorJson?.error?.status || '';
        } catch {
          try {
            providerError = await response.text();
          } catch {
            // ignore fallback error
          }
        }

        const errorType = classifyAIError(response.status);
        if (isRetryableError(errorType) && attempt < AI_SAFETY_CONFIG.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, getRetryDelay(attempt)));
          continue;
        }

        const detailedMessage = providerError
          ? `AI provider error: ${providerError}${providerStatus ? ` (${providerStatus} ${response.status})` : ` (${response.status})`}`
          : `AI provider error: ${errorType} (${response.status})`;

        return Response.json(
          {
            error: detailedMessage,
            status: response.status,
            code: providerStatus || errorType,
          },
          { status: 502 }
        );
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = 'Empty response from AI';
        if (attempt < AI_SAFETY_CONFIG.MAX_RETRIES) continue;
        return Response.json({ error: lastError }, { status: 502 });
      }

      const validated = validateAIResponse(text, AIEventPlanSchema);
      if (!validated.success) {
        return Response.json(
          { error: `AI response validation failed: ${validated.error}`, code: validated.code },
          { status: 422 }
        );
      }

      return Response.json({ plan: validated.data });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = 'Request timed out';
        if (attempt < AI_SAFETY_CONFIG.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, getRetryDelay(attempt)));
          continue;
        }
      }
      lastError = err instanceof Error ? err.message : 'Unknown error';
      if (attempt < AI_SAFETY_CONFIG.MAX_RETRIES) continue;
    }
  }

  return Response.json({ error: lastError || 'Failed to generate plan' }, { status: 500 });
}
