# Guía: conectar el bot de WhatsApp (WhatsApp Cloud API de Meta)

Esta guía deja funcionando el bot que registra gastos e ingresos desde WhatsApp.
El código ya está listo en el backend (`backend/src/modules/whatsapp`). Lo único que falta
es crear la cuenta en Meta y poner 6 variables de entorno en Render.

> Las pantallas de Meta cambian con frecuencia. Si un botón no se llama exactamente igual,
> busca la opción equivalente; la documentación oficial está en
> <https://developers.facebook.com/docs/whatsapp/cloud-api/get-started>.

---

## Resumen

| Qué | Dónde se obtiene | Variable en Render |
|---|---|---|
| Token de acceso | Meta → Usuario del sistema → Generar token | `WHATSAPP_ACCESS_TOKEN` |
| ID del número | Meta → WhatsApp → Configuración de la API | `WHATSAPP_PHONE_NUMBER_ID` |
| Clave secreta de la app | Meta → Configuración de la app → Básica | `WHATSAPP_APP_SECRET` |
| Token de verificación | **Lo inventas tú** (una frase larga al azar) | `WHATSAPP_VERIFY_TOKEN` |
| Número del bot | El número que registres, solo dígitos con indicativo (ej. `573001234567`) | `WHATSAPP_BOT_NUMBER` |
| Clave de IA (opcional, ya la tienes para el asistente) | Google AI Studio | `AI_API_KEY` |

Opcionales: `WHATSAPP_API_VERSION` (por defecto `v21.0`) y `APP_TIMEZONE` (por defecto `America/Bogota`).

---

## Paso 0 — Antes de empezar

- **Un número de teléfono dedicado para el bot.** Puede ser una SIM nueva o una línea virtual.
  **No** puede estar registrado en la app normal de WhatsApp ni en WhatsApp Business del celular
  (si lo está, tendrás que borrar esa cuenta primero). Para las pruebas iniciales puedes usar el
  **número de prueba gratuito** que te da Meta y dejar el número propio para después.
- Una cuenta personal de Facebook (para entrar a Meta for Developers).
- Acceso al panel de Render del backend (`expenses-control-api`).

## Paso 1 — Aplicar la migración de base de datos

La función necesita tablas nuevas. Ejecuta una sola vez contra la base de datos de producción
(con la misma conexión que usa el backend):

```bash
psql "$DATABASE_URL" -c "SET search_path TO expenses_control" -f backend/migrations/022_integrations.sql
```

Si tu proveedor de base de datos tiene una consola SQL, también puedes pegar ahí el contenido
de `backend/migrations/022_integrations.sql` (asegúrate de estar en el esquema `expenses_control`).

## Paso 2 — Crear la app en Meta

1. Entra a <https://developers.facebook.com/apps> y pulsa **Crear app**.
2. Caso de uso: **Otro** → tipo de app: **Negocio (Business)**.
3. Ponle un nombre (por ejemplo "Controla") y asóciala a un **portafolio comercial** (Business
   Manager). Si no tienes uno, el asistente te deja crearlo.
4. En el panel de la app, busca el producto **WhatsApp** y pulsa **Configurar**.

## Paso 3 — Número y credenciales de prueba

1. Ve a **WhatsApp → Configuración de la API** (API Setup).
2. Verás un **número de prueba** y su **ID del número de teléfono** (Phone number ID).
   Copia ese ID → será `WHATSAPP_PHONE_NUMBER_ID`.
3. En **Para (To)**, agrega tu número personal y confírmalo con el código que te llega.
   En modo de prueba, el bot solo puede escribirle a números agregados aquí (hasta 5).
4. Copia la **clave secreta de la app**: **Configuración de la app → Básica → Clave secreta de la app**
   → será `WHATSAPP_APP_SECRET`. El backend la usa para comprobar que cada mensaje viene de Meta.

## Paso 4 — Token de acceso permanente

El token que aparece en "Configuración de la API" **vence en 24 horas**; sirve solo para una prueba rápida.
Para producción crea uno permanente:

1. Ve a **business.facebook.com → Configuración del negocio → Usuarios → Usuarios del sistema**.
2. **Agregar** → nombre "controla-bot" → rol **Administrador**.
3. **Asignar activos** → **Apps** → tu app → control total. Asigna también la **cuenta de WhatsApp**.
4. **Generar nuevo token** → elige tu app → vencimiento **Nunca** → permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`.
5. Copia el token → será `WHATSAPP_ACCESS_TOKEN`. Guárdalo en un gestor de contraseñas: no se vuelve a mostrar.

## Paso 5 — Variables en Render

En Render → servicio del backend → **Environment** agrega:

```
WHATSAPP_ACCESS_TOKEN=EAAG...            # paso 4
WHATSAPP_PHONE_NUMBER_ID=1234567890      # paso 3
WHATSAPP_APP_SECRET=abc123...            # paso 3
WHATSAPP_VERIFY_TOKEN=una-frase-larga-que-tu-inventes-8f3k2
WHATSAPP_BOT_NUMBER=15551234567          # número del bot (el de prueba o el tuyo), solo dígitos
```

Guarda y deja que Render redespliegue. **Nunca** subas estos valores al repositorio.

## Paso 6 — Configurar el webhook

1. En Meta: **WhatsApp → Configuración** (Configuration) → **Webhook** → **Editar**.
2. **URL de devolución de llamada**:
   `https://expenses-control-api-dv9k.onrender.com/api/whatsapp/webhook`
