# Runtime

- `workers/`: ejecución de procesos externos (Blender, Revideo, FFmpeg) con aislamiento, timeouts y registro.
- `cache/`: previsualizaciones y artefactos intermedios. La clave se deriva de proyecto, segmento, assets y versiones de adaptadores (spec §13.4). **No se versiona.**
