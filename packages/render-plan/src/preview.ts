export type PreviewProfileOptions = {
  width: number;
  height: number;
  vramBudgetMiB: number;
};

export type PreviewProfile = {
  width: number;
  height: number;
  samples: number;
  estimatedVramBytes: number;
};

const bytesPerMiB = 1_048_576;
const reservedBytes = 256n * BigInt(bytesPerMiB);
const frameBytesPerPixel = 64n;
const sampleBytesPerPixel = 16n;
const sampleTiers = [8, 4, 2, 1] as const;

function estimateBytes(width: bigint, height: bigint, samples: number): bigint {
  return reservedBytes + width * height * (frameBytesPerPixel + BigInt(samples) * sampleBytesPerPixel);
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Estima la reserva del plan con 256 MiB fijos, 64 bytes por píxel para buffers y
 * 16 bytes por píxel y muestra como margen de trabajo. Es una política de
 * planificación independiente del motor. El consumo real depende de la escena.
 */
export function selectPreviewProfile({ width, height, vramBudgetMiB }: PreviewProfileOptions): PreviewProfile {
  if (!positiveSafeInteger(width) || !positiveSafeInteger(height)) {
    throw new RangeError('La resolución debe tener dimensiones enteras positivas y seguras.');
  }
  const budgetBytes = Number.isFinite(vramBudgetMiB) ? Math.floor(vramBudgetMiB * bytesPerMiB) : NaN;
  if (!positiveSafeInteger(budgetBytes)) {
    throw new RangeError('El presupuesto de VRAM debe ser positivo y expresable en bytes seguros.');
  }

  const budget = BigInt(budgetBytes);
  if (budget < estimateBytes(1n, 1n, 1)) {
    throw new RangeError('El presupuesto de VRAM es insuficiente para una previsualización de 1 × 1.');
  }

  const landscape = width >= height;
  const longest = BigInt(Math.max(width, height));
  const shortest = BigInt(Math.min(width, height));
  const scaledShortest = (candidate: bigint) => {
    const rounded = (shortest * candidate + longest / 2n) / longest;
    return rounded > 0n ? rounded : 1n;
  };

  // Acota el lado largo a la mitad y busca el mayor tamaño que admite una muestra.
  let lower = 1n;
  let upper = longest > 1n ? longest / 2n : 1n;
  while (lower < upper) {
    const middle = (lower + upper + 1n) / 2n;
    if (estimateBytes(middle, scaledShortest(middle), 1) <= budget) lower = middle;
    else upper = middle - 1n;
  }

  const side = scaledShortest(lower);
  const samples = sampleTiers.find((tier) => estimateBytes(lower, side, tier) <= budget) ?? 1;
  return {
    width: Number(landscape ? lower : side),
    height: Number(landscape ? side : lower),
    samples,
    estimatedVramBytes: Number(estimateBytes(lower, side, samples)),
  };
}
