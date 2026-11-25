/**
 * Política de recuperación ante errores, degradación VRAM ('preview' vs 'final'),
 * subdivisión por segmentos y reintentos seguros acotados (FDN-072).
 */
import type { JobRequest } from '@fme/connectors';
import type {
  AttemptMitigation,
  ErrorClassification,
  ExecutionPurpose,
  RecoveryDecision,
  RecoveryOptions,
} from './types.ts';

export type PolicyRuntimeState = {
  transientRetriesUsed: number;
  vramDegradationsUsed: number;
  subdivisionsUsed: number;
  currentSegmentCount: number;
  hasRemainingFallbacks: boolean;
};

export type FrameRangeSpec = {
  startFrame: number;
  endFrame: number;
  separator: '-' | '..';
  sourceKey: 'frameRange' | 'durationFrames';
};

export type FrameSegment = {
  index: number;
  count: number;
  startFrame: number;
  endFrame: number;
  formattedRange: string;
};

/** Extrae un rango de fotogramas válido si `frameRange` o `durationFrames > 1` está presente. */
export function parseFrameRangeSpec(
  requirements: Readonly<Record<string, string | number | boolean>>,
): FrameRangeSpec | null {
  const rawRange = requirements.frameRange;
  if (typeof rawRange === 'string') {
    const match = /^(\d+)\s*(-|\.\.)\s*(\d+)$/.exec(rawRange.trim());
    if (match !== null) {
      const start = Number(match[1]);
      const sep = match[2] === '..' ? '..' : '-';
      const end = Number(match[3]);
      if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
        return {
          startFrame: start,
          endFrame: end,
          separator: sep,
          sourceKey: 'frameRange',
        };
      }
    }
  }

  const duration = requirements.durationFrames;
  if (
    typeof duration === 'number' &&
    Number.isInteger(duration) &&
    duration > 1
  ) {
    return {
      startFrame: 0,
      endFrame: duration - 1,
      separator: '-',
      sourceKey: 'durationFrames',
    };
  }

  return null;
}

/** Divide un rango de fotogramas en `segmentCount` subrangos enteros contiguos sin pérdida. */
export function splitFrameRange(
  spec: FrameRangeSpec,
  segmentCount: number,
): FrameSegment[] {
  const totalFrames = spec.endFrame - spec.startFrame + 1;
  const clampedSegments = Math.max(1, Math.min(segmentCount, totalFrames));
  const baseSize = Math.floor(totalFrames / clampedSegments);
  const remainder = totalFrames % clampedSegments;

  const segments: FrameSegment[] = [];
  let cursor = spec.startFrame;

  for (let i = 0; i < clampedSegments; i += 1) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const segStart = cursor;
    const segEnd = cursor + size - 1;
    segments.push({
      index: i,
      count: clampedSegments,
      startFrame: segStart,
      endFrame: segEnd,
      formattedRange: `${segStart}${spec.separator}${segEnd}`,
    });
    cursor = segEnd + 1;
  }

  return segments;
}

function buildPreviewDegradation(
  job: JobRequest,
  options: Required<
    Pick<RecoveryOptions, 'minPreviewScale' | 'minSamples'>
  >,
): {
  nextRequirements: Record<string, string | number | boolean>;
  mitigations: AttemptMitigation[];
} | null {
  const nextRequirements: Record<string, string | number | boolean> = {
    ...job.requirements,
  };
  const mitigations: AttemptMitigation[] = [];

  const rawScale = nextRequirements.previewScale;
  const currentScale =
    typeof rawScale === 'number' && Number.isFinite(rawScale) && rawScale > 0
      ? rawScale
      : 1;

  if (currentScale > options.minPreviewScale) {
    const nextScale = Math.max(
      options.minPreviewScale,
      Math.round((currentScale / 2) * 1000) / 1000,
    );
    if (nextScale < currentScale) {
      nextRequirements.previewScale = nextScale;
      mitigations.push({
        type: 'reduce-preview-scale',
        detail: `Escala de preview reducida de ${currentScale} a ${nextScale}.`,
        appliedRequirements: { previewScale: nextScale },
      });
    }
  }

  const rawSamples = nextRequirements.samples;
  if (
    typeof rawSamples === 'number' &&
    Number.isFinite(rawSamples) &&
    rawSamples > options.minSamples
  ) {
    const nextSamples = Math.max(
      options.minSamples,
      Math.floor(rawSamples / 2),
    );
    if (nextSamples < rawSamples) {
      nextRequirements.samples = nextSamples;
      mitigations.push({
        type: 'reduce-samples',
        detail: `Muestras reducidas de ${rawSamples} a ${nextSamples}.`,
        appliedRequirements: { samples: nextSamples },
      });
    }
  }

  if (mitigations.length === 0) {
    return null;
  }

  return { nextRequirements, mitigations };
}

/**
 * Decide la siguiente acción determinista tras un fallo en el conector actual.
 */
