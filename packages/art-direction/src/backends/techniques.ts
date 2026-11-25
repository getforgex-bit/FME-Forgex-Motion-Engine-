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
    '2.5d': { support: 'yes', note: 'Parallax por profundidad (`requirements.depth`): el desplazamiento de cámara se atenúa 1/(1+d) y la escala 1/(1+0,25·d); verificado con la razón de desplazamientos del centroide en un render real (FDN-063). La composición de planos la hace el pipeline.' },
    '3d': { support: 'no', note: 'Revideo es 2D.' },
    '2d-guided-by-3d': { support: 'yes', note: '`guide3DLayerId` + guía JSON v1 (`requirements.guide`): la capa 2D sigue la posición en pantalla del objeto 3D; verificado contra los PNG reales de Blender (FDN-063). La guía la produce hoy la silueta alfa del render; el export nativo de Blender está solicitado.' },
    '3d-with-2d': { support: 'partial', note: 'El overlay 2D se renderiza con alpha (MOV ProRes 4444) y puede seguir al objeto 3D; la composición sobre el render 3D la hace FreeCut/FFmpeg (verificada con `overlay` en FDN-063, aún no integrada en el pipeline para esta técnica).' },
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
