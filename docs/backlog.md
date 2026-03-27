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
