# Backlog y seguimiento del proyecto Mythr Prism

Ultima actualizacion: 2026-03-31

## Resumen

Este documento es la lista viva de tareas del proyecto/feature Mythr Prism para proyeccion/control de contenido multi-monitor.

Nota Mantenimiento (2026-03-31): se completo la reestructuracion a monorepo PNPM; el frontend se movio a `mythr-prism-front/`, se agrego scaffold `mythr-prism-back/` y la orquestacion global queda en la raiz (`README.md`, `package.json`, `pnpm-workspace.yaml`). Este backlog continua en `mythr-prism-front/docs/backlog.md`.
Nota Roadmap (2026-03-31): cierre formal de MVP completado al 100%; a partir de este punto el foco operativo pasa a V1.

Nota UX (2026-03-30): en Playlist se reforzo comportamiento operativo de modales con overlay fijo + bloqueo de scroll de fondo, y se aplico truncado visual de `source` largos (incluye data URI) manteniendo valor completo por `title`.
Nota Bugfix/UX (2026-03-30): se robustecio el manejo de fullscreen en ventanas esclavas frente a salidas forzadas por navegador/SO (ej. al abrir file picker en la ventana principal): ahora se detecta perdida externa via `fullscreenchange`, se conserva la intencion de fullscreen por monitor, se habilita CTA de reactivacion rapida en la esclava (`Reactivar Fullscreen`) y el master muestra feedback explicito con los monitores afectados.
Nota Bugfix (2026-03-30): en runtime de ventana esclava se elimino la reinicializacion agresiva de `<video>` (`video.load()` en transiciones de contenido) para evitar salidas involuntarias de fullscreen durante `SET_IMAGE`/`SET_MEDIA`; se agregaron pruebas de regresion para validar que esos mensajes no disparan operaciones de salida de fullscreen.
Nota Bugfix (2026-03-30): se corrigio estado "congelado" en ventana esclava tras repetir ciclo fullscreen -> volver al master -> seleccionar archivo; ahora la solicitud de fullscreen tiene guardas ante promesas pendientes, se agrego cierre local visible (overlay + boton rapido) y el master envia `REQUEST_CLOSE` como failsafe antes de cerrar, con pruebas de regresion para repeticion de flujo y comandos de cierre.
Nota Bugfix Critico (2026-03-30): se elimino el bloqueo al seleccionar imagen despues de una salida de fullscreen provocada por file picker; el master ya no envia data URI pesadas por `postMessage` (usa `blob:` runtime + `data:` persistible), la esclava aplica imagen de forma diferida/no bloqueante con trazas acotadas de eventos clave y se agregaron pruebas de regresion del flujo abrir/cancelar + seleccionar + cierre local/remoto.
Nota Bugfix (2026-03-30): se elimino la causa raiz del freeze tras salida forzada de fullscreen sin evento `fullscreenchange` (al abrir selector de archivo en master): el runtime esclavo ahora reconcilia estado via `focus`/`visibilitychange` + watchdog, evita clears por payloads invalidos (`SET_IMAGE`/`SET_MEDIA`) y agrega cierre robusto (salida de fullscreen + fallback de error) sin recrear ventana.
Nota Bugfix Critico (2026-03-30): se identifico causa raiz adicional del freeze al mero click en `Seleccionar archivo` (sin `change`): el master escuchaba `pagehide` y ejecutaba `shutdownAllWindows`, enviando `REQUEST_CLOSE` durante la apertura del file picker; se retiro ese cierre por `pagehide`, se mantiene cierre por `beforeunload`/desmontaje y se agrego regresion para validar que la ventana esclava sigue operable y cerrable tras ese click.
Nota Bugfix Critico (2026-03-30): se retiro una mitigacion inestable en la esclava (`focus`/`visibilitychange` + watchdog) porque reintroducia rutas de reconciliacion agresiva durante apertura de file picker en master; el runtime queda acotado a eventos minimos (`fullscreenchange` + accion explicita) con dedupe/throttle estricto de `FULLSCREEN_STATUS` para evitar floods y preservar estabilidad de cierre local/remoto.
Nota Bugfix Critico (2026-03-30): se implementaron 3 mitigaciones end-to-end para fullscreen + file picker: (1) bloqueo del selector nativo cuando existe al menos una esclava en fullscreen, con feedback operativo y fallback recomendado; (2) import de imagen por Drag & Drop y pegado desde portapapeles en Monitores y formularios de Playlist; (3) apertura de esclavas en ruta same-origin (`/slave.html?monitorId&instanceToken`) para eliminar dependencia del popup `blob:` y reducir congelamientos asociados al dialogo nativo.
Nota UX (2026-03-30): se unifico el patron de import por archivo en todos los puntos `Seleccionar archivo` (Monitores + alta/edicion de Playlist) incorporando `dragenter/dragover/dragleave/drop`, estado visual activo de drop target y mensaje explicito para archivos no imagen, manteniendo pegado desde portapapeles y seleccion manual segun estado de fullscreen.
Nota UX (2026-03-30): en las tabs de cabecera `Monitores/Playlist` se ajusto el layout a icono sobre texto y se escalo ligeramente el tamano de iconos, manteniendo semantica accesible y comportamiento actual.
Nota UX (2026-03-30): se movieron las tabs globales `Monitores/Playlist` a la cabecera de la app y la accion `Cerrar todas las ventanas` paso a la barra contextual de Monitores junto al filtro de visibilidad.
Nota Mantenimiento (2026-03-30): se movio la hoja global a `src/assets/styles/style.css` y se extrajeron clases semanticas reutilizables (botones, modales, tabs, tarjetas y filas de formulario) para reducir utilidades Tailwind repetidas sin cambios funcionales.
Nota Mantenimiento (2026-03-30): se corrigieron warnings de analisis estatico en `App.vue` y `PlaylistManager.vue` (checks `typeof` redundantes y jerarquia HTML invalida dentro de boton de thumbnail) sin cambios funcionales.
Nota UX (2026-03-30): en los dialogos actuales de Playlist (preview/alta/edicion) se estandarizo boton de cierre en header (derecha, con `aria-label`), se elimino cierre redundante en footer de preview y se mantuvieron acciones de formulario (`Guardar/Cancelar`) sin duplicar cierre generico.
Nota Bugfix (2026-03-30): los modales de Playlist (preview/alta/edicion) ahora se renderizan con `Teleport` a `body` para evitar desplazamientos del backdrop/dialogo causados por contextos de posicionamiento en contenedores con efectos visuales; se agregaron pruebas de regresion de anclaje a viewport.
Nota Bugfix (2026-03-30): se corrigio la replicacion en modo espejo cuando el origen envia imagen; el destino ya no recibe un `SET_MEDIA` nulo despues del `SET_IMAGE`, por lo que deja el estado "Esperando contenido..." y mantiene degradacion parcial si algun destino no esta disponible.
Nota Bugfix (2026-03-30): al salir/recargar la pantalla master se intenta cerrar automaticamente todas las ventanas esclavas via `beforeunload` (y desmontaje de app), con cierre tolerante a errores para evitar pantallas huerfanas bloqueadas.
Nota Bugfix/UX (2026-03-30): modo espejo ahora preserva visualizacion del origen durante la replicacion, al desactivar limpia de inmediato contenido espejado en destinos abiertos y resetea configuracion (`enabled=false`, `source=null`, `destinations=[]`); ademas, el control de activacion se reemplazo por boton de accion claro (`Iniciar espejo`/`Finalizar espejo`).
Nota Mantenimiento (2026-03-30): se corrigieron warnings por `max-w` duplicado en `PlaylistManager.vue` extrayendo el ancho de modal a variantes reutilizables (`app-modal-panel--sm/md/lg`) y eliminando utilidades redundantes en template.
Nota Mantenimiento (2026-03-30): se corrigio nullability en `PlaylistManager.vue` (TS18047) al editar `muted` de video, encapsulando el cambio en un handler tipado con guard explicito de `editingItem` sin cambios de UX/flujo.
Nota UX (2026-03-30): se aplico una convencion global para modales activos de Playlist (alta, edicion, preview): centrados en viewport, con `max-h/max-w` relativos a pantalla, `body` con scroll interno y `header/footer` sticky siempre visibles.
Nota UX (2026-03-30): la thumbnail de cada item en Playlist ahora abre un modal de vista ampliada con cierre por boton/Escape/click fuera, metadata del item y fallback claro cuando la preview no esta disponible.
Nota UX (2026-03-30): se limpiaron textos de botones de apertura de dialogo (sin mencionar "modal") y se unifico el estilo de checkboxes inline con un componente reutilizable accesible (`AppCheckbox`).
Nota UX (2026-03-30): en cada item de playlist los controles `Subir`, `Bajar`, `Editar` y `Eliminar` se mostraron en una sola fila con `flex-nowrap`; en pantallas estrechas el bloque de acciones usa `overflow-x-auto` para evitar salto de linea.
Nota UX (2026-03-30): se introdujo iconografia consistente con Heroicons en botones y cabeceras de dialogos (icono + texto, iconos decorativos con `aria-hidden="true"`) para mejorar legibilidad operativa sin saturar la interfaz.
Nota UX (2026-03-30): en formularios de alta/edicion de Playlist se refino el layout por filas (Titulo/Tipo, Source/Archivo local, Duracion-Inicio-Fin y fila final de `Mute` con ayuda contextual) manteniendo validaciones y flujo actual.
Nota UX (2026-03-30): la lista de Playlist adopta jerarquia visual tipo tarjetas y agrega drag and drop nativo con feedback de item arrastrado/destino, manteniendo `Subir/Bajar` como fallback accesible.

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
| MVP | 100% |
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

