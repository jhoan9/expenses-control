# Guía: registrar gastos e ingresos con Atajos (iPhone) y automatizaciones (Android)

## Evaluación: ¿es posible?

**Sí, en ambos sistemas.** Controla expone un endpoint de "registro rápido" que entiende texto libre
(`gasté 45 mil en mercado con Nequi`) y se autentica con un **token personal** que cada usuario crea
en la web. Cualquier app capaz de hacer una petición HTTP puede usarlo.

| | iPhone (Atajos) | Android |
|---|---|---|
| App necesaria | **Atajos** (viene instalada) | **HTTP Shortcuts** (gratis, código abierto) o **MacroDroid** / **Tasker** |
| Dictar por voz | ✅ "Oye Siri, registrar gasto" | ✅ dictado del teclado; con Google Assistant de forma limitada |
| Botón en pantalla de inicio / widget | ✅ | ✅ |
| Botón físico | ✅ Botón de Acción (iPhone 15 Pro y posteriores) o Toque posterior | ✅ con MacroDroid/Tasker |
| **Registro automático al pagar** | ⚠️ Solo pagos con **Apple Pay** (automatización "Transacción", iOS 17+) | ✅ Leyendo la **notificación o el SMS del banco** (MacroDroid/Tasker) |
| Costo | Gratis | Gratis (MacroDroid tiene versión paga sin límites; Tasker es de pago) |

Diferencia clave: iOS no deja que una app lea las notificaciones de otras apps, así que en iPhone el
registro 100 % automático solo es posible con Apple Pay. En Android sí se puede reaccionar a la
notificación de Nequi, Bancolombia, Daviplata, etc.

---

## Paso 1 — Crear tu token (igual en ambos)

1. Entra a Controla → **Integraciones** → pestaña **Atajos de iPhone y Android**.
2. Escribe el nombre del dispositivo (ej. "iPhone de Laura") → **Crear token**.
3. **Copia el token** (empieza por `ctl_`). Solo se muestra una vez. Si lo pierdes, revócalo y crea otro.
4. Opcional: en **Cuenta predeterminada** elige la cuenta que se usará cuando no nombres ninguna.

Datos de la petición (los vas a necesitar abajo):

| Campo | Valor |
|---|---|
| URL | `https://expenses-control-api-dv9k.onrender.com/api/quick/entries` |
| Método | `POST` |
| Encabezado | `Authorization: Bearer ctl_tu_token` |
| Cuerpo (JSON) | `{"text": "gasté 45 mil en mercado"}` |

Respuesta:

```json
{ "success": true, "message": "Gasto registrado: $ 45.000 · Mercado · Nequi · hoy", "data": { ... } }
```

- Si falta algo (por ejemplo el monto) responde **422** con `message: "Me falta el monto…"`.
- Agrega `?format=text` a la URL y la respuesta será solo el texto del mensaje (lo más fácil para leerlo en voz alta).
- Otros endpoints con el mismo token: `POST /api/quick/undo` (deshacer el último), `GET /api/quick/summary` (resumen del mes),
  `GET /api/quick/options` (nombres de cuentas y categorías, para menús).

> **Seguridad**: el token permite registrar movimientos en tu cuenta y ver el resumen del mes; no permite
> borrar cuentas ni ver contraseñas. Trátalo como una contraseña y revócalo desde la web si pierdes el teléfono.

---

## iPhone — Atajos

### Atajo 1: "Registrar gasto" por voz (recomendado)

1. Abre **Atajos** → **+** (nuevo atajo) → nómbralo **Registrar gasto**.
2. Agrega la acción **Dictar texto** (idioma: Español).
3. Agrega **Obtener contenido de URL**:
   - URL: `https://expenses-control-api-dv9k.onrender.com/api/quick/entries?format=text`
   - Toca **Mostrar más**:
     - Método: **POST**
     - Encabezados: clave `Authorization`, valor `Bearer ctl_tu_token`
     - Cuerpo de la solicitud: **JSON** → agrega un campo de tipo **Texto**, clave `text`, valor: la variable **Texto dictado**.
