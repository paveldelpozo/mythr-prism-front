# Mythr Prism

Mythr Prism es un módulo integrado en el ecosistema Mythr, orientado al control y la proyección de contenido en entornos multi-monitor para experiencias visuales coordinadas.

## Características

- Gestión básica de flujos de proyección en múltiples pantallas.
- Estructura pensada para integración con funcionalidades de Mythr.
- Enfoque en una experiencia local de desarrollo y pruebas ágil.
- Base preparada para evolucionar en escenarios de control avanzado.

## Requisitos previos

- Node.js (versión LTS recomendada).
- pnpm (8.15.9 o superior recomendado para Node.js 16.20.2).
- Navegador moderno con soporte para APIs necesarias de gestión de ventanas/pantallas.

## Instalación

```bash
pnpm install
```

## Scripts disponibles

- `pnpm run dev`: inicia el entorno de desarrollo local.
- `pnpm run build`: genera la build de producción.
- `pnpm run preview`: sirve la build para validación local.
- `pnpm run typecheck`: ejecuta la verificación de tipos.

## Uso básico

1. Instala dependencias con `pnpm install`.
2. Arranca el entorno local con `pnpm run dev`.
3. Abre la URL indicada en consola en un navegador compatible.
4. Prueba el flujo básico de proyección y control entre ventanas/pantallas.
5. Valida build y tipos con `pnpm run build` y `pnpm run typecheck`.

## Notas de compatibilidad

- Algunas funciones dependen de la Window Management API y pueden variar según navegador y versión.
- La entrada en modo fullscreen suele requerir user activation (interacción explícita del usuario).
- Los popup blockers pueden impedir la apertura de ventanas necesarias para escenarios multi-monitor.

## Roadmap

Para próximas mejoras y tareas planificadas, consulta `docs/backlog.md`.

## Licencia

Licencia: Propietaria (All Rights Reserved).

No se permite el uso, copia, modificación o distribución de este proyecto sin autorización expresa del titular.
