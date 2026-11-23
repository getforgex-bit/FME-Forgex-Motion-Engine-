/** Grafo en memoria con aristas de una dependencia a sus derivados. */
export class DependencyGraph {
  readonly #dependencies = new Map<string, Set<string>>();
  readonly #dependents = new Map<string, Set<string>>();

  /** Sustituye las dependencias registradas para un nodo. */
  setDependencies(nodeId: string, dependencies: Iterable<string>): void {
    const next = new Set(dependencies);
    for (const dependency of this.#dependencies.get(nodeId) ?? []) {
      const inverse = this.#dependents.get(dependency)!;
      inverse.delete(nodeId);
      if (inverse.size === 0) this.#dependents.delete(dependency);
    }

    if (next.size === 0) this.#dependencies.delete(nodeId);
    else this.#dependencies.set(nodeId, next);
    for (const dependency of next) {
      let inverse = this.#dependents.get(dependency);
      if (!inverse) {
        inverse = new Set<string>();
        this.#dependents.set(dependency, inverse);
      }
      inverse.add(nodeId);
    }
  }

  /** Devuelve los derivados transitivos una vez cada uno y conserva el grafo para otros cambios. */
  invalidate(nodeId: string): string[] {
    const affected = new Set([nodeId]);
    // Las nuevas entradas del Set se recorren después de las ya visitadas.
    for (const current of affected) {
      for (const dependent of this.#dependents.get(current) ?? []) {
        affected.add(dependent);
      }
    }
    affected.delete(nodeId);
    return [...affected].sort();
  }
}
