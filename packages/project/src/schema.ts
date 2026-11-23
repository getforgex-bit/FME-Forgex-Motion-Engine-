/**
 * Esquema Zod de `Project` (ADR-0008): única fuente de la validación en runtime y del JSON Schema.
 * Los tipos de `index.ts` siguen siendo la referencia; `test/schema.test.ts` comprueba que ambos son mutuamente asignables.
 * Los objetos son estrictos: una clave desconocida es un error, así un guardado nunca pierde datos en silencio.
 */
import { z } from 'zod';
import type { Project } from './index.ts';

/** Copia local de `SCHEMA_VERSION` de index.ts (evita un ciclo de importación cuando index re-exporte este módulo); el test la mantiene sincronizada. */
const SCHEMA_VERSION = 3 as const;

/** Fotograma entero ≥ 0 (§7: el tiempo son fotogramas enteros). */
const frame = z.number().int().nonnegative();
const id = z.string().min(1);

export const techniqueSchema = z.enum(['2d', '3d', '2.5d', '2d-guided-by-3d', '3d-with-2d']);

export const keyframeSchema = z.strictObject({
  frame,
  value: z.number().finite(),
  easing: z.enum(['linear', 'smooth', 'hold']).optional(),
});

export const curveSchema = z.strictObject({
  defaultValue: z.number().finite(),
  keyframes: z.array(keyframeSchema),
});

export const assetTypeSchema = z.enum(['video', 'audio', 'image', 'svg', 'drawing', 'model3d']);

export const assetSchema = z.strictObject({
  id,
  type: assetTypeSchema,
  uri: z.string().min(1),
  hash: z.string().optional(),
  licenseId: z.string().optional(),
});

export const channelSchema = z.enum([
  'x',
  'y',
  'rotation',
  'scale',
  'opacity',
  'expression',
  'integration',
  'volume',
]);

export const externalProjectRefSchema = z.strictObject({
  pluginId: id,
  uri: z.string().min(1),
  engineVersion: z.string().optional(),
  renderArtifactId: z.string().optional(),
});

/** Contenido de una capa `text` (ADR-0012). */
export const textContentSchema = z.strictObject({
  content: z.string().min(1),
  fontFamily: z.string().min(1).optional(),
  fontSize: z.number().finite().positive().optional(),
  color: z.string().min(1).optional(),
});

export const layerSchema = z.strictObject({
  id,
  kind: z.union([assetTypeSchema, z.enum(['text', 'group'])]),
  assetId: z.string().optional(),
  startFrame: frame,
  durationFrames: frame,
  sourceInFrame: frame.optional(),
  zIndex: z.number().int(),
  techniques: z.array(techniqueSchema),
  guide3DLayerId: z.string().optional(),
  channels: z.partialRecord(channelSchema, curveSchema),
  externalProject: externalProjectRefSchema.optional(),
  text: textContentSchema.optional(),
}).superRefine((layer, ctx) => {
  if (layer.text !== undefined && layer.kind !== 'text') {
    ctx.addIssue({
      code: 'custom',
      path: ['text'],
      message: `\`text\` solo es válido en capas de tipo "text"; esta capa es "${layer.kind}"`,
    });
  }
});

export const sceneSchema = z.strictObject({
  id,
  durationFrames: frame,
  layers: z.array(layerSchema),
});

export const sequenceSchema = z.strictObject({ id, scenes: z.array(sceneSchema) });

export const renderArtifactSchema = z.strictObject({
  id,
  uri: z.string().min(1),
  type: z.string().min(1),
  dependencyHash: z.string().min(1),
  producedBy: z.strictObject({ pluginId: id, pluginVersion: z.string().min(1) }),
  seed: z.number().int().optional(),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const fpsSchema = z.strictObject({
  num: z.number().int().positive(),
  den: z.number().int().positive(),
});

export const projectSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  name: z.string(),
  fps: fpsSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  seed: z.number().int(),
  assets: z.array(assetSchema),
  sequences: z.array(sequenceSchema),
  artifacts: z.array(renderArtifactSchema).optional(),
}).superRefine((project, ctx) => {
  // Validación referencial (ADR-0015): ids de artefactos únicos y renderArtifactId resoluble.
  const known = new Set<string>();
  (project.artifacts ?? []).forEach((a, n) => {
    if (known.has(a.id)) {
      ctx.addIssue({ code: 'custom', path: ['artifacts', n, 'id'], message: `id de artefacto duplicado: "${a.id}"` });
    }
    known.add(a.id);
  });
  project.sequences.forEach((seq, i) => seq.scenes.forEach((scene, j) => scene.layers.forEach((layer, k) => {
    const ref = layer.externalProject?.renderArtifactId;
    if (ref !== undefined && !known.has(ref)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sequences', i, 'scenes', j, 'layers', k, 'externalProject', 'renderArtifactId'],
        message: `renderArtifactId "${ref}" no existe en artifacts`,
      });
    }
  })));
});

/** Tipo derivado del esquema; debe seguir siendo equivalente a `Project` de `index.ts`. */
export type ProjectFromSchema = z.infer<typeof projectSchema>;

export type ValidationIssue = { path: string; message: string; code: string };

export type ParseProjectResult =
  | { ok: true; value: Project }
  | { ok: false; errors: ValidationIssue[] };

/** Ruta legible: `sequences[0].scenes[1].layers[0].startFrame`; vacía para la raíz se muestra como `$`. */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const seg of path) {
    out += typeof seg === 'number' ? `[${seg}]` : out === '' ? String(seg) : `.${String(seg)}`;
  }
  return out === '' ? '$' : out;
}

/**
 * Valida un valor ya parseado (no una cadena JSON). Un `schemaVersion` desconocido da un error
 * propio (`unknown-schema-version`) antes de validar el resto, para que el llamador pueda migrar.
 */
export function parseProject(input: unknown): ParseProjectResult {
  if (typeof input === 'object' && input !== null && !Array.isArray(input) && 'schemaVersion' in input) {
    const found = (input as { schemaVersion: unknown }).schemaVersion;
    if (found !== SCHEMA_VERSION) {
      return {
        ok: false,
        errors: [
          {
            path: 'schemaVersion',
            code: 'unknown-schema-version',
            message: `schemaVersion ${JSON.stringify(found)} no soportado; esta versión entiende ${SCHEMA_VERSION}`,
          },
        ],
      };
    }
  }
  const result = projectSchema.safeParse(input);
  if (result.success) {
    // Los tipos de Zod y los de index.ts son equivalentes (test de tipos); el cast cubre solo `exactOptionalPropertyTypes`.
    return { ok: true, value: result.data as Project };
  }
  return {
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: formatPath(i.path),
      code: i.code,
      message: i.message,
    })),
  };
}

/** JSON Schema publicable, generado desde Zod (no se escribe a mano; ADR-0008). */
export function projectJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(projectSchema) as Record<string, unknown>;
}
