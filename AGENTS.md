# AGENTS.md - Guia de trabajo para agentes en Mythr Prism

## 1) Proposito del proyecto

Mythr Prism es un modulo del ecosistema Mythr para control y proyeccion de contenido en entornos multi-monitor. Este repositorio implementa la app de operador (master), la gestion de ventanas de salida (slave) y la base de estado/persistencia para operar flujos audiovisuales de forma estable.

## 2) Principios de arquitectura

### Stack y direccion tecnica

- Frontend en Vue 3 + TypeScript estricto (`strict: true`).
- Package manager por defecto: PNPM.
- Enfoque incremental: MVP primero, luego V1/V2 segun `docs/backlog.md`.

### Separacion por capas

- `src/components/`: UI y composicion visual.
- `src/composables/`: logica de dominio/reactividad reusable.
- `src/services/`: infraestructura (persistencia, html de slave, integraciones browser API).
- `src/types/`: contratos de dominio y mensajes.
- `src/utils/`: utilidades puras y acotadas.
- `src/assets/`: recursos estaticos (styles, imagenes, fuentes y otros assets del runtime/UI).

Regla: los componentes no deben acumular logica de orquestacion compleja si puede vivir en composables/services.

### Tipado estricto

- No usar `any` salvo excepcion justificada y localizada.
- Modelar contratos con `type`/`interface` en `src/types` cuando sean compartidos.
- Validar datos externos (mensajes, `localStorage`, APIs browser) antes de mutar estado.

### Estado serializable

- El estado persistible debe ser JSON-serializable.
- No persistir objetos runtime: `Window`, `MediaStream`, nodos DOM, funciones, timers, refs de Vue.
- Antes de guardar snapshots, sanitizar y clonar de forma segura.

### Protocolo `postMessage`

- Todo mensaje master-slave debe viajar en un envelope tipado con:
  - `channel`
  - `type`
  - `instanceToken`
  - `monitorId`
  - `payload`
- Ignorar mensajes fuera del canal esperado o con token/monitor no coincidente.

## 3) Reglas de orquestacion para agentes

### Roles

- `Coordinator`: coordina, divide trabajo, consolida resultados y riesgos.
- `Executor`: implementa cambios concretos (codigo, pruebas, docs tecnicas).

### Cuando delegar

Delegar cuando una tarea implique cualquiera de estos puntos:

- Lectura o analisis de multiples archivos.
- Cambios de arquitectura o decisiones de contrato.
- Implementacion de feature/refactor/bugfix.
- Validacion tecnica (build/typecheck/tests).

### Como reportar resultados

Todo entregable de agente debe incluir, de forma breve y verificable:

- `status`: completed | partial | blocked
- `cambios`: archivos tocados
- `impacto`: funcional, tecnico y riesgos
- `validacion`: comandos ejecutados y resultado
- `siguiente paso`: accion recomendada

### Evitar trabajo inline excesivo

- No resolver analisis profundo en un unico mensaje largo si se puede dividir por fases.
- Priorizar lotes pequenos y verificables sobre cambios grandes no validados.
- Mantener el contexto limpio: decisiones y estado relevante deben quedar en archivos del repo (este documento, backlog, docs de cambio) y no solo en chat.

## 4) Convenciones de codigo

### Vue

- Usar Composition API con `<script setup lang="ts">` en componentes nuevos o refactors.
- Favorecer props/emits tipados y estado derivado con `computed`.
- Evitar watchers profundos innecesarios; preferir modelado de estado mas acotado.

### Nombres

- Componentes: PascalCase (`MonitorCard.vue`).
- Composables: `useXxx` (`usePlaylistPlayback.ts`).
- Tipos e interfaces: PascalCase (`PersistedSessionV1`, `MessageEnvelope`).
- Constantes globales: UPPER_SNAKE_CASE (`SESSION_SCHEMA_VERSION`).

### Estilos compartidos

