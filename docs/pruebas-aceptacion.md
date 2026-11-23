# Prueba de integración y criterios de aceptación

> Fuente: especificación v0.1, §20. Marca cada criterio solo cuando exista **evidencia reproducible** (comando, artefacto y entrada en la bitácora).

## 1. Producción híbrida de 10 segundos

A **30 FPS**, la primera prueba tiene **300 fotogramas** (0 a 299). La secuencia es un ejemplo ajustable a los recursos disponibles; **no** es una producción ya realizada. Detalle en [`examples/prueba-hibrida-10s/`](../examples/prueba-hibrida-10s/README.md).

| Rango | Contenido | Origen previsto |
|---|---|---|
| 0,0–10,0 s | Vídeo o imagen de fondo; audio si procede | Editor FreeCut y biblioteca de assets |
| 1,0–8,0 s | Figura/personaje o gráfica 2D animada con estilo controlado | Revideo y recursos 2D |
| 3,5–8,5 s | Elemento/escena 3D con movimiento de cámara | Blender y adaptador Python/MCP |
| 6,0–10,0 s | Tipografía cinética y composición final | Revideo + editor |
| Todo el vídeo | Cambios temporales de expresión/fusión y combinaciones de modos | Proyecto FME, planner y adaptadores |

## 2. Ocho criterios de éxito

| # | Criterio | Fase | Estado | Evidencia |
|---|---|---|---|---|
| 1 | FreeCut, Revideo y Blender ejecutan **cada uno** una operación de muestra de forma independiente | 1 | ☑ | A0, 2026-11-23: FreeCut `run.ps1` → MP4 de 150 fotogramas a 30 FPS con audio (`probe-media`); Revideo `npm run verify` (A1, ×2 desde cero) y 8/8 tests con el motor real sobre `develop`; Blender `run.ps1` en PS 5.1 → 90 PNG RGBA, SHA-256 RGBA `c9706f10…450b` reproducido ([bitácora A0](bitacora/2026-11-22-claude-code-a0-arranque-fdn.md)) |
| 2 | Un proyecto FME puede guardar, validar, recuperar y versionar su timeline | 2 | ☑ | FDN-021/022/023/024/026: `node --test packages/project/test/*.test.ts` → 36/36; v0 → v1 por `deserialize`; round-trip byte a byte de 4 fixtures ([bitácora A0, integración 3](bitacora/2026-11-22-claude-code-a0-arranque-fdn.md)) |
| 3 | Los tres adaptadores ejecutan trabajos **reales**, no simulados | 4 | ☑ | A0, 2026-11-23: `node --test packages/pipeline/test/*.test.ts` con Revideo, Blender y FreeCut reales → 1/1 en 87 s. `probe-media` del `hybrid.mp4`: 300 fotogramas, 30 FPS, 1280×720, con audio. El proyecto v3 resultante tiene 5 artefactos (Revideo ×2, Blender, precodificación ProRes y FreeCut), con `renderArtifactId` enlazados en las capas 2D, 3D y título. Un mosaico de los fotogramas 15/120/200/290 muestra cada capa en su rango ([bitácora A0](bitacora/2026-11-22-claude-code-a0-arranque-fdn.md)) |
| 4 | El router selecciona una ruta compatible consultando primero la tarjeta simple | 5 | ☑ | A0, 2026-11-23: `node --test packages/router/test/real-adapters.test.ts` → con las tarjetas **reales** de los 3 adaptadores, «animación vectorial» → Revideo, «composición» → FreeCut y «3D» → Blender, cada una con `simpleCardsRead` 3, `advancedInspections` 0 e `inspect` no llamado (FDN-052) |
| 5 | Solo consulta el detalle avanzado cuando una restricción crítica lo requiere | 5 | ☑ | Mismo test: con `alpha: yes` inspecciona **solo** la sección `technical` de los finalistas (vídeo: Revideo y FreeCut, que se descarta por alpha; 3D: solo Blender). Fallbacks reales con FreeCut y Blender en `packages/recovery/test/real-fallbacks.integration.test.ts` → 3/3 (A0). Tokens: 222 de tarjetas simples frente a 503 si se leyeran todas las avanzadas (FDN-051) |
| 6 | Los gradientes cambian una propiedad visual comprobable a lo largo del tiempo | 6 | ☑ | FDN-061 (Revideo): `node --test packages/adapters/revideo/test/*.integration.test.ts` con el motor real sobre `develop` → 9/9 (A0, 2026-11-23). Con `expression` 0→1, los píxeles de contorno en los fotogramas 0/60/90/119 son 0, 11687, 21018 y 28564; con `integration` 1→0, los de sombra son 45705, 20241, 6047 y 1649. Blender (FDN-061b): índice de contorno 0, 1931, 17785 y 76056 y luminancia central 112, 115, 123 y 133 en cuatro fotogramas; A0: `node --test packages/adapters/blender/test/*.test.ts` → 7/7 con Blender real |
| 7 | Se exporta correctamente un vídeo híbrido de 10 s con audio y sincronía adecuados (cuando aplique) | 7 | ☐ | |
| 8 | Se pueden reabrir las fuentes externas y cambiar una parte sin rehacer todos los activos | 7 | ☑ | A0, 2026-11-23: `node --test packages/pipeline/test/incremental.integration.test.ts` con los 3 motores reales → 1/1 en 135 s. Ejecución 1 completa; 2 sin cambios con 0 jobs de motor; 3 tras cambiar el título con 1 job de Revideo + la composición, y el resto de la caché. Diferencia de píxeles **fuera** de 180–299 = 0 en los 13 fotogramas medidos; dentro, una media de 5,1–5,8. `reopenExternalSource` resuelve el `ExternalProjectRef` (FDN-075a) |

## 3. Pruebas técnicas específicas

| Prueba | Qué se mide |
|---|---|
| Temporal | Fotogramas correctos, sincronía A/V, ausencia de deriva |
| Estética | Sin parpadeo no deseado, lectura clara, continuidad de estilo |
| Editabilidad | Se conserva el origen y se regeneran solo los derivados necesarios |
| Enrutamiento | Conector correcto; capacidades desconocidas bien tratadas |
| Recursos | VRAM/RAM, tiempo por fotograma, tamaño de caché y fallos |
| Seguridad | Acceso a rutas, permisos y bloqueo de comandos no autorizados |
| Regresión | Los proyectos de muestra siguen funcionando tras actualizar un adaptador |

## 4. Cómo registrar evidencia

1. Crea una entrada en [`docs/bitacora/`](bitacora/) con el comando exacto, las versiones fijadas, el hardware y los artefactos (rutas o hashes).
2. Enlázala en la columna "Evidencia" de la tabla anterior y marca ☑.
3. Guarda el hecho en la memoria del proyecto (`entityType: "decision"` o `"task"`; ver [`memoria-y-registro.md`](memoria-y-registro.md)).
