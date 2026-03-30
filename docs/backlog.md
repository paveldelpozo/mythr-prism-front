# Backlog y seguimiento del proyecto Mythr Prism

Ultima actualizacion: 2026-03-30

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
| MVP | 7% |
| V1 | 0% |
| V2 | 0% |

> Referencia de calculo sugerida: `tareas completadas / tareas totales de la fase * 100`.

## MVP

- [x] **Playlist multimedia**
  - Dependencias: reproduccion base por monitor, cola de items.
  - Hecho: se puede crear/editar/ordenar una playlist y ejecutarla en un monitor.
  - Subtareas:
    - [x] Modelo de item multimedia (video, imagen).
    - [x] UI para alta/edicion/reordenado.
    - [x] Motor de reproduccion secuencial con avance manual/automatico.
    - [x] Persistencia local de playlist.

- [ ] **Cerrar todas las ventanas (habilitacion por estado)**
  - Prioridad: `P1`.
  - Objetivo: evitar acciones vacias y mejorar control operativo mostrando el boton solo habilitado cuando exista al menos una ventana abierta.
  - Dependencias/riesgos: depende de fuente de verdad confiable para ventanas activas; riesgo de estado desincronizado tras cierre manual del navegador.
  - Criterio de aceptacion: boton `Cerrar todas las ventanas` deshabilitado con 0 ventanas abiertas y habilitado automaticamente con >=1.
  - DoD: comportamiento validado en flujo abrir/cerrar/reabrir ventanas y sin regresion en comandos de cierre individuales.
  - Subtareas:
    - [ ] Unificar criterio de "ventana abierta" en estado serializable de sesion.
    - [ ] Conectar estado derivado al boton global de cierre.
    - [ ] Sincronizar cambios por cierre manual de ventanas secundarias.
    - [ ] Agregar prueba de regresion de habilitacion/deshabilitacion.

- [ ] **Reorganizar interfaz principal (Monitores/Playlist)**
  - Prioridad: `P2`.
  - Objetivo: separar responsabilidades principales en una estructura simple (pestanas o equivalente) para reducir saturacion cognitiva.
  - Dependencias/riesgos: depende de definir layout responsive base; riesgo de aumentar pasos para acciones frecuentes si el flujo no queda directo.
  - Criterio de aceptacion: Monitores y Playlist quedan en secciones separadas, navegables en desktop y mobile sin perdida de funciones actuales.
  - DoD: flujo principal (abrir monitor, seleccionar contenido, controlar playback) se completa sin buscar controles en paneles no relacionados.
  - Subtareas:
    - [ ] Definir estructura IA minima (tabs o switch de vistas) y reglas responsive.
    - [ ] Mover controles de monitores a su seccion dedicada.
    - [ ] Mover gestion de playlist a su seccion dedicada.
    - [ ] Verificar accesos rapidos para acciones criticas entre secciones.

- [ ] **Formularios complejos en dialogos modales**
  - Prioridad: `P3`.
  - Objetivo: reducir carga visual trasladando formularios de alta/edicion compleja a modales enfocados por contexto.
  - Dependencias/riesgos: depende de la reorganizacion de interfaz principal; riesgo de perder contexto del item editado si el modal no refleja estado previo.
  - Criterio de aceptacion: formularios extensos ya no ocupan panel permanente y se abren/cerran via modal con foco y escape controlados.
  - DoD: formularios preservan validaciones actuales, accesibilidad basica (foco inicial/retorno) y no bloquean operacion general.
  - Subtareas:
    - [ ] Inventariar formularios complejos candidatos (playlist, monitor, ajustes).
    - [ ] Definir patron unico de modal con props/emits tipados.
    - [ ] Migrar formulario de mayor impacto al nuevo patron.
    - [ ] Validar cierre seguro con cambios sin guardar (confirmacion o descarte explicito).