- [x] **Cerrar todas las ventanas (habilitacion por estado)**
  - Prioridad: `P1`.
  - Objetivo: evitar acciones vacias y mejorar control operativo mostrando el boton solo habilitado cuando exista al menos una ventana abierta.
  - Dependencias/riesgos: depende de fuente de verdad confiable para ventanas activas; riesgo de estado desincronizado tras cierre manual del navegador.
  - Criterio de aceptacion: boton `Cerrar todas las ventanas` deshabilitado con 0 ventanas abiertas y habilitado automaticamente con >=1.
  - DoD: comportamiento validado en flujo abrir/cerrar/reabrir ventanas y sin regresion en comandos de cierre individuales.
  - Subtareas:
    - [x] Unificar criterio de "ventana abierta" en estado serializable de sesion.
    - [x] Conectar estado derivado al boton global de cierre.
    - [x] Sincronizar cambios por cierre manual de ventanas secundarias.
    - [x] Agregar prueba de regresion de habilitacion/deshabilitacion.

- [x] **Reorganizar interfaz principal (Monitores/Playlist)**
  - Prioridad: `P2`.
  - Objetivo: separar responsabilidades principales en una estructura simple (pestanas o equivalente) para reducir saturacion cognitiva.
  - Dependencias/riesgos: depende de definir layout responsive base; riesgo de aumentar pasos para acciones frecuentes si el flujo no queda directo.
  - Criterio de aceptacion: Monitores y Playlist quedan en secciones separadas, navegables en desktop y mobile sin perdida de funciones actuales.
  - DoD: flujo principal (abrir monitor, seleccionar contenido, controlar playback) se completa sin buscar controles en paneles no relacionados.
  - Subtareas:
    - [x] Definir estructura IA minima (tabs o switch de vistas) y reglas responsive.
    - [x] Mover controles de monitores a su seccion dedicada.
    - [x] Mover gestion de playlist a su seccion dedicada.
    - [x] Verificar accesos rapidos para acciones criticas entre secciones.