3. **Token de verificación**: exactamente el mismo valor de `WHATSAPP_VERIFY_TOKEN`.
4. Pulsa **Verificar y guardar**. Meta llama a la URL; si responde bien, queda guardado.
   - Si falla: revisa que el backend esté despierto (abre `https://expenses-control-api-dv9k.onrender.com/health`
     en el navegador y vuelve a intentar) y que el token coincida letra por letra.
5. En **Campos del webhook**, suscríbete a **messages**.

## Paso 7 — Probar

1. Entra a Controla → **Integraciones** → **WhatsApp** → **Generar código**.
2. Pulsa **Enviar por WhatsApp** (abre el chat con el código escrito) o envía el código manualmente al número del bot.
3. El bot responde "¡Listo! Tu WhatsApp quedó conectado".
4. Escribe `gasté 20 mil en almuerzo` → el bot muestra el resumen con botones **Registrar / Cancelar**.
5. Comandos: `resumen`, `deshacer`, `ayuda`.

## Paso 8 — Pasar a producción (número propio)

Mientras uses el número de prueba, solo podrán escribir los números que agregaste en el paso 3.
Para que cualquier usuario de la página pueda conectar su WhatsApp:

1. **WhatsApp → Configuración de la API → Agregar número de teléfono**: registra el número dedicado
   y verifícalo por SMS o llamada. Elige un **nombre visible** (p. ej. "Controla"); Meta lo revisa.
2. **Verifica tu negocio** en el Business Manager (Configuración del negocio → Centro de seguridad).
   Sin verificación hay límites bajos de conversaciones.
3. Agrega un **método de pago** en la cuenta de WhatsApp (lo exige Meta aunque el uso sea gratuito).
4. Cambia `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_BOT_NUMBER` en Render por los del número nuevo.
5. Cambia la app de modo **Desarrollo** a **Activo (Live)** (requiere URL de política de privacidad).

### Costos

El bot solo **responde** a mensajes que el usuario le escribe, dentro de la ventana de 24 horas.
Según la política de precios de Meta, esas respuestas de servicio no tienen costo; los mensajes que
inicia el negocio (plantillas de marketing, recordatorios) sí se cobran. Los precios cambian: revisa
<https://developers.facebook.com/docs/whatsapp/pricing> antes de lanzar.

---

## Cómo funciona por dentro

```
Usuario ──► WhatsApp ──► Meta ──POST firmado──► /api/whatsapp/webhook (Render)
                                                   │ verifica la firma con WHATSAPP_APP_SECRET
                                                   │ responde 200 de inmediato
                                                   ▼
                                     ¿número vinculado? ── no ─► pide el código de 6 dígitos
                                                   │ sí
                                     parser por reglas (montos "45 mil", "2 palos", fechas, cuentas,
                                     categorías y sinónimos) + IA de respaldo si falta algo
                                                   ▼
                                     borrador ─► "¿Lo registro?" [Registrar] [Cancelar]
                                                   ▼
                                     mismo servicio que la web: crea el gasto/ingreso y
                                     actualiza el saldo de la cuenta
```

- **Seguridad**: cada mensaje se valida con la firma HMAC de Meta; el código de vinculación es de un
  solo uso, vence en 10 minutos y se guarda como hash; tras 5 códigos fallidos el número queda bloqueado
  una hora; un número solo puede estar vinculado a un usuario.
- **Reintentos**: Meta puede reenviar el mismo mensaje; se procesa una sola vez (`whatsapp_processed_messages`).
- **Nada se guarda sin confirmación** en WhatsApp. `deshacer` elimina el último registro (24 h) y revierte el saldo.

## Probarlo en local sin Meta

```bash
cd backend
WHATSAPP_DRY_RUN=true WHATSAPP_VERIFY_TOKEN=dev WHATSAPP_APP_SECRET=dev \
WHATSAPP_ACCESS_TOKEN=x WHATSAPP_PHONE_NUMBER_ID=1 WHATSAPP_BOT_NUMBER=573000000000 npm run dev
```

Con `WHATSAPP_DRY_RUN=true` el backend no llama a Meta: imprime en consola los mensajes que enviaría.
Simula un mensaje entrante (la firma usa el mismo `WHATSAPP_APP_SECRET`):

```bash
node -e '
const c=require("crypto");
const body=JSON.stringify({object:"whatsapp_business_account",entry:[{changes:[{field:"messages",value:{messages:[{from:"573001112233",id:"wamid."+Date.now(),type:"text",text:{body:process.argv[1]}}]}}]}]});
fetch("http://localhost:3000/api/whatsapp/webhook",{method:"POST",headers:{"content-type":"application/json","x-hub-signature-256":"sha256="+c.createHmac("sha256","dev").update(body).digest("hex")},body}).then(r=>console.log(r.status));
' "gasté 45 mil en mercado"
```

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| "Verificar y guardar" falla | Backend dormido en Render, URL mal escrita o `WHATSAPP_VERIFY_TOKEN` distinto |
| Meta entrega, pero el bot no responde | `WHATSAPP_ACCESS_TOKEN` vencido (el de 24 h) o `WHATSAPP_PHONE_NUMBER_ID` incorrecto; revisa los logs de Render (`[whatsapp] Error 401…`) |
| Logs con `401` en `/api/whatsapp/webhook` | `WHATSAPP_APP_SECRET` no coincide con la clave secreta de la app |
| "Este número aún no está conectado" | El usuario no ha enviado el código, o se desvinculó desde la web |
| Error 131030 al responder | En modo prueba, el número del usuario no está en la lista de destinatarios (paso 3) |
| Primer mensaje tarda ~1 minuto | Plan gratuito de Render dormido; el keepalive lo reduce, un plan pago lo elimina |
