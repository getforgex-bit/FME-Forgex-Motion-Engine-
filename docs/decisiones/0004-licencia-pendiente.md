# ADR-0004: Licencia de FME pendiente; uso interno mientras tanto

- **Estado:** propuesta · **Dueño:** FORGEX MEDIA · **Revisable:** antes de publicar o distribuir cualquier artefacto de FME

## Contexto

La spec (§18) prevé una comercialización posterior y combina dependencias permisivas (MIT/BSD/Apache/ISC) con copyleft (GPL/LGPL: Blender, FFmpeg según la compilación). La licencia del propio código de FME no está decidida y condiciona la forma de acoplar componentes GPL.

## Decisión (propuesta)

- Hasta que se decida, el código de FME es **de uso interno de ForgeX** y no se añade ningún archivo `LICENSE`.
- Las herramientas GPL se integran **como procesos externos** (CLI/archivo), sin enlazarlas ni redistribuir binarios modificados.
- La licencia se decidirá tras la auditoría de las versiones fijadas en la Fase 1, con una revisión jurídica si se va a distribuir.

## Consecuencias

- Mantiene abiertas las opciones (licencia propietaria, open core u open source permisivo).
- Riesgo: si el repo es público, la ausencia de licencia implica "todos los derechos reservados", lo que puede confundir a colaboradores externos.
