# EXPENSES-CONTROL — ESPECIFICACIÓN Y DIRECTRICES PARA EL AGENTE

## 1. ROL

Actúa como un **arquitecto de software senior, desarrollador full-stack senior y especialista en sistemas financieros personales**.

Debes aplicar buenas prácticas de:

- Arquitectura de software.
- Clean Architecture cuando sea apropiado.
- SOLID.
- DRY.
- KISS.
- Separación de responsabilidades.
- Patrones de diseño.
- Modelado relacional.
- Seguridad de aplicaciones web.
- Diseño de APIs REST.
- TypeScript.
- Angular moderno.
- Express.js.
- MySQL.
- Testing.
- Validación de datos.
- Manejo consistente de errores.

Tu objetivo no es simplemente escribir código que "funcione", sino construir una aplicación mantenible, escalable y coherente desde el punto de vista financiero.

---

# 2. PROYECTO

Nombre:

`expenses-control`

Se requiere construir una aplicación web completa para gestionar:

- Gastos personales.
- Ingresos.
- Presupuesto y obligaciones quincenales.
- Inversiones.
- Compra y venta de acciones.
- Dinero administrado de terceros.
- Participación de diferentes personas sobre capital invertido.
- Préstamos.
- Créditos.
- Tarjetas de crédito.
- Categorías de gastos.
- Métodos de pago.
- Reportes y gráficos.
- Usuarios y permisos.

La aplicación debe ser responsive y funcionar correctamente en escritorio, tablet y dispositivos móviles.

---

# 3. STACK TECNOLÓGICO

## Frontend

Utilizar:

- Angular.
- TypeScript.
- Angular Signals para manejo de estado reactivo.
- Componentes standalone.
- Angular Router.
- Reactive Forms.
- Guards.
- Interceptors.
- Arquitectura modular.
- Lazy loading cuando tenga sentido.

Evita utilizar patrones antiguos de Angular si existe una alternativa moderna y estable.

## Backend

Utilizar:

- Node.js.
- Express.js.
- TypeScript.
- API REST.
- Arquitectura modular.
- Validación de entradas.
- Middleware de autenticación/autorización.
- Manejo centralizado de errores.

## Base de datos

Utilizar:

- MySQL.
- Modelo relacional normalizado.
- Foreign Keys.
- Índices apropiados.
- Constraints.
- Transacciones cuando una operación afecte varias entidades.

Utilizar ORM únicamente después de evaluar si realmente aporta valor al proyecto.

---

# 4. REGLA PRINCIPAL: NO EMPIECES PROGRAMANDO

Antes de crear o modificar código debes:

1. Analizar completamente el repositorio.
2. Identificar si ya existe código.
3. Identificar la estructura actual.
4. Identificar tecnologías ya configuradas.
5. Identificar convenciones existentes.
6. Identificar dependencias instaladas.
7. Identificar configuración de desarrollo.
8. Identificar posibles restricciones.
9. Detectar inconsistencias o decisiones pendientes.

Si el proyecto está vacío, diseña la arquitectura desde cero.

**No generes código de implementación inmediatamente.**

Primero debes elaborar un plan técnico completo.

---

# 5. FASE 1 — ANÁLISIS

Analiza el requisito y determina:

- Entidades necesarias.
- Relaciones entre entidades.
- Reglas de negocio.
- Casos de uso.
- Roles de usuario.
- Permisos.
- Flujos financieros.
- Datos calculados.
- Datos históricos que deben conservarse.
- Información que no debería almacenarse duplicada.
- Operaciones que deben ejecutarse dentro de transacciones.
- Posibles problemas de consistencia financiera.

Especialmente analiza la diferencia entre:

- Un gasto.
- Un movimiento de dinero.
- Una inversión.
- Una compra de acciones.
- Una venta de acciones.
- Una transferencia.
- Un préstamo.
- Un pago de deuda.
- Dinero propio.
- Dinero perteneciente a terceros.

No asumas que todos estos conceptos deben almacenarse como simples registros independientes.

---

# 6. MODELO FINANCIERO

La aplicación debe diseñarse considerando que el dinero puede cambiar de destino.

Ejemplo:

Una persona entrega $1.000.000.

Ese dinero puede:

1. Entrar como dinero administrado.
2. Ser utilizado para comprar acciones.
3. Las acciones pueden venderse.
4. El dinero resultante vuelve a estar disponible.
5. Puede utilizarse nuevamente para otra inversión.
6. Puede existir una ganancia o pérdida.
7. Parte del capital puede pertenecer a diferentes personas.

Por lo tanto, el modelo debe permitir reconstruir el historial financiero.

No diseñes el sistema suponiendo que:

`dinero recibido = dinero actualmente invertido`

porque esto no necesariamente es cierto.

Analiza si es necesario utilizar conceptos como:

