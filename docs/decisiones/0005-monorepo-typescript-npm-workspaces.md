# ADR-0005: Monorepo TypeScript con npm workspaces

- **Estado:** propuesta (2026-11-22) · **Dueño:** FORGEX MEDIA · **Revisable:** al cierre de la Fase 2

## Contexto

La spec (§11) asigna a TypeScript el proyecto universal, el registro, el enrutador y el MCP, y propone una estructura orientativa (§11.2) con `apps/`, `packages/`, `runtime/`, `examples/` y `docs/`. Hace falta una base mínima para compilar los contratos sin comprometer frameworks.

## Decisión (propuesta)

- Monorepo con **npm workspaces** (viene con Node; sin dependencias extra de tooling).
- TypeScript `strict`, ESM y `moduleResolution: NodeNext`.
- Única dependencia de desarrollo inicial: `typescript`. Ninguna dependencia de runtime hasta que una fase la justifique con un ADR (p. ej. el validador de esquemas en la Fase 2).
- Paquetes con el scope `@fme/*`.

## Alternativas consideradas

| Alternativa | Por qué no (por ahora) |
|---|---|
| pnpm (como en Segundo Cerebro `packages/`) | Mejor con muchos paquetes, pero añade una herramienta más; se puede migrar sin coste si crece |
| Turborepo/Nx | Sobredimensionado para 2 paquetes con solo tipos |
| Paquete único | Mezcla las mitades A/B y el módem, en contra de la separación de la spec |

## Consecuencias

- Arranque inmediato con `npm install && npm run typecheck`.
- Revisar en la Fase 2, cuando haya build, tests y más paquetes.
