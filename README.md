# mythr-prism-front

Mythr Prism es un módulo integrado en el ecosistema Mythr, orientado al control y la proyección de contenido en entornos multi-monitor para experiencias visuales coordinadas.

## Características

- Gestión básica de flujos de proyección en múltiples pantallas.
- Estructura pensada para integración con funcionalidades de Mythr.
- Enfoque en una experiencia local de desarrollo y pruebas ágil.
- Base preparada para evolucionar en escenarios de control avanzado.

## Requisitos previos

- Node.js `>=20.19.0` (LTS recomendado; Vite 7 requiere Node 20+).
- pnpm `>=8.15.9`.
- Navegador moderno con soporte para APIs necesarias de gestión de ventanas/pantallas.

## Ubicacion en monorepo

Este paquete vive dentro del monorepo `mythr-prism` en la ruta `mythr-prism-front/`.

## Instalación

Desde la raiz del monorepo:

```bash
pnpm install
```

## Scripts disponibles

- `pnpm run dev`: inicia el entorno de desarrollo local (ejecutar dentro de `mythr-prism-front/` o via root con `pnpm run dev:front`).
- `pnpm run build`: genera la build de producción.
- `pnpm run preview`: sirve la build para validación local.
- `pnpm run typecheck`: ejecuta la verificación de tipos.
- `pnpm run test`: ejecuta tests con Vitest.

## Variables de entorno

- `VITE_REMOTE_BACKEND_URL`: URL base del backend Socket.io/WebRTC para la feature de sincronizacion remota.
  - Local por defecto (si no se define): `http://localhost:3000`.
  - Produccion por defecto (si no se define): mismo origen del frontend (`window.location.origin`).

Ejemplo rapido:

```bash
cp .env.example .env
```

## Uso básico

1. Instala dependencias con `pnpm install` en la raiz del monorepo.
2. Arranca el entorno local con `pnpm run dev:front` en la raiz, o `pnpm run dev` dentro de `mythr-prism-front/`.
3. Abre la URL indicada en consola en un navegador compatible.
4. Prueba el flujo básico de proyección y control entre ventanas/pantallas.
5. Valida build, tipos y tests con `pnpm run build`, `pnpm run typecheck` y `pnpm run test`.

## Notas de compatibilidad

- Algunas funciones dependen de la Window Management API y pueden variar según navegador y versión.
- La entrada en modo fullscreen suele requerir user activation (interacción explícita del usuario).
- Los popup blockers pueden impedir la apertura de ventanas necesarias para escenarios multi-monitor.

## Roadmap

Para próximas mejoras y tareas planificadas, consulta `docs/backlog.md`.

## Licencia

Licencia: Propietaria (All Rights Reserved).

No se permite el uso, copia, modificación o distribución de este proyecto sin autorización expresa del titular.