- [x] **Formularios complejos en dialogos modales**
  - Prioridad: `P3`.
  - Objetivo: reducir carga visual trasladando formularios de alta/edicion compleja a modales enfocados por contexto.
  - Dependencias/riesgos: depende de la reorganizacion de interfaz principal; riesgo de perder contexto del item editado si el modal no refleja estado previo.
  - Criterio de aceptacion: formularios extensos ya no ocupan panel permanente y se abren/cerran via modal con foco y escape controlados.
  - DoD: formularios preservan validaciones actuales, accesibilidad basica (foco inicial/retorno) y no bloquean operacion general.
  - Subtareas:
    - [x] Inventariar formularios complejos candidatos (playlist, monitor, ajustes).
    - [x] Definir patron unico de modal con props/emits tipados.
    - [x] Migrar formulario de mayor impacto al nuevo patron.
    - [x] Validar cierre seguro con cambios sin guardar (confirmacion o descarte explicito).

- [x] **Rediseno UI + reordenado playlist por drag and drop**
  - Prioridad: `P4`.
  - Estado: `completed`.
  - Objetivo: mejorar percepcion de calidad (limpia/amigable/atractiva) e incorporar drag and drop sin eliminar botones subir/bajar.
  - Dependencias/riesgos: depende de estructura de interfaz definida; riesgo de inconsistencias de UX entre desktop y tactil.
  - Criterio de aceptacion: interfaz adopta lineamientos visuales unificados y la playlist permite reordenado por arrastre, manteniendo metodo actual por botones.
  - DoD: drag and drop funciona con feedback visual, persiste orden correcto y convive con accesibilidad por controles alternativos.
  - Subtareas:
    - [x] Definir lineamientos visuales MVP (tipografia, espaciado, jerarquia y feedback).
    - [x] Aplicar rediseno incremental en vistas de Monitores y Playlist.
    - [x] Integrar interaccion drag and drop en lista de playlist.
    - [x] Mantener y validar botones subir/bajar como fallback accesible.

