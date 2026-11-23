import { createHash } from 'node:crypto';

export type JsonValue =
  | null | boolean | number | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type CacheDependencies = {
  readonly projectId: string;
  readonly segment: JsonValue;
  readonly assets: readonly JsonValue[];
  readonly adapters: readonly JsonValue[];
};

function canonicalJson(value: JsonValue, ancestors: Set<object>): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    throw new TypeError('Las dependencias de caché deben ser valores JSON finitos.');
  }
  if (ancestors.has(value)) {
    throw new TypeError('Las dependencias de caché no admiten ciclos.');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index++) {
        items.push(canonicalJson(value[index]!, ancestors));
      }
      return '[' + items.join(',') + ']';
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) {
      throw new TypeError('Las dependencias de caché requieren objetos JSON planos.');
    }
    const object = value as { readonly [key: string]: JsonValue };
    const fields = Object.keys(object).sort().map((key) =>
      JSON.stringify(key) + ':' + canonicalJson(object[key]!, ancestors),
    );
    return '{' + fields.join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

/** SHA-256 del JSON UTF-8 con claves ordenadas por código UTF-16. Conserva el orden de los arrays. */
export function dependencyHash(input: CacheDependencies): string {
  return createHash('sha256').update(canonicalJson(input, new Set())).digest('hex');
}
