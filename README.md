# Mythr Prism

Mythr Prism es un módulo integrado en el ecosistema Mythr, orientado al control y la proyección de contenido en entornos multi-monitor para experiencias visuales coordinadas.

## Características

- Gestión básica de flujos de proyección en múltiples pantallas.
- Estructura pensada para integración con funcionalidades de Mythr.
- Enfoque en una experiencia local de desarrollo y pruebas ágil.
- Base preparada para evolucionar en escenarios de control avanzado.

## Requisitos previos

- Node.js (versión LTS recomendada).
- npm (incluido habitualmente con Node.js).
- Navegador moderno con soporte para APIs necesarias de gestión de ventanas/pantallas.

## Instalación

```bash
npm install
```

## Scripts disponibles

- `npm run dev`: inicia el entorno de desarrollo local.
- `npm run build`: genera la build de producción.
- `npm run preview`: sirve la build para validación local.
- `npm run typecheck`: ejecuta la verificación de tipos.

## Uso básico

1. Instala dependencias con `npm install`.
2. Arranca el entorno local con `npm run dev`.
3. Abre la URL indicada en consola en un navegador compatible.
4. Prueba el flujo básico de proyección y control entre ventanas/pantallas.
5. Valida build y tipos con `npm run build` y `npm run typecheck`.

## Notas de compatibilidad

- Algunas funciones dependen de la Window Management API y pueden variar según navegador y versión.
- La entrada en modo fullscreen suele requerir user activation (interacción explícita del usuario).
- Los popup blockers pueden impedir la apertura de ventanas necesarias para escenarios multi-monitor.

## Roadmap

Para próximas mejoras y tareas planificadas, consulta `docs/backlog.md`.

## Licencia

Pendiente de definir.
