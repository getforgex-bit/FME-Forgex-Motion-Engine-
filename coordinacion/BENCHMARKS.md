# Benchmarks por modelo

> **Estado: POR VALIDAR.** Las cifras de abajo son los datos iniciales que dio el usuario. FDN-004 (A3) las contrasta con las fuentes oficiales.
> Los benchmarks **orientan**; no establecen jerarquías universales. La asignación se valida con métricas reales ([AGENT_PERFORMANCE.md](AGENT_PERFORMANCE.md)).

## Fuentes oficiales a consultar
- https://www.anthropic.com/claude-opus-5-5 · https://www.anthropic.com/claude-sonnet-5-5 · https://www.anthropic.com/claude-haiku-5-5
- https://deepmind.google/models/model-cards/gemini-4-neon/ · https://deepmind.google/models/model-cards/gemini-4-hydrogen/
- https://openai.com/index/introducing-gpt-6-2-astra-sol/

## Datos iniciales (sin verificar)

**Terminal-Bench 4.0**: Opus 5.5 66,4 % · Sonnet 5.5 70,6 % · Haiku 5.5 39,2 %
**Terminal-Bench 4.1**: Opus 5.5 65,8 % · Gemini 4 Neon 65,2 % · GPT-6.2 Sol 61,5 % · Gemini 4 Hydrogen 57,0 %

⚠ **No se comparan las versiones 4.0 y 4.1 entre sí** (tareas y arnés distintos). Dentro de cada versión, diferencias de 1–2 puntos están probablemente dentro del ruido del arnés y la configuración (POR VALIDAR).

## Plantilla por benchmark (FDN-004 rellena una por cada uno)

Benchmarks: Terminal-Bench 4.0 y 4.1, FrontierCode, CursorBench, SWE-bench (y SWE-sweep, si existe con ese nombre), OSWorld, AutomationBench, Agents' Last Exam y Humanity's Last Exam.

```
### <Benchmark> <versión>
1. Qué mide:
2. Cómo se evalúa (arnés, agente, intentos, tiempo):
3. Qué significa la puntuación:
4. Qué NO permite concluir:
5. Versión y configuración (esfuerzo de razonamiento, herramientas, scaffold):
6. Resultados por modelo: | Modelo | Puntuación | Configuración |
7. Fuente (URL) y fecha de consulta:
8. Limitaciones de comparabilidad:
9. Consecuencias prácticas para la asignación en FDN:
```

## Lectura provisional para asignar (hasta tener datos)
- Sonnet 5.5 rinde en terminal igual o mejor que Opus en TB 4.0 → A1 y A2 hacen la implementación con terminal; A0 se reserva para arquitectura, revisión e integración.
- Haiku 5.5 queda claramente por debajo en terminal → solo tareas acotadas: investigación y resumen, scripts sencillos y comprobaciones mecánicas.
- Neon y Opus están próximos en TB 4.1; Hydrogen y Sol algo por debajo → no hay base para relegar a ningún equipo. La asignación se decide por herramientas (navegador, terminal, Python) y por contexto previo.
