# Contratos

> Fuente: especificación v0.1, §08, §10.3 y Anexo A (§22).
> Estado: **PROPUESTO.** Son propuestas de interfaz, no una API publicada. El código está en
> [`packages/project/src/index.ts`](../packages/project/src/index.ts) y
> [`packages/connectors/src/index.ts`](../packages/connectors/src/index.ts), y se valida con `npm run typecheck`.

## 1. Contrato universal de proyecto (Anexo A)

Esquema mínimo: separa **assets** y **capas**, admite **técnicas múltiples** y conserva **referencias externas**. No intenta describir todo Blender ni todas las propiedades de FreeCut; se amplía con extensiones *namespaced*, metadatos y referencias a proyectos nativos.

```ts
export type Technique = '2d' | '3d' | '2.5d' | '2d-guided-by-3d' | '3d-with-2d';

type Keyframe = { frame: number; value: number; easing?: 'linear' | 'smooth' | 'hold' };
type Curve = { defaultValue: number; keyframes: Keyframe[] };

type Asset = {
  id: string;
  type: 'video' | 'audio' | 'image' | 'svg' | 'drawing' | 'model3d';
  uri: string;
  hash?: string;
  licenseId?: string;
};

type Layer = {
  id: string;
  kind: Asset['type'] | 'text' | 'group';
  assetId?: string;
  startFrame: number;
  durationFrames: number;
  sourceInFrame?: number;
  zIndex: number;
  techniques: Technique[];
  guide3DLayerId?: string;
  channels: Partial<Record<'x' | 'y' | 'rotation' | 'scale' | 'opacity' | 'expression' | 'integration' | 'volume', Curve>>;
  externalProject?: { pluginId: string; uri: string };
};

type Scene = { id: string; durationFrames: number; layers: Layer[] };
type Sequence = { id: string; scenes: Scene[] };
export type Project = {
  schemaVersion: 1;
  id: string;
  name: string;
  fps: { num: number; den: number };
  width: number; height: number; seed: number;
  assets: Asset[];
  sequences: Sequence[];
};
```

### Ejemplo de escena

```ts
const scene: Scene = {
  id: 'hybrid-test',
  durationFrames: 300,
  layers: [{
    id: 'character-2d', kind: 'drawing', assetId: 'char-source',
    startFrame: 30, durationFrames: 210, zIndex: 3,
    techniques: ['2d', '2d-guided-by-3d'],
    guide3DLayerId: 'guide-camera',
    channels: {
      opacity:    { defaultValue: 1,  keyframes: [] },
      expression: { defaultValue: .4, keyframes: [{ frame: 0, value: .4 }, { frame: 120, value: .8 }] },
    },
  }],
};
```

## 2. Contrato de conectores v0.1 (§08)

Un **conector** es un adaptador que describe capacidades e implementa operaciones tipadas. Puede invocar una CLI, una biblioteca, una API, un servidor MCP o un proceso aislado. El contrato define entradas, salidas y estado de ejecución; **no** exige que todas las herramientas compartan lenguaje ni interfaz interna.

### Dos tarjetas por herramienta

| Tarjeta | Cuándo se lee | Campos |
|---|---|---|
| **Simple** (obligatoria) | Siempre: descubrimiento y filtrado preliminar | ID, nombre, versión, categoría, operaciones principales, tipos de entrada/salida, especialidad, estado |
| **Avanzada** (bajo demanda) | Solo si un requisito no queda demostrado con la simple | Transparencia/alpha, profundidad, keyframes, FPS, formatos, GPU, VRAM/RAM, límites, editabilidad, licencias, permisos, rendimiento medido |

El registro distingue **soportado**, **no soportado** y **no comprobado**. Un valor desconocido provoca inspección o prueba cuando afecta a la elección.

```ts
type Support = 'yes' | 'no' | 'unknown';
type Executor = 'cli' | 'api' | 'library' | 'mcp';

type CardSimple = {
  id: string; name: string; version: string;
  contractVersion: '0.1';
  capabilities: string[];   // p. ej. 'animate.vector'
  accepts: string[];        // p. ej. 'application/json'
  produces: string[];       // p. ej. 'video/mp4'
  executor: Executor;
};

type CardAdvanced = {
  pluginId: string;
  technical: Record<string, Support>;
  limits?: Record<string, number | string>;
  permissions: string[];
  editability: 'native' | 'linked' | 'baked' | 'unknown';
  licenseReview: 'pending' | 'approved' | 'blocked';
};

type JobRequest = {
  projectId: string; operation: string;
  inputs: { uri: string; type: string }[];
  requirements: Record<string, string | number | boolean>;
  seed?: number;
};

type JobResult = {
  status: 'ok' | 'failed' | 'cancelled';
  outputs: { uri: string; type: string }[];
  diagnostics: { code: string; message: string }[];
};
```

