# Backlog y seguimiento del proyecto Mythr Prism

Ultima actualizacion: 2026-04-05

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
| MVP | 100% |
| V1 | 100% |
| V2 | 0% |

> Referencia de calculo sugerida: `tareas completadas / tareas totales de la fase * 100`.

### Plan de implementacion

- Estado del plan: `ejecutado en ramas feature y validado en development`.
- Ramas propuestas (incremental):
  - `feature/remote-monitor-f0-contracts-ui`
  - `feature/remote-monitor-f1-pairing-flow`
  - `feature/remote-monitor-f2-content-compat`
  - `feature/remote-monitor-f3-resilience-observability`
- Regla de integracion:
  - Cada fase mergea a `development` solo con DoD de fase cumplido.
  - `development` -> `main` unicamente tras cerrar F3 + checklist front/back de despliegue.
- Gate de inicio:
  - [x] OK explicito del usuario para iniciar implementacion funcional.

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

**Progreso V1 (features): 100% (7/7 completadas)**

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

- [x] **Captura y retransmision de aplicaciones externas**
  - Titulo: Compartir ventana de aplicacion externa en monitor secundario.
  - Prioridad: `V1` por alto impacto operativo para presentaciones y riesgo tecnico moderado (permisos/ciclo de vida de captura) que conviene abordar despues de estabilizar el flujo base del MVP.
  - Historia de usuario: como operador, quiero capturar una ventana de aplicacion externa y enviarla a un monitor secundario para mostrar contenido de terceros sin salir de Mythr Prism.
  - Dependencias: ventana secundaria activa y controlable, pipeline de render por monitor, estado de sesion en UI principal.
  - Descripcion tecnica:
    - [x] Boton `Capturar App` en UI principal que dispare selector nativo con `navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })`.
    - [x] Envio del stream a la ventana secundaria activa sin recargar su contexto.
    - [x] Render en modo `contain` preservando aspect ratio del origen.
    - [x] Control de parada desde UI principal y sincronizacion con parada nativa del navegador (`track.onended`).
    - [x] Manejo de cancelacion y errores sin romper reproduccion ni controles existentes.
  - Notas de implementacion:
    - `MediaStream` no es serializable por `postMessage`; evitar diseno que dependa de pasarlo entre ventanas de forma directa.
    - Enfoque A (preferido): iniciar `getDisplayMedia` desde ventana secundaria cuando sea viable, coordinando por mensajes de control.
    - Enfoque B (avanzado): relay por `canvas`/`WebRTC` local si A no cumple restricciones de permisos o UX.
  - Criterios de aceptacion:
    - [x] Al pulsar `Capturar App`, el navegador abre el selector nativo y permite elegir ventana.
    - [x] Al confirmar seleccion, la ventana secundaria activa muestra el stream sin recarga.
    - [x] El contenido se visualiza en `contain` sin distorsion y sin recorte no intencional.
    - [x] Al detener desde UI principal o al terminar nativamente, la salida vuelve a estado seguro/fallback.
    - [x] Si el usuario cancela o hay error de permisos/dispositivo, la app mantiene estado estable y comunica error accionable.
  - Subtareas:
    - [x] Definir arquitectura de control entre ventana principal y secundaria (comandos, estados, retries).
    - [x] Implementar accion `Capturar App` y capa de manejo de permisos/errores.
    - [x] Implementar reproduccion del stream en ventana secundaria sin recarga.
    - [x] Implementar modo de visualizacion `contain` y validacion de aspect ratio.
    - [x] Implementar parada manual + escucha de `track.onended` + limpieza de recursos.
    - [x] Añadir pruebas manuales guiadas para exito, cancelacion y error de permisos.
  - DoD:
    - [x] Flujo completo validado en al menos 2 navegadores objetivo del proyecto.
    - [x] No quedan tracks ni listeners activos al detener o cerrar captura.
    - [x] Errores y cancelaciones muestran mensaje util y no bloquean otras funciones del monitor.
    - [x] Documentacion minima del flujo y limitaciones agregada en `docs/`.
  - Riesgos:
    - Restricciones de permisos por contexto/gesto de usuario pueden limitar inicio remoto de captura.
    - Diferencias de comportamiento entre navegadores pueden requerir fallback por estrategia B.

