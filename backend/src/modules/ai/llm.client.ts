import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';

export interface LLMMessage {
  role: 'user' | 'model';
  text: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
}

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 3000];

const isTransient = (data: GeminiResponse | null, status: number): boolean => {
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const msg = (data?.error?.message || '').toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('try again later')
  );
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const chatCompletion = async (
  system: string,
  messages: LLMMessage[],
  temperature = 0.7
): Promise<string> => {
  if (!env.AI_API_KEY) {
    throw new AppError('El asistente no está configurado.', 503);
  }

  const url = `${env.AI_BASE_URL}/models/${encodeURIComponent(
    env.AI_MODEL
  )}:generateContent?key=${encodeURIComponent(env.AI_API_KEY)}`;

  const buildBody = (useThinkingLimit: boolean) => ({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
      ...(useThinkingLimit
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  });

  const call = (useThinkingLimit: boolean, signal: AbortSignal): Promise<Response> =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(buildBody(useThinkingLimit)),
    });

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.AI_REQUEST_TIMEOUT_MS
    );

    try {
      let response = await call(true, controller.signal);

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as GeminiResponse | null;

        if (data?.error?.message && /thinking/i.test(data.error.message)) {
          response = await call(false, controller.signal);
        } else if (isTransient(data, response.status)) {
          if (attempt < MAX_RETRIES) {
            clearTimeout(timeout);
            await sleep(RETRY_DELAYS_MS[attempt] ?? 3000);
            continue;
          }
        }

        const detail =
          data?.error?.message || `Error del modelo (${response.status})`;
        throw new AppError(
          `El modelo de IA respondió con un error: ${detail}`,
          attempt === MAX_RETRIES && response.status === 429 ? 429 : 502
        );
      }

      const data = (await response.json()) as GeminiResponse;

      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
        '';
      if (!text.trim()) {
        throw new AppError('El modelo de IA no devolvió una respuesta.', 502);
      }
      return text.trim();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if ((error as Error).name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          clearTimeout(timeout);
          await sleep(RETRY_DELAYS_MS[attempt] ?? 3000);
          continue;
        }
        throw new AppError(
          'El asistente tardó demasiado en responder. Intenta de nuevo.',
          504
        );
      }
      if (attempt < MAX_RETRIES) {
        clearTimeout(timeout);
        await sleep(RETRY_DELAYS_MS[attempt] ?? 3000);
        continue;
      }
      throw new AppError(
        'No se pudo conectar con el modelo de IA. Intenta de nuevo.',
        502
      );
    } finally {
      clearTimeout(timeout);
    }
  }
};