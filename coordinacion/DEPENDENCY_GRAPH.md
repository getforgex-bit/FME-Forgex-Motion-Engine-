# Grafo de dependencias de tareas

> Es el grafo de **planificación**. Las dependencias de **código** se consultan con CodeGraph y Graphify ([GRAPH_TOOLS.md](GRAPH_TOOLS.md)); sirven de evidencia para este grafo, pero no lo sustituyen.
> Una arista `A --> B` significa que B no puede pasar a READY hasta que A esté DONE (integrada en `develop`).

```mermaid
flowchart LR
  subgraph F0[Arranque]
    T001[001 docs FDN]; T002[002 carpeta operativa]; T003[003 tests/typecheck]; T006[006 worktrees]; T005[005 aprobar spec - usuario]
  end
  subgraph F1[Fase 1: verificar software]
    T010[010 Revideo]; T011[011 Blender]; T012[012 FreeCut]; T013[013 sonda ffprobe]; T014[014 cierre F1 #1]
  end
  subgraph F2[Fase 2: modelo universal]
    T020[020 ADR Zod]; T021[021 esquema+serialización]; T022[022 tiempo racional]; T023[023 fixtures+round-trip]; T024[024 migraciones]; T025[025 cierre F2 #2]
  end
  subgraph F3[Fase 3: conectores]
    T030[030 registro]; T031[031 ejecución aislada]; T032[032 adaptador Revideo]; T033[033 cierre F3]
  end
  subgraph F4[Fase 4: integración]
    T040[040 adaptador Blender]; T041[041 adaptador FreeCut]; T042[042 rutas A/B/C]; T043[043 cierre F4 #3]
  end
  subgraph F5[Fase 5: router]
    T050[050 núcleo router]; T051[051 medición tokens]; T052[052 fallbacks reales]; T053[053 cierre F5 #4 #5]
  end
  subgraph F6[Fase 6: dirección artística]
    T060[060 perfiles y reglas]; T061[061 gradientes→backend]; T062[062 cierre F6 #6]
  end
  subgraph F7[Fase 7: calidad]
    T070[070 caché]; T071[071 segmentos/preview]; T072[072 errores VRAM]; T073[073 suite técnica]; T074[074 export A/V]; T075[075 prueba híbrida #7 #8]
  end
  subgraph TR[Transversal]
    T080[080 MCP mínimo]; T081[081 CLI]; T082[082 licencias]; T004[004 benchmarks]
  end
  T003 --> T010 & T013 & T021 & T022 & T030 & T031
  T010 & T011 & T012 --> T014
  T013 -.mejora.-> T014
  T020 --> T021 --> T023 & T024
  T022 --> T023
  T023 & T024 --> T025
  T010 & T021 & T030 & T031 --> T032 --> T033
  T011 & T030 & T031 --> T040
  T012 & T030 & T031 --> T041
  T021 & T032 & T040 & T041 --> T042 --> T043
  T030 --> T050 --> T051
  T050 & T043 --> T052 --> T053
  T021 --> T060
  T060 & T032 & T040 --> T061 --> T062
  T021 & T031 --> T070 --> T071 & T072
  T043 & T062 & T071 & T072 --> T073 & T074 --> T075
  T021 & T030 & T050 --> T080
  T080 --> T081
```

## Paralelismo real

| Momento | Pueden ir en paralelo | Barrera |
|---|---|---|
| Tanda 1 | 004, 010, 011, 012, 021, 022, 030 (rutas disjuntas) | ninguna |
| Tanda 2 | 013, 023, 024, 031, 050 (con tarjetas simuladas), 014 | 014 espera a 010, 011 y 012 |
| Tanda 3 | 032, 040, 041, 060 | 032, 040 y 041 esperan a 031 + 030 + su verificación de la F1 |
| Tanda 4+ | 042, 051, 061, 070, 080 | 042 es una **integración conjunta** (barrera) |

Ruta crítica estimada: 003 → 031 → 032 → 042 → 043 → 052 / 073 → 075.
