# Adaptador Blender

`@fme/adapter-blender` renderiza una capa `model3d` de un proyecto FME mediante la operación `render.image-sequence`. Ejecuta Blender headless con el script de `runtime/engines/blender/`. La ruta del motor viene de `FME_BLENDER_PATH` o de la instalación estándar. `createBlenderAdapter` también admite `blenderPath` en la configuración del anfitrión.

```typescript
import { createBlenderAdapter } from '@fme/adapter-blender';

const adapter = createBlenderAdapter({ allowedRoots: [projectRoot, jobRoot] });
const result = await adapter.run({
  projectId: 'mi-proyecto',
  operation: 'render.image-sequence',
  inputs: [{ type: 'fme/project+json', uri: projectFileUri }],
  requirements: { layerId: 'capa-3d', resolution: '256x144' },
}, { jobId, workDir: jobDirectory, timeoutMs: 60_000 });
```

`workDir` debe existir antes de llamar al adaptador. Cada trabajo escribe la solicitud, los logs y los fotogramas dentro de ese directorio. La configuración `allowedRoots` identifica raíces locales existentes bajo control del anfitrión para la lectura de proyectos y modelos y la escritura de resultados. El lanzador valida rutas y usa un entorno explícito. Blender se ejecuta con los permisos de la cuenta anfitriona.

Se puede pasar el proyecto con una ruta absoluta o una URI `file:`. El modelo puede estar referenciado por ruta relativa al proyecto. Los modelos existentes admitidos son `.glb` y `.blend` autocontenidos. Si falta el modelo, se devuelve un aviso `BLENDER_ASSET_MISSING` y se renderiza un primitivo. `resolution` es opcional y usa `ANCHOxALTO`. Su valor por omisión viene de las dimensiones del proyecto.

La salida contiene un `image/png` por fotograma. El frame relativo 0 de FME corresponde a `frame-0001.png`. Cada procedencia contiene la versión real de Blender, parámetros de render, hash SHA-256 del archivo y hash SHA-256 de los píxeles RGBA decodificados.

```powershell
npm --workspace @fme/adapter-blender test
```

La suite omite de forma explícita los renders reales si el motor está indisponible.
