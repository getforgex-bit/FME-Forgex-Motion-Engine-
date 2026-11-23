/**
 * Soporte de las cinco técnicas por backend (FDN-061). `yes` solo con evidencia de un render real;
 * `unknown` cuando no se ha probado; nunca se afirma por falta de datos (§8.5).
 */
import type { Technique } from '@fme/project';

export type BackendId = 'revideo' | 'blender';
export type TechniqueSupport = { support: 'yes' | 'partial' | 'no' | 'unknown'; note: string };

const TABLE: Record<BackendId, Record<Technique, TechniqueSupport>> = {
  revideo: {
    '2d': { support: 'yes', note: 'Capas text y svg con canales x,y,opacity,scale,rotation y gradientes (FDN-032/061).' },
    '2.5d': { support: 'no', note: 'Sin parallax ni capas con profundidad en el adaptador.' },
    '3d': { support: 'no', note: 'Revideo es 2D.' },
    '2d-guided-by-3d': { support: 'partial', note: 'Se renderiza la capa 2D, pero `guide3DLayerId` aún no condiciona la animación.' },
    '3d-with-2d': { support: 'no', note: 'El render 3D lo hace otro backend; la composición es de FME.' },
  },
  blender: {
    '2d': { support: 'no', note: 'Blender no es el backend 2D.' },
    '2.5d': { support: 'unknown', note: 'No verificado.' },
    '3d': { support: 'yes', note: 'Render headless verificado en la Fase 1 (FDN-011) y adaptador FDN-040.' },
    '2d-guided-by-3d': { support: 'unknown', note: 'No verificado: requeriría exportar guías (profundidad, normales).' },
    '3d-with-2d': { support: 'unknown', note: 'No verificado.' },
  },
};

export function techniqueSupport(backend: BackendId, technique: Technique): TechniqueSupport {
  return { ...TABLE[backend][technique] };
}

/** Técnicas con soporte `yes` o `partial` de un backend. */
export function supportedTechniques(backend: BackendId): Technique[] {
  return (Object.keys(TABLE[backend]) as Technique[]).filter(
    (t) => TABLE[backend][t].support === 'yes' || TABLE[backend][t].support === 'partial',
  );
}