- [ ] **Rediseno UI + reordenado playlist por drag and drop**
  - Prioridad: `P4`.
  - Objetivo: mejorar percepcion de calidad (limpia/amigable/atractiva) e incorporar drag and drop sin eliminar botones subir/bajar.
  - Dependencias/riesgos: depende de estructura de interfaz definida; riesgo de inconsistencias de UX entre desktop y tactil.
  - Criterio de aceptacion: interfaz adopta lineamientos visuales unificados y la playlist permite reordenado por arrastre, manteniendo metodo actual por botones.
  - DoD: drag and drop funciona con feedback visual, persiste orden correcto y convive con accesibilidad por controles alternativos.
  - Subtareas:
    - [ ] Definir lineamientos visuales MVP (tipografia, espaciado, jerarquia y feedback).
    - [ ] Aplicar rediseno incremental en vistas de Monitores y Playlist.
    - [ ] Integrar interaccion drag and drop en lista de playlist.
    - [ ] Mantener y validar botones subir/bajar como fallback accesible.

- [ ] **Previsualizacion de items de playlist (incluye video)**
  - Prioridad: `P5`.
  - Objetivo: mostrar preview por item para mejorar identificacion rapida de contenido antes de reproducir.
  - Dependencias/riesgos: depende de normalizacion de origen de media; riesgo CORS/decodificacion en videos remotos y costo de CPU por captura de fotograma.
  - Criterio de aceptacion: cada item de playlist muestra miniatura; en video se intenta capturar frame y, si falla, se usa fallback visual consistente.
  - DoD: no se bloquea la UI al generar thumbnails y se reportan fallos de preview sin romper playback.
  - Subtareas:
    - [ ] Implementar pipeline de preview para imagenes con cache local.
    - [ ] Implementar intento de captura de frame para videos (con timeout y fallback).
    - [ ] Definir placeholders para estados `loading`, `error`, `cors-blocked`.
    - [ ] Limitar concurrencia/frecuencia para evitar picos de consumo.

- [ ] **Playlist multi-destino (una playlist en multiples pantallas)**
  - Prioridad: `P6`.
  - Objetivo: permitir asignar una misma playlist a mas de una salida externa de forma simultanea y controlada.
  - Dependencias/riesgos: depende de contrato de comandos master-slave y modelo de playback; riesgo de conflictos de estado (play/pause/seek) entre destinos.
  - Criterio de aceptacion: operador puede asignar N monitores a una playlist y ejecutar controles coherentes por grupo sin romper flujo de monitor unico.
  - DoD: modelo de estado soporta multi-destino serializable, comandos tipados por grupo y validacion de regresion en modo monitor unico.
  - Subtareas:
    - [ ] Redefinir modelo de asignacion playlist->monitor para soportar 1:N.
    - [ ] Definir estrategia de comandos (broadcast por grupo + ack/errores por monitor).
    - [ ] Adaptar UI para seleccionar multiples destinos con feedback claro.
    - [ ] Definir pruebas de sincronizacion basica y manejo de fallos parciales.

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

