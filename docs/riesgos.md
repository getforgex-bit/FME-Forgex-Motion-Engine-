# Riesgos, decisiones congeladas y aspectos por validar

> Fuente: especificación v0.1, §21. Revisa esta página al cerrar cada fase.

## 1. Riesgos prioritarios

| Riesgo | Impacto | Mitigación inicial | Fase en la que se ataca |
|---|---|---|---|
| Sin API estable en el editor (FreeCut) | Integración profunda difícil | PoC con FreeCut **antes** de comprometer la interfaz | 1 |
| Distinta base temporal/alpha entre motores | Errores de composición | Contratos de formato y pruebas de exportación | 1–4 |
| Falta de VRAM (4 GB de referencia) | Previews lentas o fallos | Proxy, render por pases y caché | 7 |
| Licencias complejas | Distribución limitada | Auditar antes de empaquetar o modificar | Continuo |
| Calidad artesanal insuficiente | Resultado artificial | Estilos coherentes, revisión visual, iteraciones | 6 |
| Demasiados conectores | Mantenimiento costoso | Tres iniciales; el resto del catálogo, después | 3–8 |
| Ejecución arbitraria vía MCP | Riesgo de seguridad | Operaciones tipadas, permisos y aislamiento | 3+ |

### Riesgos añadidos al preparar el repositorio (POR VALIDAR)

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Mantenimiento activo de los proyectos upstream (FreeCut, Revideo) no confirmado para la versión que se fije | Integrar contra una base abandonada o inestable | En la Fase 1, revisar la actividad reciente, las releases y las issues abiertas antes de fijar versión |
| GitNexus (herramienta de desarrollo) es no comercial | Bloqueo para trabajo comercial | Migrar antes de cualquier uso comercial ([ADR-0003](decisiones/0003-forgex-stack-como-memoria.md)) |

## 2. Decisiones que quedan fijadas

Registradas formalmente en [ADR-0002](decisiones/0002-decisiones-congeladas-spec-v0.1.md):

1. Nombre del proyecto: **Forgex Motion Engine (FME)**.
2. Alcance de capacidades e integraciones: **congelado** tras la investigación realizada.
3. Núcleo con **dos mitades**: dirección artística y proyecto universal.
4. **Timeline** como estructura primaria.
5. Sistema de **conectores/registro dinámico** con dos tarjetas por herramienta.
6. Router con rutas **manuales, automáticas e híbridas**.
7. Operación para IA mediante **código y MCP sobre la misma API**.
8. **Cinco técnicas y dos gradientes** combinables y animables.
9. **Integrar primero**; forks graduales solo cuando se necesiten.
10. **FreeCut, Revideo y Blender** como cadena inicial de prueba.

## 3. Aspectos que siguen por validar

Ninguno se considera "resuelto" sin una prueba:

- APIs reales y grado de automatización de cada herramienta.
- Formatos de intercambio exactos.
- Estrategias de editabilidad.
- Licencias por versión/compilación.
- Benchmarks en la PC de referencia.
- Fidelidad de los pinceles entre motores.
- Garantías de color y alpha.
- Estabilidad de los conectores.
- Calendario realista de implementación.