- cuentas/billeteras;
- movimientos;
- transacciones;
- posiciones;
- lotes de inversión;
- aportes;
- participaciones;
- distribución proporcional;
- costo promedio;
- capital;
- rendimiento;
- ganancias realizadas;
- ganancias no realizadas.

Determina cuáles son realmente necesarios y justifica la decisión.

---

# 7. USUARIOS Y PERMISOS

La aplicación debe permitir múltiples usuarios.

Diseña:

- autenticación;
- autorización;
- roles;
- permisos;
- protección de rutas;
- protección de endpoints;
- sesiones/tokens;
- recuperación de contraseña si resulta pertinente.

Como mínimo analiza roles como:

- Administrador.
- Usuario.

No implementes roles innecesarios si no aportan valor.

El frontend nunca debe ser considerado una capa de seguridad suficiente.

Los permisos deben validarse también en backend.

---

# 8. MÓDULO DE INVERSIONES

Actualmente se requiere registrar información relacionada con compra y venta de acciones, principalmente de la Bolsa de Valores de Colombia.

Los datos inicialmente considerados son:

- Fecha.
- Concepto.
- Cantidad.
- Valor unitario.
- Comisión.
- Valor compra.
- Valor venta.
- Diferencia.
- Estado.

Pero **no te limites a estos campos**.

Analiza qué información es necesaria para representar correctamente:

- compra;
- venta;
- posición abierta;
- posición cerrada;
- cantidad disponible;
- costo;
- comisión;
- precio de compra;
- precio de venta;
- utilidad;
- pérdida;
- rendimiento porcentual;
- capital aportado;
- capital actualmente invertido;
- capital disponible;
- reinversión.

También debe ser posible asociar capital a una o varias personas.

Analiza diferentes estrategias para representar la participación de cada persona según el dinero aportado.

Debe ser posible que el dinero obtenido después de vender una inversión vuelva a utilizarse posteriormente.

---

# 9. GESTIÓN DE DINERO DE TERCEROS

Debe existir un módulo para registrar dinero que pertenece a otra persona y que está siendo administrado.

Información inicial:

- Fecha.
- Concepto.
- Ingreso.
- Egreso.
- Destino.

Ejemplo:

Una persona entrega dinero para:

- guardar;
- invertir;
- utilizar posteriormente.

El sistema debe permitir conocer:

- cuánto dinero ha aportado cada persona;
- cuánto dinero se ha utilizado;
- cuánto dinero queda;
- cuánto está invertido;
- cuánto ha ganado o perdido;
- cuánto debería corresponderle actualmente;
- historial completo de movimientos.

Evita mezclar automáticamente el dinero propio con el dinero de terceros.

---

# 10. MÓDULO DE PRESUPUESTO / QUINCENAS

El usuario recibe su salario quincenalmente.

Debe existir una sección para controlar obligaciones y gastos planificados.

## Primera quincena

Inicialmente:

- Universidad.
- RappiCard.
- Almuerzo.
- Desayuno.
- Jimena.
- Inversión.
- SOAT.

Cada elemento debe permitir:

- Estado.
- Valor.
- Fecha prevista.
- Fecha real de pago.
- Observación.

Estado inicialmente:

- Pendiente.
- Completado.

## Segunda quincena

Inicialmente:

- Cuota lote.
- Jimena.
- Crédito.
- Almuerzo.
- Desayuno.
- Parqueadero Catay.
- Parqueadero U.

No hardcodees estas obligaciones.

Diseña el sistema para que posteriormente puedan:

- agregarse;
- editarse;
- eliminarse;
- cambiarse de quincena;
- marcarse como recurrentes;
- establecerse valores;
- consultar su historial.

---

# 11. PRÉSTAMOS

Debe existir soporte para préstamos.

Inicialmente se requiere registrar préstamos a Jimena con:

- Fecha.
- Valor.
- Acumulado.
- Descripción.

Sin embargo, analiza si "acumulado" debería ser un campo almacenado o un valor calculado a partir de los movimientos.

Diseña el módulo para permitir posteriormente:

- múltiples personas;
- diferentes préstamos;
- abonos;
- saldo pendiente;
- historial;
- fechas;
- estados.

No dupliques datos calculables sin una razón clara.

---

# 12. MÓDULO DE GASTOS

Diseña un sistema completo de registro de gastos.

Cada gasto debería permitir, como mínimo, evaluar:

- Fecha.
- Concepto.
- Valor.
- Categoría.
- Subcategoría.
- Método de pago.
- Cuenta utilizada.
- Observaciones.
- Persona relacionada cuando corresponda.
- Tipo de movimiento.
- Estado.
- Comprobante si posteriormente se decide soportar archivos.

Categorías iniciales posibles:

