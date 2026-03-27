# Backlog y seguimiento del proyecto Mythr Prism

Ultima actualizacion: 2026-03-27

## Resumen

Este documento es la lista viva de tareas del proyecto/feature Mythr Prism para proyeccion/control de contenido multi-monitor.

### Reglas de actualizacion

- Mantener cada tarea en su fase objetivo (`MVP`, `V1`, `V2`) y no duplicarla en otra seccion.
- Mover al bloque `Sprint actual` solo tareas activas de la iteracion en curso.
- Marcar checklist principal y subtareas con `- [x]` solo cuando cumplan su criterio de hecho.
- Si aparece nueva dependencia, actualizar el campo `Dependencias` de la tarea afectada.
- Actualizar la fecha en `Ultima actualizacion` y el bloque `Progreso global` en cada cambio de estado.
- Mantener descripciones cortas, accionables y orientadas a entrega verificable.

## Progreso

### Progreso global

| Fase | Progreso |
| --- | --- |
| MVP | 0% |
| V1 | 0% |
| V2 | 0% |

> Referencia de calculo sugerida: `tareas completadas / tareas totales de la fase * 100`.

## MVP

- [ ] **Playlist multimedia**
  - Dependencias: reproduccion base por monitor, cola de items.
  - Hecho: se puede crear/editar/ordenar una playlist y ejecutarla en un monitor.
  - Subtareas:
    - [ ] Modelo de item multimedia (video, imagen).
    - [ ] UI para alta/edicion/reordenado.
    - [ ] Motor de reproduccion secuencial con avance manual/automatico.
    - [ ] Persistencia local de playlist.

- [ ] **Video sincronizado**
  - Dependencias: playlist multimedia, reloj/timestamp compartido.
  - Hecho: multiples monitores reproducen el mismo video con desfase maximo aceptable.
  - Subtareas:
    - [ ] Definir estrategia de sincronizacion (host + clientes).
    - [ ] Implementar mensajes de sync (play/pause/seek/time).
    - [ ] Medicion de drift y correccion periodica.
    - [ ] Prueba manual en setup multi-monitor.

- [ ] **Guardado/restauracion de layouts**
  - Dependencias: modelo de escenas/layout actual.
  - Hecho: se puede guardar un layout nombrado y restaurarlo sin perdida de configuracion.
  - Subtareas:
    - [x] Base de persistencia de sesion/config en `localStorage` (schema versionado + hidratacion segura).
    - [ ] Esquema de serializacion de layout.
    - [ ] Acciones guardar/cargar desde UI.
    - [ ] Validacion de compatibilidad entre versiones.

- [ ] **Modo espejo**
  - Dependencias: asignacion de salidas/monitores.
  - Hecho: una salida replica otra con estabilidad y control de activacion/desactivacion.
  - Subtareas:
    - [ ] Selector de origen de espejo.
    - [ ] Pipeline de render compartido/duplicado.
    - [ ] Pruebas de rendimiento basicas.

- [ ] **Thumbnails**
  - Dependencias: pipeline de render por salida.
  - Hecho: la UI muestra previews actualizadas de cada monitor sin bloquear interaccion.
  - Subtareas:
    - [ ] Captura periodica de frame reducido.
    - [ ] Grid de miniaturas en panel de control.
    - [ ] Estrategia de refresh y limite de frecuencia.

- [ ] **Lower thirds**
  - Dependencias: compositor de capas.
  - Hecho: se puede mostrar/ocultar un lower third editable sobre contenido activo.
  - Subtareas:
    - [ ] Plantilla basica de lower third.
    - [ ] Controles de texto/estilo/posicion.
    - [ ] Integracion con timeline/escena activa.

- [ ] **Pizarra en vivo**
  - Dependencias: capa interactiva sobre salida.
  - Hecho: usuario dibuja en tiempo real y puede limpiar/rehacer sobre la proyeccion.
  - Subtareas:
    - [ ] Herramienta de trazo (color, grosor).
    - [ ] Borrado global y undo basico.
    - [ ] Sincronizacion de overlay en monitor objetivo.

## V1

- [ ] **Flash ID monitores**
  - Dependencias: deteccion/listado de monitores.
  - Hecho: cada monitor puede mostrar un identificador temporal para mapeo fisico.
  - Subtareas:
    - [ ] Comando de flash por monitor.
    - [ ] Overlay numerico de alta visibilidad.
    - [ ] Timeout y retorno automatico a estado previo.

- [ ] **Transiciones**
  - Dependencias: cambio de escena/layout funcional.
  - Hecho: cambios de contenido aplican transiciones seleccionables sin artefactos visibles.
  - Subtareas:
    - [ ] Catalogo inicial (cut, fade, wipe).
    - [ ] Parametros de duracion.
    - [ ] Integracion en flujo de cambio de escena.

- [ ] **URLs externas**
  - Dependencias: renderer web embebido seguro.
  - Hecho: se cargan URLs permitidas con controles minimos de navegacion y fallback en error.
  - Subtareas:
    - [ ] Politica de allowlist/bloqueo.
    - [ ] Carga y recarga controlada.
    - [ ] Estado de error y recovery visual.

- [ ] **Filtros en caliente**
  - Dependencias: pipeline grafico con parametros runtime.
  - Hecho: se pueden aplicar y ajustar filtros durante reproduccion sin reiniciar salida.
  - Subtareas:
    - [ ] API interna de filtros encadenados.
    - [ ] UI de ajuste rapido.
    - [ ] Persistencia de presets por escena.

## V2

- [ ] **Keystone**
  - Dependencias: transformaciones geometricas por salida.
  - Hecho: correccion trapezoidal ajustable por esquinas con preview fiable.
  - Subtareas:
    - [ ] Matriz de transformacion 2D por monitor.
    - [ ] UI de ajuste por handles.
    - [ ] Guardado por perfil de salida.

- [ ] **Chroma key**
  - Dependencias: compositor de video por capas, filtros en caliente.
  - Hecho: se recorta fondo por color con controles de tolerancia y borde utilizables en produccion.
  - Subtareas:
    - [ ] Shader/filtro de key por color.
    - [ ] Controles de similitud, suavizado y spill.
    - [ ] Presets base para fondos comunes.

## Sprint actual

> Plan operativo inmediato del MVP (orden sugerido de ejecucion).

1. [ ] **[MVP] Playlist multimedia -> Modelo de item multimedia (video, imagen)** _(en curso)_
2. [ ] **[MVP] Playlist multimedia -> UI para alta/edicion/reordenado** _(pendiente)_
3. [ ] **[MVP] Playlist multimedia -> Motor de reproduccion secuencial con avance manual/automatico** _(pendiente)_
4. [ ] **[MVP] Playlist multimedia -> Persistencia local de playlist** _(pendiente)_
5. [ ] **[MVP] Video sincronizado -> Definir estrategia de sincronizacion (host + clientes)** _(pendiente)_
6. [ ] **[MVP] Video sincronizado -> Implementar mensajes de sync (play/pause/seek/time)** _(pendiente)_

## Notas

- Convencion sugerida para sprint: `- [ ] [FASE] Nombre de tarea -> referencia en seccion original`.
- Si una tarea se divide, mantener una tarea madre y subtareas hijas para no romper el calculo de progreso.
- Revisar este backlog al inicio y cierre de cada sprint.
