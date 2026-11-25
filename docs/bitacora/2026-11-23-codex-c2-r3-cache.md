# 2026-11-23 · FDN-070 Caché por dependencias

- **Sesión** `codex-c2-r3` · **Rama** `fdn/FDN-070-cache`

## Hecho

- `dependencyHash` calcula SHA-256 sobre JSON UTF-8 con orden recursivo de claves y orden de arrays conservado. Rechaza valores ajenos a JSON y ciclos.
- `DependencyGraph` registra y reemplaza dependencias. `invalidate` devuelve los derivados transitivos sin duplicados y deja disponible el grafo para invalidaciones posteriores.
- `DiskCache` almacena bytes con claves SHA-256 bajo un directorio preexistente autorizado. Comprueba contención, tipo e identidad del directorio, y rechaza enlaces simbólicos, junctions y enlaces duros en las entradas. Publica un temporal exclusivo mediante rename en el mismo directorio.
- El directorio debe estar administrado por el llamador con permisos que impidan modificaciones de terceros. La publicación atómica protege a lectores y escritores concurrentes de entradas parciales.

## Verificado

| Comando | Resultado |
|---|---|
| `npm run typecheck` y `tsc -p packages/cache/tsconfig.json` | OK. |
| Importación de `packages/cache/dist/index.js` con Node | Exportaciones y cálculo básico de hash correctos. |
| `npm test` | 79/79, incluidas ocho pruebas de caché para hash, grafo, concurrencia, fallo de escritura y escape de rutas. |
| `codegraph sync` y `codegraph affected` | Índice actualizado. Detecta `packages/cache/test/cache.test.ts`. |

## Pendiente

- Revisión e integración de A0, incluida la referencia y el lockfile raíz del workspace.
- El worker no exporta una validación reutilizable para este almacén. Solicité una decisión a A0 sobre una API compartida y mantuve la validación interna limitada al directorio y a entradas por SHA-256.