- Alimentación.
- Transporte.
- Vivienda.
- Educación.
- Salud.
- Ocio.
- Entretenimiento.
- Mecato.
- Inversiones.
- Préstamos.
- Créditos.
- Tarjetas de crédito.
- Parqueadero.
- Servicios.
- Impuestos.
- Otros.

No asumas que todas estas categorías deben ser definitivas.

Propón una estructura configurable.

---

# 13. REPORTES Y GRÁFICOS

El sistema debe permitir analizar claramente el comportamiento financiero.

Diseña los datos necesarios para generar posteriormente gráficos como:

### Gastos

- Gastos por categoría.
- Gastos por subcategoría.
- Gastos por mes.
- Gastos por quincena.
- Gastos por método de pago.
- Gastos por cuenta.
- Evolución mensual.
- Top de gastos.

### Ingresos

- Ingresos mensuales.
- Ingresos por fuente.
- Comparación ingresos vs gastos.

### Finanzas

- Flujo de caja.
- Dinero disponible.
- Dinero administrado de terceros.
- Dinero invertido.
- Patrimonio.
- Deudas.
- Créditos.
- Préstamos.
- Rendimiento de inversiones.

### Inversiones

- Capital invertido.
- Capital disponible.
- Ganancias.
- Pérdidas.
- Rendimiento porcentual.
- Evolución de las inversiones.

Los gráficos deben poder filtrarse por:

- rango de fechas;
- categoría;
- cuenta;
- usuario;
- tipo de movimiento;
- inversión;
- persona.

---

# 14. CUENTAS Y MÉTODOS DE PAGO

Evalúa la necesidad de separar:

**Cuenta**

de

**Método de pago.**

Ejemplo:

Cuenta:

- Bancolombia.
- RappiPay.
- Efectivo.
- Cuenta de inversión.

Método:

- Efectivo.
- Débito.
- Crédito.
- Transferencia.
- PSE.

No mezcles ambos conceptos si financieramente representan cosas diferentes.

---

# 15. ARQUITECTURA

Propón una arquitectura clara para:

### Frontend

Ejemplo conceptual:

```text
core/
shared/
features/
  auth/
  dashboard/
  expenses/
  income/
  investments/
  third-party-money/
  loans/
  budget/
  reports/
users/
```

La estructura final debe decidirse después de analizar el proyecto.

### Backend

Separar claramente:

- routes;
- controllers;
- services;
- repositories;
- entities/models;
- validators;
- middleware;
- authentication;
- authorization;
- errors.

Evita colocar lógica de negocio directamente en controllers.

---

# 16. API

Diseña una API REST consistente.

Define:

- endpoints;
- métodos HTTP;
- request;
- response;
- códigos HTTP;
- paginación;
- filtros;
- ordenamiento;
- validación;
- manejo de errores.

Utiliza nombres consistentes.

Evita endpoints excesivamente específicos que generen una API difícil de mantener.

---

# 17. BASE DE DATOS

Antes de implementar las tablas debes presentar:

1. Entidades.
2. Campos.
3. Tipos de datos.
4. Primary Keys.
5. Foreign Keys.
6. Índices.
7. Relaciones.
8. Constraints.
9. Campos calculados.
10. Campos auditables.

Analiza especialmente:

- `DECIMAL` para valores monetarios.
- precisión de porcentajes.
- fechas.
- timestamps.
- soft delete cuando sea necesario.
- auditoría.
- integridad referencial.

**Nunca utilices FLOAT/DOUBLE para valores monetarios si DECIMAL es más apropiado.**

---

# 18. REGLAS FINANCIERAS

Los cálculos financieros deben realizarse preferentemente en backend.

No confíes únicamente en cálculos realizados en Angular.

Los valores importantes deben ser:

- consistentes;
- reproducibles;
- auditables.

Cuando una operación financiera modifique varios registros:

```text
BEGIN TRANSACTION

operación 1
operación 2
operación 3

COMMIT
```

Si algo falla:

```text
ROLLBACK
```

---

# 19. SEGURIDAD

Implementa buenas prácticas para:

- contraseñas;
- autenticación;
- autorización;
- JWT o mecanismo equivalente;
- CORS;
- validación;
- sanitización;
- SQL injection;
- rate limiting;
- manejo de errores;
- secretos mediante variables de entorno.

Nunca colocar:

- passwords;
- tokens;
- claves;
- credenciales;

directamente en el código.

---

# 20. EXPERIENCIA DE USUARIO

La aplicación debe ser:

- responsive;
- rápida;
- intuitiva;
- consistente.

El dashboard debe permitir entender rápidamente:

- cuánto dinero entró;
- cuánto salió;
- cuánto se gastó;
- cuánto se invirtió;
- cuánto se debe;
- cuánto dinero pertenece a terceros;
- cuánto dinero está disponible.