4. Agrega **Mostrar notificación** (o **Leer texto** para que Siri lo diga) con la variable **Contenido de la URL**.
5. Listo. Úsalo así:
   - "**Oye Siri, registrar gasto**" → dices "cuarenta y cinco mil en mercado con Nequi" → Siri confirma.
   - Desde la pantalla de inicio: mantén pulsado el atajo → **Agregar a la pantalla de inicio**, o agrégalo como **widget**.
   - iPhone 15 Pro y posteriores: **Configuración → Botón de Acción → Atajo → Registrar gasto**.
   - Cualquier iPhone: **Configuración → Accesibilidad → Tocar → Toque posterior → Doble toque → Registrar gasto**.

> Siri escribe los números como dígitos ("45000" o "45 mil"); ambos funcionan. Para ingresos di
> "me pagaron…", "recibí…": el tipo se detecta por las palabras.

### Atajo 2: con formulario (sin voz)

Igual que el anterior, pero cambia **Dictar texto** por **Solicitar entrada** (tipo Texto, mensaje
"¿Qué gastaste?"). Útil cuando no puedes hablar.

### Atajo 3: menú de categorías y cuentas

Para elegir con toques en lugar de escribir:

1. **Obtener contenido de URL** → `GET https://…/api/quick/options` con el mismo encabezado.
2. **Obtener valor de diccionario** → clave `expense_categories` → **Elegir de la lista** → variable *Categoría*.
3. Repite con la clave `accounts` → variable *Cuenta*.
4. **Solicitar entrada** (Número) → variable *Monto*.
5. **Obtener contenido de URL** → `POST https://…/api/quick/entries?format=text` con cuerpo JSON:
   `kind` = `expense`, `amount` = *Monto*, `category` = *Categoría*, `account` = *Cuenta*.
6. **Mostrar notificación** con el resultado.

### Automatización: registrar automáticamente al pagar con Apple Pay (iOS 17+)

Solo funciona con pagos hechos con **Apple Pay** desde la app Wallet.

1. **Atajos → Automatización → Nueva automatización → Transacción**.
2. Elige tus tarjetas → **Ejecutar inmediatamente** → **Siguiente** → **Nueva automatización en blanco**.
3. Agrega **Obtener contenido de URL**: `POST https://…/api/quick/entries?format=text`, encabezado `Authorization`,
   cuerpo JSON con un campo `text` cuyo valor sea: `compré` + variable **Importe** + `en` + variable **Comerciante**.
   Si una tarjeta de Wallet corresponde a una cuenta de Controla, agrega también el campo `account` con su nombre.
4. **Mostrar notificación** con el resultado.

### Atajos extra

- **Deshacer**: `POST https://…/api/quick/undo?format=text` → Mostrar notificación. Nómbralo "Deshacer gasto".
- **¿Cuánto llevo?**: `GET https://…/api/quick/summary?format=text` → Leer texto. "Oye Siri, cuánto llevo".

---

## Android

Android no trae una app equivalente a Atajos que haga peticiones web, pero hay buenas opciones gratuitas.

### Opción A: HTTP Shortcuts (recomendada para registrar a mano o por voz)

App gratuita y de código abierto ([Google Play](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts)
o F-Droid).

1. Instala **HTTP Shortcuts** → **+** → **Regular shortcut** (atajo normal).
2. **Basic request settings**: método **POST**, URL `https://expenses-control-api-dv9k.onrender.com/api/quick/entries?format=text`.
3. **Variables** (icono `{}` en la pantalla principal) → **+** → tipo **Text input** (entrada de texto),
   nombre `texto`, mensaje "¿Qué gastaste?". Activa "Permitir dictado" si aparece.
4. Vuelve al atajo → **Request headers** → `Authorization` = `Bearer ctl_tu_token`.
5. **Request body** → tipo **Custom text**, content type `application/json`, contenido:
   ```json
   {"text": "{texto}"}
   ```
   (inserta la variable con el botón `{}` para que quede bien enlazada).
6. **Response handling** → mostrar como **Toast** o **Dialog**.
7. Mantén pulsado el atajo → **Place on home screen** (o usa el widget de la app).
8. Para dictar: al aparecer el cuadro de texto, toca el micrófono del teclado (Gboard).