- [x] **Fuentes de monitor en modal con pestanas**
  - Prioridad: `V1` por mejora de usabilidad operativa; reduce ruido visual en tarjetas de monitor y mantiene un flujo focalizado por tipo de fuente.
  - Historia de usuario: como operador, quiero abrir un unico dialogo para elegir y operar la fuente del monitor (imagen local, URL o app externa) sin ver tres bloques simultaneos.
  - Dependencias: barra de acciones del monitor, patron global de modales (`overlay fijo + header/body/footer + escape`), eventos actuales de carga/URL/captura externa.
  - Estado: `completed`.
  - Descripcion tecnica:
    - [x] Agregar boton `Fuentes` en la fila de acciones del monitor (a la izquierda de `Pizarra`).
    - [x] Migrar controles de `Imagen local`, `URL externa` y `Aplicacion externa` a un modal con tabs accesibles (`tablist/tab/tabpanel`).
    - [x] Conservar handlers y feedback actuales (upload/drop/paste/clear, set/reload/back/forward/clear URL, start/stop captura app).
    - [x] Retirar bloques inline legacy para mantener la tarjeta compacta.
  - Subtareas:
    - [x] Implementar estado/UX del modal de fuentes con bloqueo de scroll y cierre por Escape/boton.
    - [x] Implementar tabs con estado activo y contenido exclusivo por fuente.
    - [x] Reubicar acciones de limpiar/detener como acciones contextuales del footer.
    - [x] Ajustar estilos semanticos y tests de regresion de UI/eventos.
  - Criterios de aceptacion:
    - [x] Existe un boton `Fuentes` visible en controles de monitor externo, ubicado antes de `Pizarra`.
    - [x] El modal abre/cierra correctamente por boton, cierre de cabecera y Escape, sin scroll de fondo.
    - [x] Solo se visualiza una fuente activa por vez en interfaz (sin triple bloque simultaneo).
    - [x] No hay regresiones en emisiones de eventos para import de imagen, URL externa y captura de app.
  - DoD:
    - [x] Cobertura de tests para apertura/cierre modal, tabs y eventos criticos de cada fuente.
    - [x] Validacion minima ejecutada (`typecheck`, `test`, `build`) sin regresiones.