- [ ] **Captura y retransmision de aplicaciones externas**
  - Titulo: Compartir ventana de aplicacion externa en monitor secundario.
  - Prioridad: `V1` por alto impacto operativo para presentaciones y riesgo tecnico moderado (permisos/ciclo de vida de captura) que conviene abordar despues de estabilizar el flujo base del MVP.
  - Historia de usuario: como operador, quiero capturar una ventana de aplicacion externa y enviarla a un monitor secundario para mostrar contenido de terceros sin salir de Mythr Prism.
  - Dependencias: ventana secundaria activa y controlable, pipeline de render por monitor, estado de sesion en UI principal.
  - Descripcion tecnica:
    - [ ] Boton `Capturar App` en UI principal que dispare selector nativo con `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })`.
    - [ ] Envio del stream a la ventana secundaria activa sin recargar su contexto.
    - [ ] Render en modo `contain` preservando aspect ratio del origen.
    - [ ] Control de parada desde UI principal y sincronizacion con parada nativa del navegador (`track.onended`).
    - [ ] Manejo de cancelacion y errores sin romper reproduccion ni controles existentes.
  - Notas de implementacion:
    - `MediaStream` no es serializable por `postMessage`; evitar diseno que dependa de pasarlo entre ventanas de forma directa.
    - Enfoque A (preferido): iniciar `getDisplayMedia` desde ventana secundaria cuando sea viable, coordinando por mensajes de control.
    - Enfoque B (avanzado): relay por `canvas`/`WebRTC` local si A no cumple restricciones de permisos o UX.
  - Criterios de aceptacion:
    - [ ] Al pulsar `Capturar App`, el navegador abre el selector nativo y permite elegir ventana.
    - [ ] Al confirmar seleccion, la ventana secundaria activa muestra el stream sin recarga.
    - [ ] El contenido se visualiza en `contain` sin distorsion y sin recorte no intencional.
    - [ ] Al detener desde UI principal o al terminar nativamente, la salida vuelve a estado seguro/fallback.
    - [ ] Si el usuario cancela o hay error de permisos/dispositivo, la app mantiene estado estable y comunica error accionable.
  - Subtareas:
    - [ ] Definir arquitectura de control entre ventana principal y secundaria (comandos, estados, retries).
    - [ ] Implementar accion `Capturar App` y capa de manejo de permisos/errores.
    - [ ] Implementar reproduccion del stream en ventana secundaria sin recarga.
    - [ ] Implementar modo de visualizacion `contain` y validacion de aspect ratio.
    - [ ] Implementar parada manual + escucha de `track.onended` + limpieza de recursos.
    - [ ] Añadir pruebas manuales guiadas para exito, cancelacion y error de permisos.
  - DoD:
    - [ ] Flujo completo validado en al menos 2 navegadores objetivo del proyecto.
    - [ ] No quedan tracks ni listeners activos al detener o cerrar captura.
    - [ ] Errores y cancelaciones muestran mensaje util y no bloquean otras funciones del monitor.
    - [ ] Documentacion minima del flujo y limitaciones agregada en `docs/`.
  - Riesgos:
    - Restricciones de permisos por contexto/gesto de usuario pueden limitar inicio remoto de captura.
    - Diferencias de comportamiento entre navegadores pueden requerir fallback por estrategia B.

- [ ] **Monitor virtual remoto (Cloud Sync)**
  - Titulo: Vincular dispositivos externos (tablets/moviles) como monitores virtuales via WebSockets.
  - Prioridad: `V1` por impacto alto en cobertura de uso real (extender salidas sin hardware dedicado) y dependencia de infraestructura cloud/latencia que conviene abordar despues de cerrar flujo base del MVP.
  - Historia de usuario: como operador, quiero vincular un tablet o movil externo como monitor virtual para sumar una salida adicional remota y controlarla en tiempo real desde Mythr Prism.
  - Dependencias: pipeline de render por salida, canal de comandos por monitor, definicion de identificador de sesion/sala, entorno cloud con endpoint publico seguro.
  - Descripcion tecnica:
    - [ ] Levantar servidor Node.js + Socket.io como puente de senalizacion y transporte bidireccional.
    - [ ] Generar `RoomID` por sesion/salida y publicar metadatos minimos de estado del monitor virtual.
    - [ ] Implementar emparejamiento por URL corta + QR y validacion con codigo de 6 digitos.
    - [ ] Implementar relay de imagenes (frames/comandos de render) desde host hacia cliente remoto.
    - [ ] Implementar relay de comandos de control/estado desde cliente remoto hacia host (full-duplex).
  - Subtareas:
    - [ ] Definir contrato de eventos Socket.io (`join`, `pair`, `frame`, `command`, `heartbeat`, `reconnect`).
    - [ ] Implementar modulo de creacion/expiracion de `RoomID` y politica de TTL.
    - [ ] Implementar UI de emparejamiento (URL, QR, ingreso de codigo) en host y cliente remoto.
    - [ ] Implementar pipeline de envio de imagen con estrategia de compresion y limitacion de fps configurable.
    - [ ] Implementar canal de comandos remoto (play/pause/next/estado) con confirmacion de entrega.
    - [ ] Implementar reconexion automatica al mismo `RoomID` con re-sincronizacion de estado.
    - [ ] Implementar pruebas manuales en red local y red publica con medicion de latencia.
  - Criterios de aceptacion:
    - [ ] El flujo de emparejamiento expone QR + codigo de 6 digitos y evita alta sin validacion.
    - [ ] Tras handshake exitoso, el dispositivo remoto queda dado de alta como monitor virtual utilizable desde la UI principal.
    - [ ] La latencia extremo a extremo se mantiene por debajo de 200 ms en condicion objetivo definida.
    - [ ] Ante cortes breves de red, el cliente reconecta automaticamente al mismo `RoomID` y recupera estado operativo.
    - [ ] El aislamiento por sala evita fuga de frames/comandos entre `RoomID` diferentes.
  - DoD:
    - [ ] Flujo completo validado en al menos 1 tablet y 1 movil con navegadores objetivo.
    - [ ] Telemetria minima registrada para conexion, desconexion, reconexion y latencia.
    - [ ] Pruebas de aislamiento verifican que no hay cruce de eventos entre salas.
    - [ ] Documentacion minima de arquitectura, limites y operativa agregada en `docs/`.
  - Riesgos/dependencias tecnicas:
    - Estrategia de compresion/envio de imagenes: requiere tuning de codec/calidad/fps para no saturar WebSocket.
    - Despliegue cloud del puente publico: impacto en costo, seguridad (TLS/origen) y proximidad regional para latencia.
    - Diferencias de aspect ratio/orientacion en tablet pueden exigir politicas `contain/cover` por salida.

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

