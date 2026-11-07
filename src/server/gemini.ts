import type { GoogleGenAI } from '@google/genai';

/**
 * Calls to Gemini that always finish inside the Vercel Function limit (60 s).
 *
 * Measured with this project's key (2026-11-07): gemini-2.5-flash answers in ~1-5 s, while
 * gemini-3.8-flash and gemini-flash-latest often take 13-40 s for a short question. The old code tried
 * the slow models first with no time limit, so requests ran past 60 s, Vercel cut them off and the
 * chat showed a canned fallback text instead of an answer.
 *
 * GEMINI_MODELS (comma separated) overrides the order. Each attempt gets a time budget and the whole
 * call stops before `deadlineMs`; the model that last answered is tried first next time.
 */
const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash'];
const DEFAULT_DEADLINE_MS = 45_000;
const FIRST_ATTEMPT_MS = 28_000;

let preferredModel: string | null = null;

export function geminiModels(): string[] {
  const configured = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const list = configured.length ? configured : DEFAULT_MODELS;
  return preferredModel && list.includes(preferredModel) ? [preferredModel, ...list.filter((m) => m !== preferredModel)] : list;
}

export class GeminiTimeoutError extends Error {}

export async function generateWithGemini(
  ai: GoogleGenAI,
  request: { contents: any; config?: any },
  options: { deadlineMs?: number } = {}
) {
  const deadline = Date.now() + (options.deadlineMs ?? DEFAULT_DEADLINE_MS);
  let lastError: unknown = null;
  const models = geminiModels();
  for (let i = 0; i < models.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;
    // A slow model must leave time for the next one: it gets at most 60% of what is left
    const budget = i < models.length - 1 ? Math.min(FIRST_ATTEMPT_MS, Math.round(remaining * 0.6)) : remaining;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          ...request,
          model: models[i],
          config: { ...(request.config || {}), abortSignal: controller.signal },
        }),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new GeminiTimeoutError(`${models[i]} took longer than ${budget} ms`)))
        ),
      ]);
      preferredModel = models[i];
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] ${models[i]} failed: ${err?.message || err}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new GeminiTimeoutError('No time left to ask the AI model');
}

export interface ChatTurn {
  role: string;
  content: string;
}

/**
 * Builds a valid Gemini conversation: user/model turns that alternate, start with the user and end
 * with the new question exactly once. Empty turns are dropped and long histories keep the recent part.
 */
export function buildChatContents(history: unknown, latestUserText: string, maxTurns = 14) {
  const turns: Array<{ role: 'user' | 'model'; text: string }> = [];
  const list = Array.isArray(history) ? (history as ChatTurn[]) : [];
  for (const item of list.slice(-maxTurns)) {
    const text = typeof item?.content === 'string' ? item.content.trim() : '';
    if (!text) continue;
    const role = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.text += `\n\n${text}`;
    else turns.push({ role, text });
  }
  while (turns.length && turns[0].role === 'model') turns.shift();
  // The client usually sends the new question as the last history item as well: keep it once
  const last = turns[turns.length - 1];
  if (last && last.role === 'user') turns.pop();
  turns.push({ role: 'user', text: latestUserText });
  return turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
}

/** Shared answering style: a real assistant for any question, formatted for the chat windows. */
export function answerStyle(locale: 'vi' | 'en'): string {
  return locale === 'en'
    ? `How to answer:
- Answer ANY question the user asks, like a capable general assistant: everyday topics, general knowledge, studying, coding, maths, advice, small talk. Never reply with a fixed or generic message; never refuse just because a question is outside electronics. If it relates to the platform, connect it naturally; if not, simply answer it well.
- Be accurate. If you are not sure, say so. Do not invent features of this website.
- Match the length to the question: short questions get short answers.
- Use Markdown when it helps: short paragraphs, **bold**, bullet or numbered lists, tables, \`code\`.
- Write formulas with LaTeX: inline $I = \\frac{V}{R}$, or on their own line with $$...$$. Use \\text{} for units, e.g. $220\\,\\Omega$.
- Reply in English.`
    : `Cách trả lời:
- Trả lời MỌI câu hỏi của người dùng như một trợ lý AI thực thụ: chuyện thường ngày, kiến thức chung, học tập, lập trình, toán, lời khuyên, trò chuyện. Không bao giờ trả lời bằng một câu cố định hay chung chung; không từ chối chỉ vì câu hỏi nằm ngoài chủ đề điện tử. Nếu câu hỏi liên quan đến nền tảng thì liên hệ tự nhiên; nếu không thì cứ trả lời thật tốt.
- Chính xác. Không chắc thì nói rõ. Không bịa tính năng của website.
- Độ dài vừa với câu hỏi: hỏi ngắn thì trả lời ngắn.
- Dùng Markdown khi giúp dễ đọc: đoạn ngắn, **in đậm**, danh sách gạch đầu dòng hoặc đánh số, bảng, \`code\`.
- Viết công thức bằng LaTeX: trong dòng $I = \\frac{U}{R}$, hoặc riêng một dòng với $$...$$. Đơn vị dùng \\text{}, ví dụ $220\\,\\Omega$.
- Trả lời bằng tiếng Việt tự nhiên.`;
}
