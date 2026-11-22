# Forgex Motion Engine (FME)

> Motor audiovisual **procedural, modular, AI-first** y orientado a la integración de software libre.
> Proyecto de **FORGEX MEDIA**.

FME conecta herramientas existentes (editores, motores de animación por código, 3D, composición, audio) para producir **vídeo, animación, motion graphics y composición de forma programática**, conservando la libertad artística y la capacidad de sustituir cada pieza.

> FME no será una colección de programas: será un sistema común en el que las fuentes siguen editables, los motores son sustituibles y la IA puede dirigir el resultado por código o MCP.

## Estado actual

| Campo | Valor |
|---|---|
| Versión de la especificación | **0.1**: alcance funcional congelado (21-11-2026) |
| Fase | **Fase 0 (Especificar)**: repositorio preparado. Siguiente: **Fase 1 (Verificar software)** |
| Código ejecutable | Ninguno todavía. Solo existen los **contratos de tipos propuestos** (`packages/project`, `packages/connectors`) |
| Estado detallado | [`STATUS.md`](STATUS.md) |

**Ninguna funcionalidad se declara construida hasta superar sus pruebas** (ver [criterios de aceptación](docs/pruebas-aceptacion.md)).

## Qué es, en una imagen

```
                IA / USUARIO  (código · MCP · control manual)
                         │
          ┌──────────────┴──────────────┐
   MITAD A: Dirección artística   MITAD B: Proyecto universal
   (qué se busca)                 (qué existe: timeline, assets, capas)
          └──────────────┬──────────────┘
                         │
        ENRUTADOR INTELIGENTE  (el "módem")
        registro · tarjetas simple/avanzada · rutas · trabajos · validación
                         │
   ┌──────────┬──────────┼──────────┬──────────────────┐
 FreeCut    Revideo    Blender    más conectores (catálogo cerrado)
 edición    motion     3D/2D
            graphics   híbrido
```

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/README.md`](docs/README.md) | Índice general y mapa de la especificación |
| [`docs/roadmap.md`](docs/roadmap.md) | **Objetivos a corto, mediano y largo plazo** |
| [`docs/vision.md`](docs/vision.md) | Visión, objetivos de diseño, principios, técnicas y espectros |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Dos mitades + módem, modelo universal, enrutador, stack, render |
| [`docs/contratos.md`](docs/contratos.md) | Contrato de proyecto, contrato de conectores v0.1 y herramientas MCP |
| [`docs/catalogo-integraciones.md`](docs/catalogo-integraciones.md) | Herramientas candidatas y fuentes |
| [`docs/licencias-seguridad.md`](docs/licencias-seguridad.md) | Política comercial, licencias y seguridad |
| [`docs/pruebas-aceptacion.md`](docs/pruebas-aceptacion.md) | Prueba híbrida de 10 s y criterios de éxito |
| [`docs/riesgos.md`](docs/riesgos.md) | Riesgos, decisiones congeladas y aspectos por validar |
| [`docs/glosario.md`](docs/glosario.md) | Términos clave explicados |
| [`docs/memoria-y-registro.md`](docs/memoria-y-registro.md) | **Cómo se guarda la información** (memoria IA, ADR, bitácora, changelog) |
| [`docs/especificacion/`](docs/especificacion/) | PDF original de la especificación v0.1 (fuente de verdad) |

## Estructura del repositorio

```
fme/
  apps/                  # consola, UI, servidor MCP (vacío hasta la Fase 3+)
  packages/
    project/             # Mitad B: escenas, timeline, assets (tipos propuestos)
    art-direction/       # Mitad A: estilos, reglas, criterios
    connectors/          # contrato, registro, tarjetas (tipos propuestos)
    router/              # selector de rutas y trabajos
    adapters/            # freecut/, revideo/, blender/
  runtime/
    workers/             # procesos externos y ejecución
    cache/               # previsualizaciones y artefactos
  examples/
    prueba-hibrida-10s/  # primera prueba de integración (300 fotogramas a 30 FPS)
  docs/                  # decisiones, contratos, licencias, bitácora
  .forgex/memory.jsonl   # memoria persistente del proyecto para agentes IA (versionada)
```

La estructura es **orientativa** (spec §11.2) y no compromete ningún framework adicional.

## Desarrollo

Requisitos: **Node.js LTS** (^22.18 o ≥ 24.11) y **git**.

```bash
npm install
npm run typecheck   # comprueba que los contratos TypeScript compilan
```

### Memoria y herramientas para agentes IA (FORGEX Stack)

Este repositorio usa **FORGEX Stack**, del repo [Segundo-Cerebro-Code-Mode](https://github.com/getforgex-bit/Segundo-Cerebro-Code-Mode) (rama `develop`, carpeta `stack/`): un servidor MCP `forgex` (pctx en *Code Mode*) con memoria del proyecto y grafo de código (GitNexus). Cada persona debe ejecutar el setup **en su máquina**, porque los archivos de configuración llevan rutas absolutas y no se versionan. Instrucciones en [`docs/memoria-y-registro.md`](docs/memoria-y-registro.md).

## Contribuir

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) y [`AGENTS.md`](AGENTS.md) (este último aplica también a agentes IA).

## Licencia

Pendiente de definir (ver [ADR-0004](docs/decisiones/0004-licencia-pendiente.md)). Hasta entonces, el código es de uso interno de ForgeX. Las herramientas integradas conservan sus propias licencias (ver [`docs/licencias-seguridad.md`](docs/licencias-seguridad.md)).