- Hoja global principal en `src/assets/styles/style.css`.
- Mantener `@tailwind base/components/utilities` en esa hoja global.
- Extraer patrones repetidos de utilidades a clases semanticas reutilizables (botones, modales, tabs, tarjetas, filas de formulario).
- Evitar utilidades largas duplicadas en templates cuando ya exista clase compartida equivalente.

### Errores y logs

- Mostrar mensajes accionables para el operador (sin filtrar stack interno crudo a UI final).
- Capturar errores de APIs browser con fallback seguro.
- No abusar de logs en produccion; mantener logs intencionales y utiles para diagnostico.

### UX operativa (modales y datos largos)

- Todo modal debe renderizarse en overlay fijo (`fixed/inset-0`) para no desplazarse con el contenido de fondo.
- Convencion global obligatoria de modal: abrir centrado en viewport, no exceder limites visibles (`max-h`/`max-w` relativos a pantalla) y usar scroll interno cuando el contenido sea mayor al espacio disponible.
- Estructura base obligatoria en modales: `header` + `body` scrolleable + `footer` de acciones; `header` y `footer` deben permanecer visibles (`sticky top-0` / `sticky bottom-0`) mientras se desplaza el cuerpo.
- Todo dialogo debe incluir boton/icono de cierre en el extremo derecho del `header`, con `aria-label` explicito y accion de cierre equivalente a `Escape`.
- Evitar boton de "Cerrar" redundante en `footer`: usar acciones de contexto (`Guardar`/`Cancelar` cuando aplique) y dejar el cierre generico en el `header`.
- Al abrir cualquier modal, bloquear scroll del `body`; al cerrar o desmontar, restaurar de forma segura el estado original.
- Cadenas largas en UI (URLs/data URI) deben truncarse solo visualmente y exponer valor completo via `title` u otro mecanismo de inspeccion.
- Botones que disparan dialogos deben usar texto orientado a accion y no explicitar "modal" en su label.
- Botones de accion deben combinar icono + texto (no icono solo); marcar iconos decorativos con `aria-hidden="true"` y mantener espaciado consistente.
- Checkboxes inline de formulario deben usar un componente visual unificado y accesible (por defecto `src/components/ui/AppCheckbox.vue`).
- Interacciones de reordenado por drag and drop deben incluir siempre fallback accesible por botones (`Subir/Bajar`) y feedback visual de origen/destino durante el arrastre.

### No sobre-ingenieria

- Preferir soluciones simples, legibles y mantenibles.
- Evitar abstracciones prematuras sin necesidad real de reutilizacion.
- Cada nueva capa debe justificar costo/beneficio.

## 5) Persistencia y estado

### Esquema versionado en `localStorage`

- Clave actual: `mythr-prism.session`.
- Version de esquema: `SESSION_SCHEMA_VERSION`.
- Toda lectura debe pasar por sanitizacion defensiva.

### Que se puede persistir

- Preferencias de UI (flags, toggles, paneles).
- Estado de monitores serializable (transform, `imageDataUrl`, etc.).
- Playlist y estado de playback serializable.

### Que NO se puede persistir

- Referencias a `window` o ventanas esclavas.
- Objetos no serializables (`MediaStream`, `HTMLElement`, funciones, Promises, refs Vue).
- Recursos efimeros del runtime (tokens de instancia temporales, timers activos).

### Saneamiento y migraciones

- Nunca confiar en shape historico de `localStorage`.
- Implementar migraciones backward-compatible cuando cambie schema.
- Si falla parseo/sanitizacion, aplicar fallback seguro y limpiar estado corrupto.

## 6) Comunicacion Master-Slave

### Contrato de mensajes

- Definir y mantener tipos en `src/types/messages.ts`.
- Master -> Slave y Slave -> Master con uniones discriminadas por `type`.
- No enviar payloads no serializables por `postMessage`.

### Validacion de mensajes

- Verificar envelope minimo (`channel`, `type`, `instanceToken`, `monitorId`, `payload`).
- Descartar mensajes de origen inesperado o instancia cerrada.
- Aplicar validaciones de payload antes de usarlo en UI o estado.