export function decideRecoveryAction(
  classification: ErrorClassification,
  currentJob: JobRequest,
  state: PolicyRuntimeState,
  options: RecoveryOptions = {},
): RecoveryDecision {
  const purpose: ExecutionPurpose = options.purpose ?? 'final';
  const maxTransientRetries = options.maxTransientRetries ?? 2;
  const maxVramDegradations = options.maxVramDegradations ?? 2;
  const vramLimitMB = options.vramLimitMB ?? 4096;
  const allowSubdivision = options.allowSubdivision ?? false;
  const minPreviewScale = options.minPreviewScale ?? 0.25;
  const minSamples = options.minSamples ?? 1;
  const maxSegments = options.maxSegments ?? 8;

  if (
    classification.category === 'invalid-input' ||
    classification.category === 'cancelled'
  ) {
    return {
      action: 'escalate-user',
      reason: classification.reason,
      constraintMessage: classification.reason,
      suggestedActions:
        classification.category === 'invalid-input'
          ? [
              'Corregir los parámetros o rutas de entrada del proyecto antes de reintentar.',
            ]
          : ['Reanudar manualmente solo si el usuario vuelve a solicitar el render.'],
    };
  }

  if (
    classification.category === 'transient' ||
    classification.category === 'timeout'
  ) {
    if (state.transientRetriesUsed < maxTransientRetries) {
      return {
        action: 'retry',
        reason: `Reintento seguro (${state.transientRetriesUsed + 1}/${maxTransientRetries}) tras ${classification.category}.`,
        mitigations: [
          {
            type: 'retry-safe',
            detail: `Reintento seguro #${state.transientRetriesUsed + 1} en directorio aislado tras "${classification.category}".`,
          },
        ],
      };
    }

    if (classification.fallbackEligible && state.hasRemainingFallbacks) {
      return {
        action: 'fallback',
        reason: `Agotados los reintentos seguros (${maxTransientRetries}); conmutando a backend alternativo.`,
      };
    }

    return {
      action: 'escalate-user',
      reason: `Agotados los reintentos seguros (${maxTransientRetries}) sin alternativa disponible: ${classification.reason}`,
      constraintMessage: `Fallo persistente tras ${maxTransientRetries} reintentos: ${classification.reason}`,
      suggestedActions: [
        'Aumentar timeoutMs o liberar recursos/archivos bloqueados en el entorno.',
      ],
    };
  }

  if (
    classification.category === 'out-of-vram' ||
    classification.category === 'out-of-ram'
  ) {
    if (
      purpose === 'preview' &&
      state.vramDegradationsUsed < maxVramDegradations
    ) {
      const degraded = buildPreviewDegradation(currentJob, {
        minPreviewScale,
        minSamples,
      });
      if (degraded !== null) {
        return {
          action: 'degrade-preview',
          reason: `Degradación controlada de previsualización ante ${classification.category} (límite ${vramLimitMB} MB).`,
          nextRequirements: degraded.nextRequirements,
          mitigations: degraded.mitigations,
        };
      }
    }

    const rangeSpec = parseFrameRangeSpec(currentJob.requirements);
    if (
      allowSubdivision &&
      rangeSpec !== null &&
      state.subdivisionsUsed < maxVramDegradations
    ) {
      const nextSegmentCount = Math.min(
        maxSegments,
        Math.max(2, state.currentSegmentCount * 2),
      );
      const totalFrames = rangeSpec.endFrame - rangeSpec.startFrame + 1;
      if (nextSegmentCount > state.currentSegmentCount && totalFrames >= nextSegmentCount) {
        return {
          action: 'subdivide',
          segmentCount: nextSegmentCount,
          reason: `Subdividiendo rango ${rangeSpec.startFrame}-${rangeSpec.endFrame} en ${nextSegmentCount} segmentos sin pérdida de calidad.`,
          mitigations: [
            {
              type: 'subdivide-segments',
              detail: `Subdivisión en ${nextSegmentCount} segmentos para rango ${rangeSpec.startFrame}-${rangeSpec.endFrame}.`,
              appliedRequirements: { segmentCount: nextSegmentCount },
            },
          ],
        };
      }
    }

    if (classification.fallbackEligible && state.hasRemainingFallbacks) {
      return {
        action: 'fallback',
        reason:
          purpose === 'final'
            ? `VRAM/RAM insuficiente en modo final (no se degrada resolución/calidad); probando backend alternativo.`
            : `Agotada degradación de preview ante ${classification.category}; probando backend alternativo.`,
      };
    }

    const constraintMessage =
      purpose === 'final'
        ? `Restricción real de memoria (${classification.category}, referencia ${vramLimitMB} MB VRAM): en entrega final no se reduce resolución ni muestras de forma silenciosa.`
        : `Memoria insuficiente (${classification.category}, límite ${vramLimitMB} MB VRAM) incluso tras degradar previsualización.`;

    return {
      action: 'escalate-user',
      reason: constraintMessage,
      constraintMessage,
      suggestedActions: [
        'Habilitar subdivisión por segmentos (allowSubdivision: true) o reducir rango/resolución explícitamente.',
        'Registrar un backend alternativo con mayor tolerancia de memoria (p. ej. render CPU).',
      ],
    };
  }

  if (classification.fallbackEligible && state.hasRemainingFallbacks) {
    return {
      action: 'fallback',
      reason: `Conmutando a backend alternativo tras "${classification.category}": ${classification.reason}`,
    };
  }

  return {
    action: 'escalate-user',
    reason: classification.reason,
    constraintMessage: classification.reason,
    suggestedActions: [
      'Verificar instalación/disponibilidad del motor o proporcionar un backend alternativo.',
    ],
  };
}
