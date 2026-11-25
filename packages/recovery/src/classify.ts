/**
 * Clasificador determinista de fallos de ejecución (FDN-072).
 */
import type { AdapterJobResult } from '@fme/connectors';
import type { ErrorClassification } from './types.ts';

type CategoryRule = {
  category: ErrorClassification['category'];
  patterns: readonly string[];
  retryable: boolean;
  degradable: boolean;
  fallbackEligible: boolean;
  reasonPrefix: string;
};

const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: 'out-of-vram',
    patterns: [
      'out-of-vram',
      'oom-gpu',
      'cuda out of memory',
      'hip out of memory',
      'webgpu device lost',
      'vulkan memory',
      'gpu memory',
      'vram',
    ],
    retryable: false,
    degradable: true,
    fallbackEligible: true,
    reasonPrefix: 'Memoria de vídeo (VRAM) insuficiente',
  },
  {
    category: 'out-of-ram',
    patterns: [
      'out-of-ram',
      'enomem',
      'heap out of memory',
      'cannot allocate memory',
    ],
    retryable: false,
    degradable: true,
    fallbackEligible: true,
    reasonPrefix: 'Memoria principal (RAM) agotada',
  },
  {
    category: 'unsupported-capability',
    patterns: [
      'unsupported-alpha',
      'unsupported-layer',
      'unsupported-scene',
      'unsupported-fps',
    ],
    retryable: false,
    degradable: false,
    fallbackEligible: true,
    reasonPrefix: 'Capacidad o formato no soportado por el motor actual',
  },
  {
    category: 'invalid-input',
    patterns: [
      'invalid-input',
      'bad-input',
      'invalid-project',
      'bad-requirements',
      'missing-asset',
      'asset-outside-project',
      'unsupported-operation',
      'blender_invalid_job',
    ],
    retryable: false,
    degradable: false,
    fallbackEligible: false,
    reasonPrefix: 'Entrada o contrato inválido (error determinista no reintentable)',
  },
  {
    category: 'timeout',
    patterns: ['etimedout', 'timed out', 'timeout', 'killed'],
    retryable: true,
    degradable: false,
    fallbackEligible: true,
    reasonPrefix: 'Tiempo de ejecución excedido',
  },
  {
    category: 'transient',
    patterns: [
      'atomic_replace_unavailable',
      'atomic-replace-unavailable',
      'eperm',
      'ebusy',
      'eacces',
      'eagain',
      'econnreset',
      'addrinuse',
      'transient',
    ],
    retryable: true,
    degradable: false,
    fallbackEligible: true,
    reasonPrefix: 'Fallo transitorio de E/S o bloqueo temporal',
  },
  {
    category: 'engine-unavailable',
    patterns: [
      'engine-unavailable',
      'engine-missing',
      'engine-broken',
      'browser-missing',
      'blender-missing',
      'ffprobe_no_disponible',
      'enoent',
      'unavailable',
    ],
    retryable: false,
    degradable: false,
    fallbackEligible: true,
    reasonPrefix: 'Motor o binario no disponible en el entorno',
  },
  {
    category: 'engine-crash',
    patterns: [
      'engine-crash',
      'sigsegv',
      'sigabrt',
      'segfault',
      'crash',
      'exit code',
      'non-zero',
      'process exited',
    ],
    retryable: false,
    degradable: false,
    fallbackEligible: true,
    reasonPrefix: 'Terminación anómala del motor externo',
  },
];

function extractFromThrown(error: unknown): {
  codes: string[];
  corpus: string;
} {
  if (error instanceof Error) {
    const maybeCode =
      'code' in error && typeof error.code === 'string' ? error.code : undefined;
    const codes = maybeCode !== undefined ? [maybeCode] : [];
    const corpus = `${maybeCode ?? ''} ${error.name} ${error.message}`.toLowerCase();
    return { codes, corpus };
  }
  const text = String(error);
  return { codes: [], corpus: text.toLowerCase() };
}

function isAdapterJobResult(value: unknown): value is AdapterJobResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'diagnostics' in value
  );
}

/**
 * Clasifica deterministamente un `AdapterJobResult` fallido/cancelado o una excepción lanzada.
 */
export function classifyExecutionError(
  failure: AdapterJobResult | unknown,
): ErrorClassification {
  if (isAdapterJobResult(failure)) {
    const codes = failure.diagnostics.map((d) => d.code);
    if (failure.status === 'cancelled') {
      return {
        category: 'cancelled',
        retryable: false,
        degradable: false,
        fallbackEligible: false,
        reason:
          failure.diagnostics[0]?.message ??
          'Ejecución cancelada explícitamente.',
        matchedCodes: codes,
      };
    }

    const corpus = failure.diagnostics
      .map((d) => `${d.code} ${d.message}`)
      .join(' | ')
      .toLowerCase();

    return matchRules(corpus, codes, failure.diagnostics[0]?.message);
  }

  const { codes, corpus } = extractFromThrown(failure);
  const firstMsg = failure instanceof Error ? failure.message : String(failure);
  return matchRules(corpus, codes, firstMsg);
}

function matchRules(
  corpus: string,
  codes: string[],
  firstMessage?: string,
): ErrorClassification {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => corpus.includes(pattern))) {
      return {
        category: rule.category,
        retryable: rule.retryable,
        degradable: rule.degradable,
        fallbackEligible: rule.fallbackEligible,
        reason:
          firstMessage !== undefined && firstMessage.length > 0
            ? `${rule.reasonPrefix}: ${firstMessage}`
            : rule.reasonPrefix,
        matchedCodes: codes,
      };
    }
  }

  return {
    category: 'unknown',
    retryable: false,
    degradable: false,
    fallbackEligible: true,
    reason:
      firstMessage !== undefined && firstMessage.length > 0
        ? `Fallo no clasificado: ${firstMessage}`
        : 'Fallo no clasificado del adaptador.',
    matchedCodes: codes,
  };
}