1. [x] **[MVP] Playlist multimedia -> Modelo de item multimedia (video, imagen)** _(completado)_
2. [x] **[MVP] Playlist multimedia -> UI para alta/edicion/reordenado** _(completado)_
3. [x] **[MVP] Playlist multimedia -> Motor de reproduccion secuencial con avance manual/automatico** _(completado)_
4. [x] **[MVP] Playlist multimedia -> Persistencia local de playlist** _(completado)_
5. [ ] **[MVP] Video sincronizado -> Definir estrategia de sincronizacion (host + clientes)** _(en curso)_
6. [ ] **[MVP] Video sincronizado -> Implementar mensajes de sync (play/pause/seek/time)** _(pendiente)_
7. [ ] **[MVP][P1] Cerrar todas las ventanas -> Unificar criterio de "ventana abierta" + habilitacion de boton global** _(proximo)_
8. [ ] **[MVP][P2] Reorganizar interfaz principal -> Definir IA de Monitores/Playlist y reglas responsive** _(proximo)_
9. [ ] **[MVP][P3] Formularios complejos en dialogos -> Migrar primer formulario de alto impacto** _(proximo)_
10. [ ] **[MVP][P4] Rediseno UI + drag and drop -> Definir lineamientos MVP e integrar DnD con fallback subir/bajar** _(proximo)_
11. [ ] **[MVP][P5] Previsualizacion playlist -> Implementar pipeline imagen/video con fallback** _(proximo)_
12. [ ] **[MVP][P6] Playlist multi-destino -> Disenar modelo 1:N y comandos de grupo** _(proximo)_

## Notas

- Convencion sugerida para sprint: `- [ ] [FASE] Nombre de tarea -> referencia en seccion original`.
- Si una tarea se divide, mantener una tarea madre y subtareas hijas para no romper el calculo de progreso.
- Revisar este backlog al inicio y cierre de cada sprint.
- 2026-03-27: mejora aplicada en Playlist Manager para cargar imagen local y convertirla a `data:image/...` sin cambiar el estado de tareas del sprint.
- 2026-03-27: bugfix en persistencia de sesion para filtrar playlist a campos serializables y tolerar `DataCloneError` al clonar snapshots.
- 2026-03-27: motor de reproduccion secuencial implementado con monitor objetivo, controles Start/Pause/Next/Previous/Stop, avance automatico y estado minimo de playback persistido en `localStorage`.
- 2026-03-27: persistencia robusta de playlist/playback completada con hidratacion defensiva (indice/autoplay), migracion minima de claves legacy de playback y saneamiento de monitor objetivo tras redeteccion.
- 2026-03-27: bugfix de reactividad en `App.vue` para monitor objetivo, separando watchers de validacion/pausa y eliminando dependencia `deep` sobre `monitorStates` que provocaba ciclo recursivo al actualizar playback.
- 2026-03-30: se incorporan 6 iniciativas MVP adicionales (P1..P6) para UX/operacion y se ajusta secuencia del sprint sin marcar nuevos completados.