- [x] **Previsualizacion de items de playlist (incluye video)**
  - Prioridad: `P5`.
  - Estado: `completed`.
  - Objetivo: mostrar preview por item para mejorar identificacion rapida de contenido antes de reproducir.
  - Dependencias/riesgos: depende de normalizacion de origen de media; riesgo CORS/decodificacion en videos remotos y costo de CPU por captura de fotograma.
  - Criterio de aceptacion: cada item de playlist muestra miniatura; en video se intenta capturar frame y, si falla, se usa fallback visual consistente.
  - DoD: no se bloquea la UI al generar thumbnails y se reportan fallos de preview sin romper playback.
  - Subtareas:
    - [x] Implementar pipeline de preview para imagenes con cache local.
    - [x] Implementar intento de captura de frame para videos (con timeout y fallback).
    - [x] Definir placeholders para estados `loading`, `error`, `cors-blocked`.
    - [x] Limitar concurrencia/frecuencia para evitar picos de consumo.

- [x] **Playlist multi-destino (una playlist en multiples pantallas)**
  - Prioridad: `P6`.
  - Estado: `completed`.
  - Objetivo: permitir asignar una misma playlist a mas de una salida externa de forma simultanea y controlada.
  - Dependencias/riesgos: depende de contrato de comandos master-slave y modelo de playback; riesgo de conflictos de estado (play/pause/seek) entre destinos.
  - Criterio de aceptacion: operador puede asignar N monitores a una playlist y ejecutar controles coherentes por grupo sin romper flujo de monitor unico.
  - DoD: modelo de estado soporta multi-destino serializable, comandos tipados por grupo y validacion de regresion en modo monitor unico.
  - Subtareas:
    - [x] Redefinir modelo de asignacion playlist->monitor para soportar 1:N.
    - [x] Definir estrategia de comandos (broadcast por grupo + ack/errores por monitor).
    - [x] Adaptar UI para seleccionar multiples destinos con feedback claro.
    - [x] Definir pruebas de sincronizacion basica y manejo de fallos parciales.

- [x] **Video sincronizado**
  - Estado: `completed`.
  - Dependencias: playlist multimedia, reloj/timestamp compartido.
  - Hecho: multiples monitores reproducen el mismo video con desfase maximo aceptable.
  - Subtareas:
    - [x] Definir estrategia de sincronizacion (host + clientes).
    - [x] Implementar mensajes de sync (play/pause/seek/time).
    - [x] Medicion de drift y correccion periodica.
    - [x] Prueba manual en setup multi-monitor.