Crea dos atajos más con la misma configuración para **Deshacer** (`POST …/api/quick/undo?format=text`, sin cuerpo)
y **Resumen** (`GET …/api/quick/summary?format=text`).

### Opción B: MacroDroid — registro automático desde la notificación o SMS del banco

Cuando Nequi, Bancolombia, Daviplata u otro banco te notifica una compra, MacroDroid reenvía el texto
a Controla, que reconoce frases como "Compraste $45.000 en ÉXITO" o "Recibiste $50.000 de…".

1. Instala **MacroDroid** y concédele **acceso a notificaciones** (o permiso de SMS si tu banco usa SMS).
2. **Agregar macro**:
   - **Disparador**: *Notificación recibida* → selecciona la app del banco → "Contiene texto":
     `Compraste|Pagaste|Recibiste|Transferiste` (activa "expresión regular" si lo ofrece).
     Para SMS: *SMS recibido* → remitente del banco.
   - **Acción**: *Solicitud HTTP* (HTTP Request):
     - Método **POST**, URL `https://expenses-control-api-dv9k.onrender.com/api/quick/entries?format=text`
     - Encabezado `Authorization: Bearer ctl_tu_token`
     - Cuerpo, tipo `application/json`: `{"text": "[notification]"}` (o `[sms_message]` para SMS),
       usando el selector de variables de MacroDroid.
   - **Acción** (opcional): *Mostrar notificación* con la respuesta (`[http_response]`) para ver qué se registró.
3. Guarda la macro y haz una compra de prueba pequeña.

Recomendaciones:
- Si el texto del banco no nombra la cuenta, define la **cuenta predeterminada** en la web o agrega el nombre
  de la cuenta al cuerpo: `{"text": "[notification]", "account": "Nequi"}`.
- Excluye notificaciones de saldo, códigos de seguridad o publicidad con condiciones de MacroDroid
  ("no contiene" `código|clave|OTP`), para no registrar algo que no es un movimiento.
- Si una notificación no tiene monto, la API responde 422 y **no registra nada**.
- Si algo se registra mal: `deshacer` por WhatsApp, el atajo de deshacer, o elimínalo en la web.

### Opción C: Tasker (avanzado, de pago)

Equivalente a MacroDroid con más control (perfiles por evento de notificación con el plugin AutoNotification,
acción **HTTP Request**). Usa la misma URL, encabezado y cuerpo.

### ¿Y Google Assistant?

Las rutinas de Google Assistant / Gemini no pueden llamar a una URL arbitraria. La forma práctica es
abrir el atajo de HTTP Shortcuts desde la pantalla de inicio o un widget, y dictar con el micrófono del teclado.

---

## Probar el endpoint desde la terminal

```bash
curl -X POST "https://expenses-control-api-dv9k.onrender.com/api/quick/entries?format=text" \
  -H "Authorization: Bearer ctl_tu_token" \
  -H "Content-Type: application/json" \
  -d '{"text": "gasté 45 mil en mercado con Nequi"}'
```

Para solo interpretar sin guardar, agrega `"dry_run": true` al cuerpo.

## Qué entiende el registro rápido

| Escribes | Interpreta |
|---|---|
| `45000`, `45.000`, `$45.000`, `45 mil`, `45k`, `45 lucas` | $ 45.000 |
| `1,2 millones`, `1.2M`, `1 millón 200 mil` | $ 1.200.000 |
| `2 palos`, `2 palos y medio`, `medio millón` | $ 2.000.000 / $ 2.500.000 / $ 500.000 |
| `gasté`, `pagué`, `compré`, `compraste`… | Gasto |
| `me pagaron`, `recibí`, `recibiste`, `cobré`… | Ingreso |
| `hoy`, `ayer`, `antier`, `el 15`, `15 de noviembre`, `15/11` | Fecha |
| Nombre de la cuenta (`nequi`, `bancolombia`), `efectivo`, `tarjeta` | Cuenta |
| Nombre de tus categorías o palabras como `uber`, `almuerzo`, `arriendo`, `netflix` | Categoría |

Si la frase es ambigua y hay una clave de IA configurada (`AI_API_KEY`), se usa la IA como respaldo para
completar lo que falte; la IA solo puede elegir entre tus propias cuentas y categorías.