- [x] **Monitor virtual remoto (Cloud Sync)**
  - Titulo: Integrar clientes remotos (`/remote`) como monitores virtuales de sesion usando senalizacion Socket.io y transporte WebRTC.
  - Estado: `completed`.
  - Prioridad: `V1` critica por impacto operativo directo (sumar salidas remotas sin hardware dedicado).
  - Historia de usuario: como operador, quiero emparejar tablets/moviles por URL/QR para que aparezcan como monitores disponibles y reciban el mismo pipeline de contenido que un monitor local.
  - Alcance confirmado:
    - Multiples monitores remotos por sesion.
    - Flujo de pairing host-driven con codigo ingresado solo por cliente (`XXXX-XXXX-XXXX`) y validacion en host.
    - Cierre automatico de sala si no conecta ningun cliente en 5 minutos.
    - Cliente remoto con capacidades acotadas: mostrar contenido, cerrar sesion remota, intentar fullscreen/kiosko.
    - Estados UI minimos: `conectando`, `emparejado`, `reconectando`, `caido`.
    - Compatibilidad obligatoria con fuentes actuales (imagen, URL externa, captura app, playlist, pizarra, transiciones) y `mirror mode`.
  - Decisiones de arquitectura (alineadas con backend):
    - Senalizacion: `Socket.io` (Node) para lifecycle de salas, pairing, heartbeat, reconexion y observabilidad.
    - Transporte de contenido: `WebRTC` preferido para stream host->remote (video/canvas con target ideal `25fps`), dejando Socket.io para control + fallback degradado.
    - Modelo de sala: `roomId` efimero + `pairCode` de alta entropia `XXXX-XXXX-XXXX`, con estado en Redis y TTL de 5 min sin clientes.
    - Seguridad base: CORS abierto temporalmente, rate limit de intentos no aprobados por IP+room y baneo temporal escalonado.
    - Observabilidad desde fase 0: logs estructurados y metricas de pairing, sesiones, reconexion, latencia y fps efectivo.
  - Plan por fases (front):
      - [x] **Fase F0 - Contratos UI/estado y shell remoto**
        - Entregables:
          - [x] Especificar tipos compartidos para estado remoto y eventos de lifecycle UI.
          - [x] Crear ruta `/remote` con layout minimo operativo y estados `conectando/emparejado/reconectando/caido`.
          - [x] Definir contrato de presentacion para modo solo-visualizacion + acciones `Cerrar sesion` y `Intentar fullscreen`.
        - Criterios de aceptacion:
          - [x] El cliente remoto muestra estados consistentes sin backend real (mocks/fixtures locales).
          - [x] El host incorpora boton en bloque `Monitores disponibles` para abrir modal de pairing.
        - DoD fase:
          - [x] Tipado estricto sin `any` en contratos remotos front.
          - [x] Pruebas de UI para estados y accesibilidad basica del modal/ruta remota.
      - [x] **Fase F1 - Pairing UX host/cliente**
        - Entregables:
          - [x] Modal host con creacion de sala, URL/QR y estado de espera.
          - [x] Pantalla cliente con ingreso de `pairCode` `XXXX-XXXX-XXXX`.
          - [x] Alta del remoto como monitor disponible en listado principal al emparejar.
        - Criterios de aceptacion:
          - [x] Host crea sala y, si no entra cliente, UI refleja expiracion a los 5 minutos.
          - [x] Solo el cliente ingresa codigo; host valida y confirma emparejamiento.
        - DoD fase:
          - [x] E2E de pairing feliz + expiracion + codigo invalido.
          - [x] Telemetria de eventos de pairing visible en frontend (sin instrumentacion productiva final).
      - [x] **Fase F2 - Integracion de monitor remoto en pipeline de contenido**
        - Entregables:
          - [x] Adaptar selector/asignacion de destinos para incluir remotos junto a locales.
          - [x] Garantizar compatibilidad funcional con imagen, URL, captura app, playlist, pizarra, transiciones y mirror.
          - [x] Feedback por monitor remoto para estado de sincronizacion y errores parciales.
        - Criterios de aceptacion:
          - [x] Un remoto emparejado puede operar como cualquier destino actual en los flujos existentes.
          - [x] Mirror mode replica hacia remotos sin romper destinos locales.
        - DoD fase:
          - [x] Suite de regresion actualizada para fuentes y mirror con al menos un destino remoto mockeado.
          - [x] Sin regresiones visibles en flujo de monitor local.
      - [x] **Fase F3 - Resiliencia UX y calidad percibida**
        - Entregables:
          - [x] Manejo de reconexion automatica y resincronizacion de estado visible.
          - [x] Superficies de error accionables para caidas de red, timeouts y rechazo por anti abuso.
          - [x] Ajustes de feedback de rendimiento (fps objetivo vs real en modo diagnostico).
        - Criterios de aceptacion:
          - [x] Ante corte breve, UI transiciona a `reconectando` y vuelve a `emparejado` al recuperar enlace.
          - [x] Ante corte sostenido, UI pasa a `caido` sin congelar controles globales.
        - DoD fase:
          - [x] Pruebas manuales guiadas en tablet + movil + desktop responsive.
          - [x] Checklist de validacion minimo completo (`typecheck`, `test`, `build`).
  - Riesgos/dependencias tecnicas:
    - Rendimiento en red variable: riesgo de no sostener 25fps, mitigado con degradacion adaptativa de calidad/fps.
    - Complejidad de compatibilidad de fuentes existentes: mitigar con rollout por feature flag y matriz de pruebas por fuente.
    - Fullscreen/kiosko en navegadores moviles: mitigar con UX explicita de limitaciones y reintento guiado.