### Seguridad basica y limites de plataforma

- Fullscreen requiere activacion explicita del usuario en la ventana destino.
- Pop-up blockers pueden impedir `window.open`; reportar error accionable.
- APIs de Window Management pueden requerir permisos o no estar disponibles segun navegador/version.
- Nunca asumir permisos garantizados; siempre contemplar fallback y comunicacion clara.

## 7) Backlog y delivery

### Fuente de verdad

- `docs/backlog.md` es la fuente oficial de plan y progreso.

### Politica de movimiento de tareas

- `pending` -> `in-progress`: solo cuando se inicia trabajo real.
- `in-progress` -> `completed`: solo con criterios de hecho cumplidos y validacion minima.
- Al cerrar una tarea: actualizar checklist, notas de progreso y fecha de actualizacion.

### Definition of Done minima

Una tarea se considera hecha si:

- Cumple criterios funcionales definidos en backlog.
- Pasa validacion tecnica minima (`pnpm run typecheck`, `pnpm run build`, `pnpm run test`).
- No introduce regresiones evidentes en flujo principal.
- Deja trazabilidad de cambios (archivos afectados + nota breve en backlog/docs si aplica).

## 8) Testing y validacion

### Politica obligatoria de testing

- Toda nueva funcionalidad debe incluir tests acorde al impacto (unitarios y/o integracion funcional).
- Ninguna tarea puede marcarse `completed` en backlog sin ejecutar validacion minima (`pnpm run typecheck`, `pnpm run build`, `pnpm run test`).
- Todo bugfix debe incluir o actualizar test de regresion que falle sin el fix y pase con el fix.

### Comandos base (PNPM)

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run test`

Ejecutarlos como verificacion minima antes de declarar tarea completada.

### Si el entorno no cumple version de Node

- Usar Node LTS compatible.
- Recomendar `corepack enable` y usar PNPM del proyecto.
- Si hay incompatibilidad, reportar bloqueo con mensaje concreto (version detectada vs requerida) y no forzar workarounds opacos.

## 9) Git y PR guidelines

- No crear commits automaticamente salvo peticion explicita del usuario.
- No hacer push ni operaciones destructivas sin instruccion explicita.
- Mensajes de commit orientados al "why" (motivo e impacto), no solo al "what".
- Mantener PRs acotadas, con alcance claro y evidencia de validacion.

## 10) Seguridad y privacidad

- Proyecto propietario: All Rights Reserved.
- No exponer codigo fuente, detalles internos ni datos sensibles fuera de canales autorizados.
- No incluir secretos, tokens o credenciales en codigo, logs o capturas.
- Minimizar datos persistidos y compartidos; aplicar principio de menor privilegio.

## 11) Playbooks rapidos

### A) Bugfix

1. Reproducir bug y acotar causa raiz.
2. Corregir en el punto minimo de cambio.
3. Agregar/ajustar test de regresion y validar flujo principal (`typecheck` + `build` + `test`).
4. Documentar impacto breve en `docs/backlog.md` si afecta roadmap/estado.

### B) Feature MVP

1. Confirmar alcance minimo viable en `docs/backlog.md`.
2. Implementar vertical slice (UI + logica + persistencia si aplica) sin sobre-extender.
3. Validar flujo de extremo a extremo de forma manual.
4. Registrar estado y siguientes subtareas en backlog.

### C) Refactor seguro

1. Definir limite del refactor (sin cambiar comportamiento observable, salvo objetivo explicito).
2. Mover logica por capas manteniendo contratos publicos estables.
3. Ejecutar validaciones tecnicas y revisar riesgos de regresion.
4. Entregar diff pequeno, legible y con rationale claro.

---

Este documento aplica a cualquier agente/IA que trabaje en este repositorio. Si una nueva decision de arquitectura contradice alguna regla, actualizar este archivo y `docs/backlog.md` en la misma iteracion para mantener consistencia operativa.