- [x] **Guardado/restauracion de layouts**
  - Dependencias: modelo de escenas/layout actual.
  - Hecho: se puede guardar un layout nombrado y restaurarlo sin perdida de configuracion.
  - Subtareas:
    - [x] Base de persistencia de sesion/config en `localStorage` (schema versionado + hidratacion segura).
    - [x] Esquema de serializacion de layout.
    - [x] Acciones guardar/cargar desde UI.
    - [x] Validacion de compatibilidad entre versiones.

- [x] **Modo espejo**
  - Estado: `completed`.
  - Dependencias: asignacion de salidas/monitores.
  - Hecho: una salida replica otra con estabilidad y control de activacion/desactivacion.
  - Subtareas:
    - [x] Selector de origen de espejo.
    - [x] Pipeline de render compartido/duplicado.
    - [x] Pruebas de rendimiento basicas.

- [x] **Thumbnails**
  - Estado: `completed`.
  - Dependencias: pipeline de render por salida.
  - Hecho: la UI muestra previews actualizadas de cada monitor sin bloquear interaccion.
  - Subtareas:
    - [x] Captura periodica de frame reducido.
    - [x] Grid de miniaturas en panel de control.
    - [x] Estrategia de refresh y limite de frecuencia.

- [x] **Pizarra en vivo**
  - Estado: `completed`.
  - Dependencias: capa interactiva sobre salida.
  - Hecho: usuario dibuja en tiempo real y puede limpiar/rehacer sobre la proyeccion.
  - Subtareas:
    - [x] Herramienta de trazo (color, grosor).
    - [x] Borrado global y undo basico.
    - [x] Sincronizacion de overlay en monitor objetivo.

## V1

### Arranque V1 (checklist corto)

- [ ] Tomar la primera feature V1 desde rama `feature/<nombre>` creada desde `development`.
- [ ] Priorizar un item de alto impacto y bajo riesgo para primer corte (recomendado: `Flash ID monitores`).
- [ ] Definir criterio de aceptacion y validacion minima antes de marcar `in-progress`.
- [ ] Integrar por merge a `development`; luego promover `development` -> `main` al cerrar el lote.

- [x] **Flash ID monitores**
  - Dependencias: deteccion/listado de monitores.
  - Hecho: cada monitor puede mostrar un identificador temporal para mapeo fisico.
  - Subtareas:
    - [x] Comando de flash por monitor.
    - [x] Overlay numerico de alta visibilidad.
    - [x] Timeout y retorno automatico a estado previo.

- [x] **Transiciones**
  - Dependencias: cambio de escena/layout funcional.
  - Hecho: cambios de contenido aplican transiciones seleccionables sin artefactos visibles.
  - Subtareas:
    - [x] Catalogo inicial (cut, fade, wipe).
    - [x] Parametros de duracion.
    - [x] Integracion en flujo de cambio de escena.

- [x] **URLs externas**
  - Dependencias: renderer web embebido seguro.
  - Hecho: se cargan URLs permitidas con controles minimos de navegacion y fallback en error.
  - Subtareas:
    - [x] Politica de allowlist/bloqueo.
    - [x] Carga y recarga controlada.
    - [x] Estado de error y recovery visual.

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

- [ ] **Expansion de transiciones (catalogo avanzado)**
  - Dependencias: motor de transiciones V1 integrado en flujo de cambio de escena.
  - Hecho: el catalogo de transiciones se amplia con variantes avanzadas aplicables sin artefactos visibles en cambios de contenido.
  - Subtareas:
    - [ ] Slide (left/right/up/down).
    - [ ] Zoom in/out.
    - [ ] Dip to black/white.
    - [ ] Blur.
    - [ ] Push.
    - [ ] Cross-zoom.
    - [ ] Iris.
    - [ ] Pixelate.

## Sprint actual

> Plan operativo inmediato del MVP (orden sugerido de ejecucion).