- [x] **Filtros en caliente**
  - Dependencias: pipeline grafico con parametros runtime.
  - Hecho: se pueden aplicar y ajustar filtros durante reproduccion sin reiniciar salida.
  - Estado: `completed`.
  - Subtareas:
    - [x] API interna de filtros encadenados.
    - [x] UI de ajuste rapido.
    - [x] Persistencia de presets por escena.

## V2

- [ ] **API de control total (REST + Realtime)**
  - Prioridad: `V2 #1`.
  - Objetivo: habilitar una API publica como fuente de verdad unica para controlar backend y frontend desde el dia 1, con primer entregable usable por terceros.
  - Decisiones confirmadas:
    - API expone REST + WebSocket realtime desde base versionada `/api/v1/`.
    - Autenticacion inicial por API Key simple (sin roles), con OAuth/login de usuarios planificado para etapa posterior.
    - Seguridad base con rate limit por IP y formato estandar de error `{ code, message, details }`.
    - Contratos y errores en ingles tecnico para payloads request/response.
    - Documentacion obligatoria OpenAPI 3.1 + Swagger UI en `/docs` con export JSON/YAML.
    - Frontend migra progresivamente para consumir API como unica fuente de verdad.
    - Stack backend objetivo: Express + Zod/OpenAPI.
  - Alcance de subtareas (todas `pending`):
    - [ ] Foundation API (Express + Zod/OpenAPI): bootstrap, middlewares base, versionado `/api/v1/`, envelope de error `{ code, message, details }`, auth API Key y rate-limit por IP.
    - [ ] Recursos `Monitores/Salas remotas`: endpoints CRUD + acciones operativas de control remoto con contratos OpenAPI y validacion Zod.
    - [ ] Recursos `Contenido y transformaciones`: endpoints para fuentes (imagen/URL/captura), transformaciones y estado activo por destino.
    - [ ] Recursos `Playlist/Playback`: endpoints para colecciones, asignaciones y comandos de reproduccion (play/pause/seek/next/prev/stop).
    - [ ] Recursos `Mirror/Pizarra/Layouts`: endpoints para espejo, overlays de pizarra y guardado/restauracion de layouts.
    - [ ] Canal realtime WebSocket: eventos tipados de estado/comando/ack para sincronizacion host-client y notificaciones operativas.
    - [ ] Documentacion API: Swagger UI en `/docs`, OpenAPI 3.1 exportable (`openapi.json` y `openapi.yaml`), ejemplos request/response y codigos de error por endpoint.
    - [ ] SDK cliente TypeScript oficial generado/curado desde OpenAPI para consumidores externos.
    - [ ] Colecciones de integracion: export Postman e Insomnia alineadas a contratos vigentes.
    - [ ] Tests de contrato API: suite automatizada REST + realtime que valide schema, errores y backward-compat basica de `/api/v1/`.
  - Secuencia V2 aprobada (orden de entrega):
    - [ ] 1) Foundation API + auth + docs.
    - [ ] 2) Monitores/salas remotas.
    - [ ] 3) Contenido y transformaciones.
    - [ ] 4) Playlist/playback.
    - [ ] 5) Mirror/pizarra/layouts.
    - [ ] 6) Eventos realtime + observabilidad API.
  - Criterios de aceptacion:
    - [ ] Existe API versionada en `/api/v1/` con autenticacion API Key operativa y rate-limit por IP activo.
    - [ ] Swagger UI publica en `/docs` y export OpenAPI 3.1 disponible en JSON/YAML.
    - [ ] Cada endpoint documenta request/response de ejemplo y codigos de error consistentes.
    - [ ] Errores cumplen formato `{ code, message, details }` y payloads quedan en ingles tecnico.
    - [ ] Frontend integra consumo progresivo de API sin romper flujo operativo actual.
    - [ ] Terceros pueden ejecutar flujo base via SDK TS o colecciones Postman/Insomnia.
  - DoD:
    - [ ] Contratos REST + realtime versionados y validados por tests de contrato automatizados.
    - [ ] SDK TS publicado en workspace con ejemplos minimos de uso.
    - [ ] Colecciones Postman/Insomnia exportadas y verificadas contra entorno de desarrollo.
    - [ ] Validacion minima del proyecto ejecutada (`pnpm run typecheck`, `pnpm run build`, `pnpm run test`).
    - [ ] Backlog front/back alineados en prioridades y alcance de la iniciativa V2.

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
- 2026-04-03: V1 `Fuentes de monitor en modal con pestanas` completada e integrada en `development`; se actualizan checklist/subtareas/DoD y el avance V1 pasa a 71% (5/7).
- 2026-04-05: V1 `Monitor virtual remoto (Cloud Sync)` completada con backend Socket.io + Redis, flujo de pairing por QR/codigo (`XXXX-XXXX-XXXX`), ruta `/remote`, desconexion remota desde host, countdown de expiracion de sala, bloqueo de zoom gestual en remoto y autocompletado de codigo desde QR; avance V1 actualizado a 86% (6/7).
- 2026-04-05: V1 `Filtros en caliente` completada con pipeline tipado (brightness/contrast/saturate/grayscale/blur), ajuste en vivo desde modal de contenido, mensajes master-slave sin reinicio de salida y presets serializables por monitor/layout; avance V1 actualizado a 100% (7/7).
- Nota Entrega (2026-04-05): `Monitor Virtual Remoto (Cloud Sync)` implementado en front+back con pairing por QR/codigo, WebRTC para transporte remoto, estados de conexion y soporte operativo para multiples monitores remotos por sesion.
- Nota UX (2026-04-05): en el editor de contenido por monitor se separaron controles en tabs `Transformacion/Transiciones/Filtros`; Transformacion agrega `Rotar 180`, input numerico de escala, input de paso en px y pad direccional 3x3; Filtros incorpora reset por etapa y reset global, manteniendo aplicacion en caliente y persistencia actual.
- Nota Mantenimiento (2026-03-31): se completo la reestructuracion a monorepo PNPM; el frontend se movio a `mythr-prism-front/`, se agrego scaffold `mythr-prism-back/` y la orquestacion global queda en la raiz (`README.md`, `package.json`, `pnpm-workspace.yaml`). Este backlog continua en `mythr-prism-front/docs/backlog.md`.
- Nota Roadmap (2026-03-31): cierre formal de MVP completado al 100%; a partir de este punto el foco operativo pasa a V1.
- Nota UX (2026-03-30): en Playlist se reforzo comportamiento operativo de modales con overlay fijo + bloqueo de scroll de fondo, y se aplico truncado visual de `source` largos (incluye data URI) manteniendo valor completo por `title`.
- Nota Bugfix/UX (2026-03-30): se robustecio el manejo de fullscreen en ventanas esclavas frente a salidas forzadas por navegador/SO (ej. al abrir file picker en la ventana principal): ahora se detecta perdida externa via `fullscreenchange`, se conserva la intencion de fullscreen por monitor, se habilita CTA de reactivacion rapida en la esclava (`Reactivar Fullscreen`) y el master muestra feedback explicito con los monitores afectados.
- Nota Bugfix (2026-03-30): en runtime de ventana esclava se elimino la reinicializacion agresiva de `<video>` (`video.load()` en transiciones de contenido) para evitar salidas involuntarias de fullscreen durante `SET_IMAGE`/`SET_MEDIA`; se agregaron pruebas de regresion para validar que esos mensajes no disparan operaciones de salida de fullscreen.
- Nota Bugfix (2026-03-30): se corrigio estado "congelado" en ventana esclava tras repetir ciclo fullscreen -> volver al master -> seleccionar archivo; ahora la solicitud de fullscreen tiene guardas ante promesas pendientes, se agrego cierre local visible (overlay + boton rapido) y el master envia `REQUEST_CLOSE` como failsafe antes de cerrar, con pruebas de regresion para repeticion de flujo y comandos de cierre.
- Nota Bugfix Critico (2026-03-30): se elimino el bloqueo al seleccionar imagen despues de una salida de fullscreen provocada por file picker; el master ya no envia data URI pesadas por `postMessage` (usa `blob:` runtime + `data:` persistible), la esclava aplica imagen de forma diferida/no bloqueante con trazas acotadas de eventos clave y se agregaron pruebas de regresion del flujo abrir/cancelar + seleccionar + cierre local/remoto.
- Nota Bugfix (2026-03-30): se elimino la causa raiz del freeze tras salida forzada de fullscreen sin evento `fullscreenchange` (al abrir selector de archivo en master): el runtime esclavo ahora reconcilia estado via `focus`/`visibilitychange` + watchdog, evita clears por payloads invalidos (`SET_IMAGE`/`SET_MEDIA`) y agrega cierre robusto (salida de fullscreen + fallback de error) sin recrear ventana.
- Nota Bugfix Critico (2026-03-30): se identifico causa raiz adicional del freeze al mero click en `Seleccionar archivo` (sin `change`): el master escuchaba `pagehide` y ejecutaba `shutdownAllWindows`, enviando `REQUEST_CLOSE` durante la apertura del file picker; se retiro ese cierre por `pagehide`, se mantiene cierre por `beforeunload`/desmontaje y se agrego regresion para validar que la ventana esclava sigue operable y cerrable tras ese click.
- Nota Bugfix Critico (2026-03-30): se retiro una mitigacion inestable en la esclava (`focus`/`visibilitychange` + watchdog) porque reintroducia rutas de reconciliacion agresiva durante apertura de file picker en master; el runtime queda acotado a eventos minimos (`fullscreenchange` + accion explicita) con dedupe/throttle estricto de `FULLSCREEN_STATUS` para evitar floods y preservar estabilidad de cierre local/remoto.
- Nota Bugfix Critico (2026-03-30): se implementaron 3 mitigaciones end-to-end para fullscreen + file picker: (1) bloqueo del selector nativo cuando existe al menos una esclava en fullscreen, con feedback operativo y fallback recomendado; (2) import de imagen por Drag & Drop y pegado desde portapapeles en Monitores y formularios de Playlist; (3) apertura de esclavas en ruta same-origin (`/slave.html?monitorId&instanceToken`) para eliminar dependencia del popup `blob:` y reducir congelamientos asociados al dialogo nativo.
- Nota UX (2026-03-30): se unifico el patron de import por archivo en todos los puntos `Seleccionar archivo` (Monitores + alta/edicion de Playlist) incorporando `dragenter/dragover/dragleave/drop`, estado visual activo de drop target y mensaje explicito para archivos no imagen, manteniendo pegado desde portapapeles y seleccion manual segun estado de fullscreen.
- Nota UX (2026-03-30): en las tabs de cabecera `Monitores/Playlist` se ajusto el layout a icono sobre texto y se escalo ligeramente el tamano de iconos, manteniendo semantica accesible y comportamiento actual.
- Nota UX (2026-03-30): se movieron las tabs globales `Monitores/Playlist` a la cabecera de la app y la accion `Cerrar todas las ventanas` paso a la barra contextual de Monitores junto al filtro de visibilidad.
- Nota Mantenimiento (2026-03-30): se movio la hoja global a `src/assets/styles/style.css` y se extrajeron clases semanticas reutilizables (botones, modales, tabs, tarjetas y filas de formulario) para reducir utilidades Tailwind repetidas sin cambios funcionales.
- Nota Mantenimiento (2026-03-30): se corrigieron warnings de analisis estatico en `App.vue` y `PlaylistManager.vue` (checks `typeof` redundantes y jerarquia HTML invalida dentro de boton de thumbnail) sin cambios funcionales.
- Nota UX (2026-03-30): en los dialogos actuales de Playlist (preview/alta/edicion) se estandarizo boton de cierre en header (derecha, con `aria-label`), se elimino cierre redundante en footer de preview y se mantuvieron acciones de formulario (`Guardar/Cancelar`) sin duplicar cierre generico.
- Nota Bugfix (2026-03-30): los modales de Playlist (preview/alta/edicion) ahora se renderizan con `Teleport` a `body` para evitar desplazamientos del backdrop/dialogo causados por contextos de posicionamiento en contenedores con efectos visuales; se agregaron pruebas de regresion de anclaje a viewport.
- Nota Bugfix (2026-03-30): se corrigio la replicacion en modo espejo cuando el origen envia imagen; el destino ya no recibe un `SET_MEDIA` nulo despues del `SET_IMAGE`, por lo que deja el estado "Esperando contenido..." y mantiene degradacion parcial si algun destino no esta disponible.
- Nota Bugfix (2026-03-30): al salir/recargar la pantalla master se intenta cerrar automaticamente todas las ventanas esclavas via `beforeunload` (y desmontaje de app), con cierre tolerante a errores para evitar pantallas huerfanas bloqueadas.
- Nota Bugfix/UX (2026-03-30): modo espejo ahora preserva visualizacion del origen durante la replicacion, al desactivar limpia de inmediato contenido espejado en destinos abiertos y resetea configuracion (`enabled=false`, `source=null`, `destinations=[]`); ademas, el control de activacion se reemplazo por boton de accion claro (`Iniciar espejo`/`Finalizar espejo`).
- Nota Mantenimiento (2026-03-30): se corrigieron warnings por `max-w` duplicado en `PlaylistManager.vue` extrayendo el ancho de modal a variantes reutilizables (`app-modal-panel--sm/md/lg`) y eliminando utilidades redundantes en template.
- Nota Mantenimiento (2026-03-30): se corrigio nullability en `PlaylistManager.vue` (TS18047) al editar `muted` de video, encapsulando el cambio en un handler tipado con guard explicito de `editingItem` sin cambios de UX/flujo.
- Nota UX (2026-03-30): se aplico una convencion global para modales activos de Playlist (alta, edicion, preview): centrados en viewport, con `max-h/max-w` relativos a pantalla, `body` con scroll interno y `header/footer` sticky siempre visibles.
- Nota UX (2026-03-30): la thumbnail de cada item en Playlist ahora abre un modal de vista ampliada con cierre por boton/Escape/click fuera, metadata del item y fallback claro cuando la preview no esta disponible.
- Nota UX (2026-03-30): se limpiaron textos de botones de apertura de dialogo (sin mencionar "modal") y se unifico el estilo de checkboxes inline con un componente reutilizable accesible (`AppCheckbox`).
- Nota UX (2026-03-30): en cada item de playlist los controles `Subir`, `Bajar`, `Editar` y `Eliminar` se mostraron en una sola fila con `flex-nowrap`; en pantallas estrechas el bloque de acciones usa `overflow-x-auto` para evitar salto de linea.
- Nota UX (2026-03-30): se introdujo iconografia consistente con Heroicons en botones y cabeceras de dialogos (icono + texto, iconos decorativos con `aria-hidden="true"`) para mejorar legibilidad operativa sin saturar la interfaz.
- Nota UX (2026-03-30): en formularios de alta/edicion de Playlist se refino el layout por filas (Titulo/Tipo, Source/Archivo local, Duracion-Inicio-Fin y fila final de `Mute` con ayuda contextual) manteniendo validaciones y flujo actual.
- Nota UX (2026-03-30): la lista de Playlist adopta jerarquia visual tipo tarjetas y agrega drag and drop nativo con feedback de item arrastrado/destino, manteniendo `Subir/Bajar` como fallback accesible.
