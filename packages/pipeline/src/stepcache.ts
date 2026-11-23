/**
 * Caché incremental del pipeline (FDN-075a, criterio #8).
 *
 * - Las ENTRADAS de la caché son manifiestos JSON pequeños guardados con `DiskCache` (`@fme/cache`), con la clave
 *   `cacheKey` de cada segmento (`@fme/render-plan`) o de la composición (`dependencyHash`).
 * - Los ARCHIVOS pesados (MOV, PNG, MP4) viven en `cache/files/<clave>/` y el manifiesto lista su SHA-256: una
 *   entrada solo cuenta como acierto si TODOS sus archivos existen y coinciden (nunca se sirve una caché corrupta).
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DiskCache } from '@fme/cache';
import type { ArtifactProvenance } from '@fme/connectors';
import type { RenderArtifact } from '@fme/project';

export type CachedFile = { rel: string; sha256: string; size: number };

export type CachedStep = {
  id: string;
  layerId?: string;
  operation: string;
  adapterId: string;
  diagnostics: { code: string; message: string; severity?: string }[];
  provenance: ArtifactProvenance[];
};

export type CacheManifest = {
  version: 1;
  key: string;
  kind: 'revideo' | 'blender' | 'compose';
  files: CachedFile[];
  artifacts: RenderArtifact[];
  steps: CachedStep[];
};

const sha256File = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');

export class StepCache {
  readonly root: string;
  readonly filesRoot: string;
  readonly #store: DiskCache;
  readonly #manifests: string;

  constructor(cacheDir: string) {
    mkdirSync(cacheDir, { recursive: true });
    this.root = realpathSync(cacheDir);
    this.#manifests = join(this.root, 'manifests');
    this.filesRoot = join(this.root, 'files');
    mkdirSync(this.#manifests, { recursive: true });
    mkdirSync(this.filesRoot, { recursive: true });
    this.#store = new DiskCache({ allowedRoot: this.root, directory: this.#manifests });
  }

  /** Carpeta de archivos de una clave. */
  dirFor(key: string): string {
    const dir = join(this.filesRoot, key);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Devuelve el manifiesto solo si sus archivos siguen intactos. */
  async lookup(key: string, kind: CacheManifest['kind']): Promise<CacheManifest | undefined> {
    const bytes = await this.#store.get(key);
    if (!bytes) return undefined;
    let manifest: CacheManifest;
    try { manifest = JSON.parse(bytes.toString('utf8')) as CacheManifest; } catch { return undefined; }
    if (manifest.version !== 1 || manifest.key !== key || manifest.kind !== kind) return undefined;
    const dir = join(this.filesRoot, key);
    for (const f of manifest.files) {
      const p = join(dir, f.rel);
      try {
        if (statSync(p).size !== f.size || sha256File(p) !== f.sha256) return undefined;
      } catch { return undefined; }
    }
    return manifest;
  }

  /** Copia un archivo a la carpeta de la clave y lo anota (devuelve su ruta definitiva). */
  adopt(key: string, source: string, rel: string, files: CachedFile[]): string {
    const dest = join(this.dirFor(key), rel);
    mkdirSync(join(dest, '..'), { recursive: true });
    copyFileSync(source, dest);
    files.push({ rel, sha256: sha256File(dest), size: statSync(dest).size });
    return dest;
  }

  /** Copia todos los archivos de un directorio (sin recursión) bajo `relDir/`. */
  adoptDir(key: string, sourceDir: string, relDir: string, files: CachedFile[]): void {
    for (const name of readdirSync(sourceDir).sort()) this.adopt(key, join(sourceDir, name), `${relDir}/${name}`, files);
  }

  async save(manifest: CacheManifest): Promise<void> {
    await this.#store.set(manifest.key, Buffer.from(JSON.stringify(manifest), 'utf8'));
  }
}