En la implementación real se añadirán: validación en runtime, esquemas compatibles, identificadores de job, progreso, logs, cancelación, versiones de motor y políticas de acceso.

### Ejemplo conceptual de tarjeta simple

```json
{
  "id": "adapter.revideo",
  "name": "Revideo",
  "version": "pin-required",
  "contractVersion": "0.1",
  "capabilities": ["animate.vector", "render.video"],
  "accepts": ["fme/scene+json"],
  "produces": ["video/mp4", "image/png-sequence"],
  "executor": "cli"
}
```

Las capacidades del ejemplo son **objetivos del adaptador**. No implica que ya exista una CLI de FME ni soporte nativo del formato en Revideo.

### Reglas de compatibilidad
- Un adaptador declara las versiones del contrato con las que es compatible.
- Antes de usar un formato se comprueba si incluye alpha, color, profundidad, audio y timebase, según el trabajo.
- El registro **no confunde** "puede exportar" con "puede reabrir editable".
- Las herramientas se instalan y ejecutan solo con permisos autorizados y rutas controladas.
- Sustituir un plugin exige **pruebas de regresión de salida**, no solo que coincidan las etiquetas.

### Interfaz de adaptadores y procedencia (ADR-0011, PROPUESTO)

Implementada en `packages/connectors/src/adapter.ts`. `JobResult` no cambia; `AdapterJobResult` lo extiende.

```ts
interface ConnectorAdapter {
  readonly simple: CardSimple; readonly advanced: CardAdvanced;
  probe(): Promise<{ available: boolean; engineVersion?: string; diagnostics: { code: string; message: string }[] }>;
  run(job: JobRequest, ctx: { jobId: string; workDir: string; timeoutMs: number }): Promise<AdapterJobResult>;
}
type AdapterJobResult = JobResult & { jobId: string; provenance: ArtifactProvenance[] }; // uno por output
// ArtifactProvenance: uri, type, sha256, contentSha256?, pluginId, pluginVersion, engineVersion, params, seed?, startedAt, durationMs
```

La conformidad se comprueba con `checkAdapterResult(result, adapter)`. Los motores se ejecutan con `runIsolated` (`@fme/runtime-workers`), sin shell.

## 3. Herramientas MCP mínimas

La capa MCP es un **adaptador de la API** de FME (SDK oficial MCP TypeScript).

| Herramienta | Operación |
|---|---|
| `project.create` / `project.open` | Iniciar o consultar el proyecto universal |
| `asset.register` | Registrar una fuente y sus metadatos |
| `scene.create` / `layer.add` | Crear escenas y capas |
| `timeline.animate` | Aplicar curvas y keyframes |
| `art_direction.set` | Guardar intención, estilos y restricciones |
| `connectors.list` / `connectors.inspect` | Consultar tarjeta simple o detalle avanzado |
| `route.plan` / `job.run` | Planificar y ejecutar trabajos |
| `preview.render` / `preview.inspect` | Generar y revisar resultados |
| `project.export` | Producir la salida final o un proyecto intercambiable |

## 4. Flujo de una solicitud real (Anexo B)

**Solicitud:** *"Crea un vídeo de 10 segundos: comienza con una grabación, incorpora una ilustración animada que se sienta hecha a mano, revela profundidad, agrega un objeto 3D y un título; conserva los originales."*

1. La mitad artística define la guía visual, el ritmo, las técnicas por segmento, la composición y los criterios de aceptación.
2. La mitad de proyecto crea una timeline de 300 fotogramas con clips, capas y referencias a los originales.
3. El router consulta las tarjetas simples y descubre Revideo, Blender y FreeCut.
4. Comprueba las tarjetas avanzadas si necesita alpha, transparencia, FPS, formatos o memoria.
5. Construye trabajos independientes: fondo, animación 2D, render 3D y título.
6. Los adaptadores ejecutan los trabajos, registran los artefactos y reúnen los resultados.
7. El proyecto actualiza las referencias y el compositor genera una vista previa.
8. El agente inspecciona fotogramas, pide correcciones selectivas y exporta.

| Etapa | Salida |
|---|---|
| Dirección artística | Plan de escena, perfiles y restricciones |
| Proyecto | FME JSON + referencias a assets y documentos externos |
| Generación | Vídeo/frames con metadatos, seed y versión del backend |
| Previsualización | Frames de revisión y resultado de los controles de calidad |
| Entrega | Vídeo final + proyecto universal + fuentes nativas editables |
