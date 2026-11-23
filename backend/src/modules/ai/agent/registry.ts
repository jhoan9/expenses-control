import { Agent } from './agent';
import { financeReadTools } from '../tools/finance-read.tools';
import { financeWriteTools } from '../tools/finance-write.tools';
import { marketTools } from '../tools/market.tools';
import { connectorTools } from '../tools/connector.tools';

/** Agente único con todas las herramientas del asistente. */
export const agent = new Agent([
  ...financeReadTools,
  ...marketTools,
  ...connectorTools.read,
  ...financeWriteTools,
  ...connectorTools.write,
]);
