import { AppError } from '../../../shared/errors/AppError';
import { FunctionDeclaration, GeminiContent, GeminiPart, generateContent, textOf } from '../llm.client';
import { AgentActionsService } from './actions.service';
import { ProposedAction, Tool, ToolContext, ToolTrace, WriteTool } from './types';

/** Modelo inyectable (en pruebas se reemplaza por uno guionizado). */
export type ModelFn = (input: {
  system: string;
  contents: GeminiContent[];
  tools: FunctionDeclaration[];
}) => Promise<GeminiContent>;

const defaultModel: ModelFn = ({ system, contents, tools }) =>
  generateContent({ system, contents, tools, temperature: 0.4, maxOutputTokens: 4096 });

const MAX_STEPS = 8;
const MAX_TOOL_RESULT_CHARS = 14_000;

export interface AgentResult {
  text: string;
  tools: ToolTrace[];
  actions: ProposedAction[];
}

const truncate = (value: unknown): Record<string, unknown> => {
  const json = JSON.stringify(value ?? null);
  if (json.length <= MAX_TOOL_RESULT_CHARS) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { result: value };
  }
  return {
    truncated: true,
    note: 'El resultado era muy grande y se recortó. Pide un rango o filtro más pequeño si necesitas el detalle.',
    partial: json.slice(0, MAX_TOOL_RESULT_CHARS),
  };
};

export class Agent {
  private readonly tools = new Map<string, Tool>();
  readonly actions: AgentActionsService;
  model: ModelFn = defaultModel;

  constructor(tools: Tool[]) {
    for (const t of tools) this.tools.set(t.name, t);
    this.actions = new AgentActionsService((name) => {
      const t = this.tools.get(name);
      return t?.kind === 'write' ? (t as WriteTool) : undefined;
    });
  }

  get declarations(): FunctionDeclaration[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.kind === 'write'
        ? `${t.description} (ACCIÓN QUE MODIFICA DATOS: al llamarla se le muestra al usuario una tarjeta para confirmar; no se ejecuta hasta que confirme.)`
        : t.description,
      // Gemini rechaza objetos sin propiedades: las herramientas sin argumentos van sin esquema
      ...(Object.keys((t.parameters as any)?.properties ?? {}).length ? { parameters: t.parameters } : {}),
    }));
  }

  /**
   * Bucle del agente: el modelo pide herramientas, se ejecutan las de lectura,
   * las de escritura se convierten en acciones pendientes, y se repite hasta
   * que el modelo responde solo con texto (o se alcanza el límite de pasos).
   */
  async run(ctx: ToolContext, system: string, history: GeminiContent[]): Promise<AgentResult> {
    const contents: GeminiContent[] = [...history];
    const traces: ToolTrace[] = [];
    const actions: ProposedAction[] = [];
    const declarations = this.declarations;

    for (let step = 0; step < MAX_STEPS; step++) {
      const reply = await this.model({ system, contents, tools: declarations });
      const calls = reply.parts.filter((p) => p.functionCall);

      if (!calls.length) {
        const text = textOf(reply);
        if (!text && !actions.length) throw new AppError('El modelo de IA no devolvió una respuesta.', 502);
        return { text, tools: traces, actions };
      }

      // Se devuelve el turno del modelo tal cual (incluye firmas de razonamiento)
      contents.push({ role: 'model', parts: reply.parts });

      const responses: GeminiPart[] = [];
      for (const part of calls) {
        const { name, args = {} } = part.functionCall!;
        const tool = this.tools.get(name);
        let response: Record<string, unknown>;

        if (!tool) {
          response = { error: `La herramienta "${name}" no existe.` };
          traces.push({ name, label: name, ok: false });
        } else {
          try {
            if (tool.kind === 'read') {
              response = truncate(await tool.run(ctx, args));
            } else {
              const prepared = await tool.prepare(ctx, args);
              const action = await this.actions.create(ctx.userId, ctx.conversationId, tool.name, prepared.args, prepared.summary);
              actions.push(action);
              response = {
                status: 'pending_user_confirmation',
                action_id: action.id,
                summary: prepared.summary,
                instructions:
                  'La acción NO se ha ejecutado. El usuario verá una tarjeta con botones Confirmar/Cancelar. ' +
                  'Dile brevemente qué propones y que confirme en la tarjeta. No digas que ya se hizo.',
              };
            }
            traces.push({ name, label: tool.label, ok: true });
          } catch (err) {
            const message =
              err instanceof AppError && err.statusCode < 500
                ? err.message
                : 'La herramienta falló. Explícale al usuario que no pudiste obtener ese dato.';
            if (!(err instanceof AppError)) console.error('[ai] Herramienta falló', name, (err as Error).message);
            response = { error: message };
            traces.push({ name, label: tool.label, ok: false });
          }
        }
        responses.push({ functionResponse: { name, response } });
      }
      contents.push({ role: 'user', parts: responses });
    }

    return {
      text: 'Necesité demasiados pasos para responder. ¿Puedes hacer la pregunta más concreta (por ejemplo, con un rango de fechas)?',
      tools: traces,
      actions,
    };
  }
}
