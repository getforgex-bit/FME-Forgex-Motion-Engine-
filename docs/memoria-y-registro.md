# Memoria y registro: dónde se guarda cada cosa

FME usa un **sistema común** para que personas y agentes IA (Claude Code, Codex, Antigravity, Claude Desktop) compartan contexto sin depender de conversaciones. Cada tipo de información tiene **un solo lugar**:

| Qué quieres guardar | Dónde | Formato | Quién lo lee |
|---|---|---|---|
| Hecho breve para agentes: decisión, convención, gotcha, tarea | **Memoria del proyecto** `.forgex/memory.jsonl` | Entidades MCP (vía `Memory.*`) | Agentes, al empezar cada tarea |
| Decisión de arquitectura con contexto y alternativas | **ADR** en [`docs/decisiones/`](decisiones/) | Markdown `NNNN-titulo.md` | Personas y agentes |
| Qué se hizo en una sesión, cómo se verificó y qué queda | **Bitácora** en [`docs/bitacora/`](bitacora/) | Markdown `AAAA-MM-DD-tema.md` | Quien retome el trabajo |
| Cambios por versión | [`CHANGELOG.md`](../CHANGELOG.md) | Keep a Changelog | Usuarios del proyecto |
| Estado actual en una página | [`STATUS.md`](../STATUS.md) | Tablas | Todos |
| Plan y objetivos | [`docs/roadmap.md`](roadmap.md) | Checklists por fase | Todos |
| Código | git + grafo de GitNexus (`.gitnexus/`, no versionado) | — | Agentes, vía `Gitnexus.*` |

**Regla de oro:** la memoria es un **índice corto** que apunta a la fuente (ADR, bitácora, archivo). No copies documentos enteros en ella.

## 1. FORGEX Stack (Segundo Cerebro)

Origen: repo [`getforgex-bit/Segundo-Cerebro-Code-Mode`](https://github.com/getforgex-bit/Segundo-Cerebro-Code-Mode), rama **`develop`**, carpeta `stack/`. Proporciona:

- **pctx (Code Mode):** un único servidor MCP, `forgex`, con 3 herramientas. La IA escribe TypeScript que llama a las demás en un sandbox y solo recibe el resultado (≈736 tokens fijos frente a ≈17,5k conectando GitNexus directo, según la medición del kit).
- **Memoria** (`@modelcontextprotocol/server-memory`) en `.forgex/memory.jsonl`, **versionada**.
- **GitNexus:** grafo de conocimiento del código (contexto, impacto, diff→impacto). ⚠ Licencia PolyForm Noncommercial: ver [ADR-0003](decisiones/0003-forgex-stack-como-memoria.md).

### Instalación (cada persona, en su máquina)

Requisitos: git y Node.js LTS (^22.18 o ≥ 24.11).

macOS / Linux:
```bash
git clone --depth 1 -b develop https://github.com/getforgex-bit/Segundo-Cerebro-Code-Mode.git ~/forgex-stack
```
```bash
~/forgex-stack/stack/setup.sh /ruta/a/FME-Forgex-Motion-Engine-
```

Windows (PowerShell):
```powershell
git clone --depth 1 -b develop https://github.com/getforgex-bit/Segundo-Cerebro-Code-Mode.git $HOME\forgex-stack
powershell -ExecutionPolicy Bypass -File $HOME\forgex-stack\stack\setup.ps1 C:\ruta\a\FME-Forgex-Motion-Engine-
```

Debe terminar en **`RESULTADO: OK`**. Después, abre el proyecto en Claude Code y **acepta** el servidor de proyecto `forgex` (compruébalo con `/mcp`).

### Qué se versiona y qué no

| Archivo | ¿Se versiona? | Motivo |
|---|---|---|
| `.forgex/memory.jsonl` | **Sí** | Memoria compartida del proyecto |
| `AGENTS.md` (bloque `<!-- forgex:start/end -->`) y `CLAUDE.md` | **Sí** | Instrucciones comunes para agentes |
| `pctx.json`, `.mcp.json`, `.agents/`, `.codex/` | **No** (`.gitignore`) | Llevan rutas absolutas de cada máquina |
| `.gitnexus/` | **No** | Índice local; se regenera con `gitnexus analyze --skip-agents-md --skip-skills` |
| `*.bak-*` | **No** | Copias de seguridad del setup |

### Mantenimiento
- Actualizar el kit: `git -C ~/forgex-stack pull` y volver a ejecutar `setup.sh` (es idempotente).
- Reindexar tras cambios grandes: `gitnexus analyze --skip-agents-md --skip-skills`.
- Verificar en cualquier momento: `node ~/forgex-stack/stack/verify.mjs <ruta-FME>`.

## 2. Convenciones de la memoria

Tipos de entidad (`entityType`):

| Tipo | Uso | Ejemplo de nombre |
|---|---|---|
| `project` | Ficha del proyecto | `FME` |
| `decision` | Decisión tomada (enlaza a su ADR) | `decision:integrar-antes-que-fork` |
| `convention` | Regla de trabajo | `convention:registro-comun` |
| `task` | Tarea o fase en curso | `task:fase-1-verificar-software` |
| `gotcha` | Trampa o hallazgo no obvio | `gotcha:revideo-alpha` |
| `component` | Paquete o adaptador | `component:packages/router` |
| `tool` | Herramienta externa integrada | `tool:blender` |

**Observaciones:** breves, verificables y con fecha y fuente cuando aplique. Ejemplo: `"2026-11-22 · Blender 4.x verificado headless: PNG RGBA OK (bitácora 2026-11-25-blender)"`.

**Relaciones** (`relationType`, en voz activa): `part_of`, `depends_on`, `governs`, `enables`, `affects`, `blocks`, `decided_in`, `verified_by`, `replaces`.

**No guardar en la memoria:** secretos, datos personales, logs largos ni documentos completos.

### Flujo para agentes (resumen de `AGENTS.md`)
1. **Al empezar:** `Memory.searchNodes({ query: "<tema>" })`.
2. **Antes de editar código:** `Gitnexus.context` e `impact`.
3. **Antes de commit:** `gitnexus detect-changes`.
4. **Al terminar:** guardar las decisiones, convenciones y gotchas nuevos, y crear o actualizar la entrada de bitácora.

## 3. Plantillas

- ADR: [`docs/decisiones/_plantilla.md`](decisiones/_plantilla.md)
- Bitácora: [`docs/bitacora/_plantilla.md`](bitacora/_plantilla.md)
