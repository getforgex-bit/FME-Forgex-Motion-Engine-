# Decisiones de arquitectura (ADR)

Registro de las decisiones duraderas de FME. Formato heredado de Segundo Cerebro (`docs/cerebro/adr/` en `develop`).

- Numeración correlativa de 4 dígitos: `NNNN-titulo-en-kebab.md`.
- Un ADR aceptado **no se edita**: se sustituye por otro nuevo que lo cite.
- Cada ADR aceptado se refleja en la memoria del proyecto (`entityType: "decision"`) y en la tabla de decisiones de [`STATUS.md`](../../STATUS.md).
- Plantilla: [`_plantilla.md`](_plantilla.md).

| ADR | Título | Estado |
|---|---|---|
| [0001](0001-registrar-decisiones-con-adr.md) | Registrar las decisiones con ADR | aceptada |
| [0002](0002-decisiones-congeladas-spec-v0.1.md) | Decisiones congeladas de la especificación v0.1 | aceptada |
| [0003](0003-forgex-stack-como-memoria.md) | FORGEX Stack como memoria y herramientas para agentes | aceptada |
| [0004](0004-licencia-pendiente.md) | Licencia de FME pendiente; uso interno mientras tanto | propuesta |
| [0005](0005-monorepo-typescript-npm-workspaces.md) | Monorepo TypeScript con npm workspaces | propuesta |
| [0006](0006-coordinacion-multiagente-por-archivos.md) | Coordinación multiagente por archivos versionados | propuesta |
| [0007](0007-carpeta-operativa-y-red-fdn.md) | Carpeta operativa local + documentos FDN versionados (sustituye parcialmente a 0006) | propuesta |
| [0008](0008-validacion-runtime-con-zod.md) | Validación en runtime del proyecto con Zod 4 | propuesta |
| [0009](0009-api-registro-conectores.md) | API del registro dinámico de conectores | propuesta |
| [0010](0010-ffmpeg-del-sistema-para-revideo.md) | Revideo con el FFmpeg del sistema; FME no redistribuye FFmpeg | propuesta |
| [0011](0011-interfaz-de-adaptadores.md) | Interfaz común de adaptadores y procedencia | propuesta |
| [0012](0012-contenido-de-capas-de-texto.md) | Contenido de las capas de texto y schemaVersion 2 | propuesta |
| [0013](0013-relevo-entre-equipos.md) | Relevo entre equipos cuando uno se queda sin cuota | aceptada |
| [0014](0014-modo-ausencia-del-usuario.md) | Modo ausencia del usuario: parada gradual y cola de decisiones | aceptada |
| [0015](0015-artefactos-en-el-proyecto.md) | Artefactos generados en el proyecto y schemaVersion 3 | propuesta |