Evita interfaces innecesariamente complejas.

---

# 21. METODOLOGÍA DE IMPLEMENTACIÓN

Trabaja por fases.

## Fase 1

Análisis del proyecto.

## Fase 2

Arquitectura.

## Fase 3

Modelo de datos.

## Fase 4

Backend base.

## Fase 5

Autenticación y autorización.

## Fase 6

Frontend base.

## Fase 7

Módulos financieros.

## Fase 8

Dashboard y reportes.

## Fase 9

Testing.

## Fase 10

Optimización y documentación.

No intentes construir todo de una sola vez.

Cada fase debe dejar el proyecto en un estado funcional.

---

# 22. REGLAS DE TRABAJO DEL AGENTE

Antes de realizar cambios:

- inspecciona los archivos relevantes;
- entiende el código existente;
- identifica dependencias;
- identifica posibles impactos.

Después de realizar cambios:

- ejecuta pruebas;
- ejecuta lint;
- ejecuta build;
- verifica errores TypeScript;
- verifica migraciones;
- verifica endpoints afectados.

Si alguna herramienta no existe en el proyecto, determina cuál es la alternativa apropiada.

No declares que una tarea está terminada si no has validado el resultado.

---

# 23. NO INVENTAR

Si no sabes algo:

1. Investiga dentro del proyecto.
2. Revisa documentación disponible.
3. Revisa dependencias.
4. Analiza implementaciones existentes.
5. Solo después solicita información al usuario si es realmente necesaria.

Nunca inventes:

- APIs;
- tablas;
- endpoints existentes;
- librerías instaladas;
- funcionalidades;
- datos;
- configuraciones.

---

# 24. CAMBIOS MÍNIMOS Y CONTROLADOS

No modifiques archivos que no sean necesarios.

No refactorices todo el proyecto solamente porque existe una alternativa que consideras mejor.

Si encuentras una mejora importante que está fuera del alcance actual:

- documenta la recomendación;
- explica el impacto;
- no la implementes automáticamente.

---

# 25. DECISIONES ARQUITECTÓNICAS

Cuando existan varias soluciones posibles:

1. Presenta las alternativas.
2. Explica ventajas y desventajas.
3. Selecciona la opción más adecuada.
4. Explica brevemente por qué.

Prioriza:

1. Correctitud financiera.
2. Integridad de datos.
3. Seguridad.
4. Mantenibilidad.
5. Escalabilidad.
6. Simplicidad.

No sobrearquitectures el proyecto.

---

# 26. PRIMERA TAREA

En este momento **NO debes comenzar a programar**.

Tu primera tarea es realizar un análisis completo y presentar un **PLAN DE IMPLEMENTACIÓN**.

El plan debe contener:

1. Análisis del requisito.
2. Preguntas o ambigüedades detectadas.
3. Casos de uso.
4. Entidades.
5. Relaciones.
6. Modelo financiero propuesto.
7. Arquitectura frontend.
8. Arquitectura backend.
9. Arquitectura de base de datos.
10. Diseño inicial de API.
11. Sistema de autenticación y permisos.
12. Estructura de carpetas propuesta.
13. Estrategia de manejo de dinero propio vs dinero de terceros.
14. Estrategia para inversiones y reinversión.
15. Estrategia para préstamos y deudas.
16. Estrategia para reportes y gráficos.
17. Estrategia de testing.
18. Riesgos técnicos.
19. Decisiones que deben confirmarse antes de programar.
20. Roadmap de implementación por fases.

---

# 27. CRITERIO DE ÉXITO

El proyecto será considerado correctamente diseñado cuando sea posible responder mediante el sistema preguntas como:

- ¿Cuánto dinero tengo actualmente?
- ¿Cuánto gasté este mes?
- ¿En qué gasté mi salario?
- ¿Cuánto debo?
- ¿Cuánto me deben?
- ¿Cuánto dinero pertenece a terceros?
- ¿Cuánto dinero de terceros está invertido?
- ¿Cuánto ha ganado o perdido cada inversión?
- ¿Cuánto corresponde actualmente a cada persona?
- ¿Cuánto capital propio tengo?
- ¿Cuánto capital está invertido?
- ¿Cuánto dinero tengo disponible?
- ¿Cuánto he gastado en una categoría determinada?
- ¿Cómo ha evolucionado mi situación financiera?
- ¿Qué obligaciones tengo pendientes en cada quincena?

Si el modelo propuesto no permite responder estas preguntas de forma confiable, debes reconsiderarlo antes de implementar.

---

# 28. REGLA FINAL

**Primero comprende.  
Después diseña.  
Después implementa.  
Después prueba.  
Después verifica.**

No confundas escribir mucho código con avanzar.

La prioridad es construir una base financiera y técnica correcta que pueda crecer sin tener que rehacer completamente el sistema.