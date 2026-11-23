/**
 * Herramientas del asistente.
 *
 * - "read": se ejecutan de inmediato y devuelven datos al modelo.
 * - "write": modifican datos. El modelo solo puede PROPONERLAS: se crea una
 *   acción pendiente que el usuario confirma o cancela desde el chat.
 */

export interface ToolContext {
  userId: number;
  conversationId: number;
}

export type JsonSchema = Record<string, unknown>;

interface ToolBase {
  name: string;
  /** Lo que lee el modelo para decidir cuándo usarla. */
  description: string;
  /** Esquema JSON (subconjunto OpenAPI que acepta Gemini). */
  parameters: JsonSchema;
  /** Etiqueta corta para mostrar en el chat ("Consultó movimientos"). */
  label: string;
}

export interface ReadTool extends ToolBase {
  kind: 'read';
  run(ctx: ToolContext, args: Record<string, any>): Promise<unknown>;
}

export interface PreparedAction {
  /** Texto que verá el usuario en la tarjeta de confirmación. */
  summary: string;
  /** Argumentos ya validados y normalizados que se guardan para ejecutar luego. */
  args: Record<string, unknown>;
}

export interface WriteTool extends ToolBase {
  kind: 'write';
  /** Valida y resuelve los argumentos sin modificar nada. Lanza AppError si no es posible. */
  prepare(ctx: ToolContext, args: Record<string, any>): Promise<PreparedAction>;
  /** Ejecuta la acción ya confirmada. Devuelve un mensaje para el usuario. */
  execute(ctx: ToolContext, args: Record<string, any>): Promise<string>;
}

export type Tool = ReadTool | WriteTool;

export interface ToolTrace {
  name: string;
  label: string;
  ok: boolean;
}

export interface ProposedAction {
  id: number;
  tool: string;
  summary: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed' | 'expired';
  result?: string | null;
}
