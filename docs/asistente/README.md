# Asistente financiero con herramientas

El asistente del chat ("C") dejó de ser un chat que solo leía un resumen: ahora es un **agente** que
usa herramientas sobre tus datos reales, datos de mercado y APIs externas que tú autorices.

## Qué puede hacer

| Pídele… | Herramientas que usa |
|---|---|
| "Informe de mis finanzas del 1 de agosto a hoy" | `financial_report`: totales, tasa de ahorro, por categoría (con %), por mes, por cuenta, gastos más grandes, recurrentes y comparación con el periodo anterior |
| "¿Cuánto gasté en restaurantes en octubre?" / "muéstrame mis gastos con Nequi" | `query_transactions`: filtros por fechas, categoría, cuenta, texto y montos |
| "Registra 45 mil de mercado con Nequi" | `register_transaction` → **tarjeta para confirmar** |
| "Arma mi presupuesto de la próxima quincena" | `budget_planning_data` (promedios por categoría, deudas, presupuestos previos) → plan → `create_budget` → **confirmar** |
| "¿Mis categorías están bien?" | `analyze_categories`: nombres vagos, duplicados, sin uso, movimientos mal clasificados → `rename_category`, `create_category`, `recategorize_transactions` → **confirmar** |
| "Analiza Ecopetrol / Apple antes de invertir" | `search_symbol` + `analyze_stock`: precio, variaciones, 52 semanas, medias 20/50/200, RSI, MACD, Bollinger, ATR, volumen relativo, soportes y resistencias, volatilidad, drawdown, señales, escenarios y **tamaño de posición** según tu capital líquido |
| "Conecta una API de tasas de cambio" | `propose_connector` → **confirmar** → `call_connector` |
| "¿Cómo voy?" | `get_financial_overview`, `get_my_investments` |

**Nada se modifica sin tu confirmación**: registrar, renombrar, recategorizar, crear presupuestos o
autorizar una API generan una tarjeta en el chat con **Confirmar / Cancelar**. Las tarjetas vencen a las 24 h.

## Análisis de inversiones: qué es y qué no es

- Usa **datos diarios reales** del proveedor configurado y calcula los indicadores en el servidor (no los inventa la IA).
- El tamaño de posición limita la pérdida si toca el stop a un % de tu capital (1 % por defecto) **y** nunca
  sugiere más del 20 % del capital en un solo activo. Convierte USD→COP con la tasa del día.
- Antes de invertir revisa tu fondo de emergencia y tus deudas con interés alto.
- **No incluye** fundamentales (resultados, deuda, valoración) ni noticias.
- **Ningún análisis hace "segura" una inversión en acciones.** El asistente habla de probabilidades y riesgo
  controlado; es información educativa, no asesoría financiera certificada.

### Proveedor de datos de mercado

| `MARKET_DATA_PROVIDER` | Clave | Notas |
|---|---|---|
| `yahoo` (por defecto) | No | API no oficial: sin costo, pero puede limitar consultas o cambiar sin aviso |
| `twelvedata` | `TWELVE_DATA_API_KEY` | Plan gratuito con ~800 créditos/día; recomendado para producción. <https://twelvedata.com> |
| `alphavantage` | `ALPHA_VANTAGE_API_KEY` | Plan gratuito muy limitado (~25 consultas/día, 100 sesiones) |

Los resultados se guardan en caché 10 minutos por símbolo para no gastar cuota.
Acciones de la Bolsa de Colombia: depende del proveedor (en Yahoo suelen terminar en `.CL`, p. ej. `ECOPETROL.CL`;
también existe el ADR `EC` en NYSE). Pídele al asistente que busque el símbolo.

## Conectores de API externas (autoconfiguración)

El asistente puede **proponer** una API pública que necesite (por ejemplo, tasas de cambio o indicadores
económicos). Tú la apruebas en el chat y, si usa clave, la agregas en **Integraciones → Conectores de API**.
También puedes registrarlas tú directamente en esa pestaña.

Reglas de seguridad (no configurables por la IA):
- Solo **HTTPS**, solo **GET**, solo al **dominio registrado**; no sigue redirecciones.
- Bloquea localhost, redes privadas, metadatos de la nube (169.254.169.254) y dominios que resuelvan a IP privadas.
- Respuestas de máximo 200 KB, 10 s de espera, parámetros de máximo 200 caracteres (evita filtrar datos).
- Las claves se guardan **cifradas** (AES-256-GCM) y nunca se envían al modelo; si la API las refleja, se ocultan.
- El contenido de las APIs se le entrega al modelo marcado como **datos no confiables**.
- La IA nunca pide claves en el chat.

## Configuración (Render → Environment)

```
AI_API_KEY=...                      # ya existente (Gemini)
MARKET_DATA_PROVIDER=twelvedata     # opcional: yahoo | twelvedata | alphavantage
TWELVE_DATA_API_KEY=...             # si usas twelvedata
CONNECTORS_SECRET_KEY=...           # recomendado: 32+ caracteres aleatorios para cifrar claves de conectores
```

Si no defines `CONNECTORS_SECRET_KEY`, se deriva de `JWT_SECRET`. **Si cambias cualquiera de los dos después,
las claves de conectores guardadas dejan de poder descifrarse** y hay que volver a ingresarlas.

Base de datos: ejecutar una vez `backend/migrations/023_ai_agent.sql` (requiere la 022 aplicada antes).

## Arquitectura

```
Chat ─► POST /api/ai/conversations/:id/messages
         └─ Agent.run (backend/src/modules/ai/agent/agent.ts)
              ├─ Gemini con function calling (máx. 8 pasos)
              ├─ herramientas de lectura → se ejecutan y devuelven JSON (recortado a 14 KB)
              └─ herramientas de escritura → ai_pending_actions (status pending)
Tarjeta ─► POST /api/ai/actions/:id/confirm | cancel  → ejecuta (una sola vez) y deja el resultado en el chat
```

- Herramientas: `backend/src/modules/ai/tools/*.tools.ts` (agregar una nueva = un objeto con `name`, `description`,
  `parameters` y `run` o `prepare/execute`, registrado en `agent/registry.ts`).
- Indicadores técnicos: `backend/src/modules/market/indicators.ts` (con pruebas).
- Conectores: `backend/src/modules/ai/connectors/`.