1. [x] **[MVP] Playlist multimedia -> Modelo de item multimedia (video, imagen)** _(completado)_
2. [x] **[MVP] Playlist multimedia -> UI para alta/edicion/reordenado** _(completado)_
3. [x] **[MVP] Playlist multimedia -> Motor de reproduccion secuencial con avance manual/automatico** _(completado)_
4. [x] **[MVP] Playlist multimedia -> Persistencia local de playlist** _(completado)_
5. [x] **[MVP] Video sincronizado -> Definir estrategia de sincronizacion (host + clientes)** _(completado)_
6. [x] **[MVP] Video sincronizado -> Implementar mensajes de sync (play/pause/seek/time)** _(completado)_
7. [x] **[MVP][P1] Cerrar todas las ventanas -> Unificar criterio de "ventana abierta" + habilitacion de boton global** _(completado)_
8. [x] **[MVP][P2] Reorganizar interfaz principal -> Definir IA de Monitores/Playlist y reglas responsive** _(completado)_
9. [x] **[MVP][P3] Formularios complejos en dialogos -> Migrar primer formulario de alto impacto** _(completado)_
10. [x] **[MVP][P4] Rediseno UI + drag and drop -> Definir lineamientos MVP e integrar DnD con fallback subir/bajar** _(completado)_
11. [x] **[MVP][P5] Previsualizacion playlist -> Implementar pipeline imagen/video con fallback** _(completado)_
12. [x] **[MVP][P6] Playlist multi-destino -> Disenar modelo 1:N y comandos de grupo** _(completado)_
13. [x] **[MVP] Guardado/restauracion de layouts -> Esquema de serializacion de layout** _(completado)_
14. [x] **[MVP] Guardado/restauracion de layouts -> Acciones guardar/cargar desde UI** _(completado)_
15. [x] **[MVP] Modo espejo -> Selector de origen de espejo** _(completado)_
16. [x] **[MVP] Thumbnails -> Captura periodica de frame reducido** _(completado)_

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
- 2026-03-30: P1 completado con habilitacion/deshabilitacion del boton global de cierre segun ventanas abiertas y test de regresion del header.
- 2026-03-30: P2 completado con separacion de Monitores/Playlist mediante tabs en la vista principal, manteniendo flujo existente y agregando pruebas de UI basicas para navegacion entre secciones.
- 2026-03-30: P3 completado migrando formularios complejos de Playlist a modales accesibles (alta/edicion) con cierre por escape/backdrop y pruebas de apertura/guardado/cancelacion.
- 2026-03-30: Video sincronizado (paso 1) completado con estrategia host+clientes tipada (`videoSync`) y visualizacion operativa en Playlist para identificar host, clientes y tolerancias antes de implementar mensajes de sync.
- 2026-03-30: Video sincronizado completado end-to-end con mensajes `play/pause/seek/time`, resincronizacion periodica con tolerancia de drift, integracion con playlist multi-destino y degradacion elegante ante destinos no listos o con fallo parcial.
- 2026-03-30: completadas acciones de UI para guardar/cargar/eliminar layouts con feedback operativo y proteccion de sobrescritura/eliminacion accidental; se agregaron pruebas de regresion de flujo y se marco el siguiente item de MVP (`Modo espejo`) en curso.
- 2026-03-30: Modo espejo completado end-to-end con UI de activacion/origen/destinos, replicacion de estado (transform/media/imagen) origen->destinos, prevencion de ciclos y degradacion operativa con feedback cuando destinos espejo no estan disponibles.
- 2026-03-31: Thumbnails completado para MVP operativo actual: runtime esclavo emite captura reducida periodica con limite de frecuencia, el master mantiene estado de miniaturas por monitor no persistente y Monitores incorpora grid de previews en vivo con fallback claro.
- 2026-03-31: Pizarra en vivo completado para MVP: cada tarjeta de monitor secundario permite abrir pizarra, la edicion en master usa referencia de miniatura y sincroniza overlay de trazos (set/undo/clear) en runtime esclavo sin romper fullscreen/thumbnail/handshake.
- 2026-03-31: Mejora UX post-MVP de pizarra en vivo: toolbar visual con botones iconograficos accesibles (herramientas, color, grosor, undo, limpiar) y nuevas formas basicas (flecha/circulo/rectangulo/linea) con preview click+drag sincronizado al overlay slave.
