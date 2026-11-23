# Benchmarks por modelo

> **Estado: VERIFICADO PARCIAL (FDN-004, A3, consultas del 2026-11-22).** Cada cifra lleva su fuente y su fecha de consulta. Lo que no aparece en una fuente oficial figura como **no publicado** o **no visible**; no se ha inferido ninguna cifra.
> Los benchmarks **orientan**; no establecen jerarquías universales. La asignación se valida con métricas reales ([AGENT_PERFORMANCE.md](AGENT_PERFORMANCE.md)).

## Leyenda

- **VERIFICADO (oficial):** leído en una página del fabricante u organizador del benchmark.
- **VERIFICADO (tercero):** leído en un leaderboard independiente o en una página del organizador que no es el fabricante del modelo.
- **POR VALIDAR:** fuentes que se contradicen, definición incompleta o cifra que solo aparece en un buscador.
- **no publicado / no visible:** la fuente consultada no contiene el dato (o no se pudo leer, p. ej. tablas renderizadas como imagen o JavaScript).

## 0. Fuentes consultadas

Fecha de consulta de todas: **2026-11-22**. Fecha de publicación indicada en cada página entre paréntesis.

**Fabricantes (oficiales)**
- Anthropic, Claude Opus 5.5: https://www.anthropic.com/research/claude-opus-5-5 (22-09-2026). *La URL inicial `anthropic.com/claude-opus-5-5` no fue la que se leyó; la página vigente está bajo `/research/`.*
- Anthropic, Claude Sonnet 5.5: https://www.anthropic.com/research/claude-sonnet-5-5 (28-09-2026).
- Anthropic, Claude Haiku 5.5: https://www.anthropic.com/research/claude-haiku-5-5 (07-10-2026).
- Google DeepMind, Gemini 4 Neon: https://deepmind.google/models/model-cards/gemini-4-neon/ (publicada el 18-11-2026).
- Google DeepMind, Gemini 4 Hydrogen: https://deepmind.google/models/model-cards/gemini-4-hydrogen/ (publicada el 12-11-2026). *Existe; la búsqueda inicial no lo encontró, la página sí.*
- OpenAI, GPT-6.2 Astra y Sol: https://openai.com/index/introducing-gpt-6-2-astra-sol/ (sin fecha en la página). **Sin tablas numéricas en el texto**: los gráficos son imágenes. Las cifras de GPT-6.2 Sol que aparecen abajo no proceden de esta página.

**Organizadores de benchmark**
- Terminal-Bench 4.0: https://www.tbench.ai/news/terminal-bench-4-0 (28-08-2026, según el índice de noticias).
- Terminal-Bench 4.1: https://snorkel.ai/resources/terminal-bench-4-1-hardens-the-verifiers-behind-the-scores/ (09-11-2026); índice de noticias https://www.tbench.ai/news (entrada «Terminal-Bench 4.1», 09-11-2026; la página individual no se leyó).
- Leaderboards de Terminal-Bench (Snorkel AI, socio de alojamiento): https://snorkel.ai/leaderboard/terminal-bench/ (4.1) y https://snorkel.ai/leaderboard/terminal-bench-4-0/ (4.0).
- CursorBench: https://cursor.com/evals (changelog «CursorBench 4.1», 18-11-2026); https://cursor.com/blog/cursorbench (11-03-2026, describe la versión 3.x).
- FrontierCode: https://cognition.com/blog/frontier-code (08-06-2026; `cognition.ai` redirige con 301); https://artificialanalysis.ai/articles/frontiercode (12-10-2026).
- OSWorld: https://osworld-v2.xlang.ai/ (sin fecha; paper arXiv 2606.29537).
- AutomationBench: https://zapier.com/benchmarks (versión 1.0.6); https://arxiv.org/abs/2604.18934 (21-04-2026). El informe de GPT-6.2 Sol en Zapier devolvió 404.
- Agents' Last Exam: https://arxiv.org/abs/2606.05405 (v1 03-06-2026; v4 25-10-2026); https://agents-last-exam.org/ (la tabla del leaderboard no tenía filas visibles).
- Humanity's Last Exam: https://agi.safe.ai/blog/hle-diamond (22-09-2026); https://artificialanalysis.ai/evaluations/humanitys-last-exam (sin fecha; las filas de nuestros modelos no eran visibles).
- SWE-bench: https://www.swebench.com (la lectura quedó truncada; los leaderboards no renderizaron).

**Fuentes no usadas como cifra.** Agregadores (llm-stats, vals.ai, morphllm, developersdigest, Mercor, anotherwrapper, mixed-news, Decrypt y similares) aparecieron en búsquedas. Se descartan como dato porque contradicen entre sí o a la fuente primaria, o porque no se pudo leer su método. Ejemplos descartados: «SWE-bench Pro 89,9 % Opus 5.5» (llm-stats), «SWE-bench Verified 97 %» (vals.ai), «Agents' Last Exam 0,527 GPT-5.6 Sol» (llm-stats).

## 1. Contraste con los datos iniciales (POR VALIDAR → resultado)

| Dato inicial | Fuente primaria o leaderboard consultado | Resultado |
|---|---|---|
| TB 4.0 · Opus 5.5 66,4 % | Anthropic (22-09): 66,4 % (nota 1: **xhigh**; error estándar ±2,6) | **VERIFICADO (oficial)**, con matiz de esfuerzo. Snorkel 4.0 da 64,8 % ±3,1 (max, Claude Code). |
| TB 4.0 · Sonnet 5.5 70,6 % | Anthropic (28-09): 70,6 % | **VERIFICADO (oficial)**, solo autorreporte. Snorkel 4.0 da 61,8 % ±2,9 (max). |
| TB 4.0 · Haiku 5.5 39,2 % | Anthropic (07-10): 39,2 % | **VERIFICADO (oficial)**, solo autorreporte. Haiku no aparece en el top-10 de Snorkel 4.0. |
| TB 4.1 · Opus 5.5 65,8 % | Snorkel 4.1 (consulta 22-11): 65,8 % ±3,1 (max, Claude Code) | **VERIFICADO (tercero)**. |
| TB 4.1 · Gemini 4 Neon 65,2 % | Google DeepMind, tabla Neon (18-11): 65,2 % («cheating-adjusted accuracy») | **VERIFICADO (oficial)**, con etiqueta de métrica distinta. |
| TB 4.1 · GPT-6.2 Sol 61,5 % | Snorkel 4.1: 61,5 % ±2,8 (max, Codex) | **VERIFICADO (tercero)**. |
| TB 4.1 · Gemini 4 Hydrogen 57,0 % | Google DeepMind, tabla Hydrogen (12-11): 57,0 % («cheating-adjusted») | **VERIFICADO (oficial)**, con etiqueta de métrica distinta. |
| Lectura: «Sonnet 5.5 rinde igual o mejor que Opus en terminal (TB 4.0)» | Ver filas de Sonnet y Opus arriba | **Contradicho por el leaderboard independiente.** En 4.0 el autorreporte da Sonnet > Opus, pero Snorkel da Opus 64,8 > Sonnet 61,8. En 4.1, Opus 65,8 > Sonnet 63,9, dentro del ruido. **No hay base para afirmar que Sonnet ≥ Opus.** |
| Lectura: «Neon y Opus próximos en TB 4.1» | 65,2 vs 65,8 | **Confirmado.** |
| Lectura: «Hydrogen y Sol algo por debajo» | 57,0 vs 61,5 | **Consistente** con las fuentes, aunque Hydrogen también queda por debajo de Sonnet 5.5 (63,9) en la tabla de Google. |
| Lectura: «Haiku claramente por debajo en terminal» | TB 4.0: 39,2 vs 66,4 (autorreporte) | **Confirmado solo en TB 4.0 autorreportado.** En CursorBench 4.1 la brecha es menor (48,4 vs 54,4 en Max). |

**Discrepancia que A0 debe tener presente:** la lectura inicial trataba como dato de terminal lo que en realidad mezcla **esfuerzos distintos** (Anthropic usa xhigh para Opus en TB 4.0; Snorkel usa max).

## 2. Plantilla por benchmark

### 2.1 Terminal-Bench 4.0

1. **Qué mide:** agentes de terminal en tareas de ingeniería de software y sistemas. Cada tarea tiene instrucción, entorno y un verificador que devuelve recompensa (tbench.ai, 4.0).
2. **Cómo se evalúa:** arnés Harbor (`harbor run -d terminal-bench/terminal-bench@4.0.0`); 66 tareas; timeout de agente de 8 h por tarea. Intentos por modelo: no visible en la página del tbench; Anthropic indica «5 trials/task» solo para su reproducción pública de Opus 5 (nota 1). Agente: Claude Code (Anthropic, Snorkel), Codex (OpenAI en Snorkel).
3. **Qué significa la puntuación:** porcentaje de las 66 tareas resueltas, con margen ± por variabilidad entre ejecuciones.
4. **Qué NO permite concluir:** diferencias de 1–3 puntos (los márgenes publicados son de ±2,6 a ±3,1). Tampoco permite comparar modelos sin tener en cuenta el agente (Claude Code frente a Codex) y el esfuerzo.
5. **Versión y configuración:** tbench 4.0.0. Opus 5.5 xhigh (Anthropic) frente a max (Snorkel). Esfuerzo de Sonnet 5.5 y Haiku 5.5: no indicado en las páginas de Anthropic.
6. **Resultados por modelo:**

| Modelo | Puntuación | Configuración | Fuente y fecha |
|---|---|---|---|
| Claude Opus 5.5 | 66,4 % | xhigh, autorreporte (±2,6) | Anthropic, 22-09-2026, nota 1 |
| Claude Opus 5.5 | 64,8 % ±3,1 | max, Claude Code | Snorkel 4.0, consulta 22-11-2026 |
| Claude Sonnet 5.5 | 70,6 % | no indicado, autorreporte | Anthropic, 28-09-2026 |
| Claude Sonnet 5.5 | 61,8 % ±2,9 | max, Claude Code | Snorkel 4.0, consulta 22-11-2026 |
| Claude Haiku 5.5 | 39,2 % | no indicado, autorreporte | Anthropic, 07-10-2026 |
| Claude Haiku 5.5 | no visible (fuera del top-10) | — | Snorkel 4.0, consulta 22-11-2026 |
| GPT-6 Astra | 57,9 % | high, «as reported by OpenAI» | Anthropic, 22-09-2026, nota 1 |
| GPT-6.1 Sol | 58,2 % ±3,1 | max, Codex | Snorkel 4.0, consulta 22-11-2026 |
| GPT-6.2 Sol | no publicado | — | OpenAI no publica tabla numérica; no aparece en Snorkel 4.0 |
| GPT-5.6 Sol | 37,3 % | no indicado | Anthropic, 22-09-2026 |

7. **Fuente y fecha de consulta:** tbench.ai/news/terminal-bench-4-0 (28-08-2026); Snorkel 4.0 (consulta 22-11-2026); páginas de Anthropic indicadas arriba.
8. **Limitaciones de comparabilidad:** mezcla de autorreporte (Anthropic) y leaderboard independiente (Snorkel), con esfuerzos distintos. Las fuentes no coinciden en el número de tareas revisadas (19 en el artículo del tbench; 20 en la página del leaderboard de Snorkel). No comparable con 4.1.
9. **Consecuencias para FDN:** en 4.0 el orden entre Opus 5.5 y Sonnet 5.5 depende de la fuente, así que **no sirve para asignar** implementación frente a arquitectura. Haiku 5.5 queda por debajo en el autorreporte de 4.0 (≈27 puntos menos que Opus), lo que apoya tareas acotadas. Opus 5.5 es el que mejor sostiene el resultado en el leaderboard independiente.

### 2.2 Terminal-Bench 4.1

1. **Qué mide:** las mismas 66 tareas de 4.0, **todas modificadas** (verificadores corregidos, protección frente a reward hacking con RewardKit Workers, imágenes fijadas por digest). Añade un conjunto CPU-only de 63 tareas (Snorkel, 09-11-2026).
2. **Cómo se evalúa:** `harbor run -d terminal-bench/terminal-bench@4.1.0`. Los resultados del leaderboard 4.1 son reevaluaciones de envíos de 4.0 con los verificadores de 4.1; alrededor del 1 % de las recompensas cambió. Intentos por tarea: no visibles.
3. **Qué significa la puntuación:** porcentaje de resolución (Snorkel: «resolution rate»). Google la llama «cheating-adjusted accuracy» en sus tablas. **Son etiquetas distintas; no sabemos si la métrica es idéntica.**
4. **Qué NO permite concluir:** no es comparable con 4.0 (tareas modificadas y verificadores distintos; las propias fuentes lo advierten). Las cifras del leaderboard cambian: el artículo del 09-11 listaba 23 configuraciones con Opus 5.5 (65,8 %) arriba; el leaderboard consultado el 22-11 lista 53 entradas con Copilot Fusion (71,2 %) arriba. Un agente comercial de terceros no es un modelo y no se usa para la asignación.
5. **Versión y configuración:** 4.1.0. Opus 5.5 y Sonnet 5.5 con max en Claude Code; GPT-6.2 Sol y Astra con max en Codex; Gemini 4 Carbon con high en Antigravity CLI. **En las tablas de Google DeepMind el esfuerzo no se indica por fila.**
6. **Resultados por modelo:**

| Modelo | Puntuación | Configuración | Fuente y fecha |
|---|---|---|---|
| Claude Opus 5.5 | 65,8 % ±3,1 | max, Claude Code | Snorkel 4.1, consulta 22-11-2026 |
| Gemini 4 Neon | 65,2 % | cheating-adjusted; config. no indicada | Google DeepMind, 18-11-2026 |
| Claude Sonnet 5.5 | 63,9 % ±3,0 | max, Claude Code | Snorkel 4.1, consulta 22-11-2026 |
| Claude Sonnet 5.5 | 63,9 % | cheating-adjusted; config. no indicada | Google DeepMind (tabla Hydrogen), 12-11-2026 |
| GPT-6.2 Astra | 62,1 % ±2,3 | max, Codex | Snorkel 4.1, consulta 22-11-2026 |
| GPT-6.2 Sol | 61,5 % ±2,8 | max, Codex | Snorkel 4.1, consulta 22-11-2026 |
| Gemini 4 Carbon | 64,5 % ±3,2 | high, Antigravity CLI | Snorkel 4.1, consulta 22-11-2026 |
| Gemini 4 Hydrogen | 57,0 % | cheating-adjusted; config. no indicada | Google DeepMind, 12-11-2026 |
| Claude Haiku 5.5 | no publicado | — | Ni Anthropic ni Snorkel 4.1 (en la consulta) lo muestran |

7. **Fuente y fecha de consulta:** Snorkel, artículo de 09-11-2026 y leaderboard consultado el 22-11-2026; tabla de Google DeepMind (Neon 18-11, Hydrogen 12-11); tbench.ai/news (índice).
8. **Limitaciones de comparabilidad:** diferencia de etiqueta de métrica entre Snorkel y Google; las tablas de Google no declaran esfuerzo; el leaderboard cambió entre el artículo y la consulta; Snorkel es socio de alojamiento del benchmark.
9. **Consecuencias para FDN:** Opus 5.5 y Gemini 4 Neon están **empatados dentro del ruido** (65,8 vs 65,2). Sonnet 5.5 queda a 1,9 puntos de Opus, también dentro del ruido. Sol y Astra van cerca. **La lectura de 4.1 contradice la idea de que Sonnet rinde mejor en terminal**: en 4.1 Opus está por encima, aunque sea por poco.

### 2.3 FrontierCode

Hay tres variantes que **no son comparables** entre sí: **1.1 Main** (100 tareas más difíciles), **1.1 Extended** (150) y **1.1 Diamond** (50). **2.0** es un benchmark privado de Cognition.

1. **Qué mide:** si el parche de un agente a un issue real de código abierto sería aceptado por los mantenedores, no solo si pasa tests. Hay 36 repositorios y más de 40 horas de trabajo de mantenedores por tarea (Cognition, 08-06-2026).
2. **Cómo se evalúa:** criterios bloqueantes y una rúbrica ponderada; si falla un bloqueante, la puntuación es 0. Cognition ejecuta cada modelo 5 veces por nivel de esfuerzo y publica el mejor nivel. Artificial Analysis (12-10-2026) usa 100 tareas Main, 3 intentos, arnés Stirrup con tope de 250 turnos, un juez LLM (GPT-6 Luna, medium) y pondera por tarea.
3. **Qué significa la puntuación:** porcentaje ponderado de la rúbrica; 0 si no se cumple algún bloqueante.
4. **Qué NO permite concluir:** comparar 1.1 con 2.0; comparar cifras de Anthropic con las de Artificial Analysis (arneses y jueces distintos); comparar Main con Extended.
5. **Versión y configuración:** Anthropic usa max en la tabla, pero en el texto da cifras de medium (Opus 5.5: 54,6 % frente a 54,4 %). Sonnet 5.5: 46,2 % en max frente a 52,1 % en xhigh; Anthropic atribuye la diferencia a subagentes de revisión que penalizan los cambios fuera de alcance. Artificial Analysis usa max con fallback.
6. **Resultados por modelo:**

| Modelo | Puntuación | Variante y configuración | Fuente y fecha |
|---|---|---|---|
| Claude Opus 5.5 | 54,4 % | 1.1 Main; max (tabla) | Anthropic, 22-09-2026 |
| Claude Sonnet 5.5 | 46,2 % / 52,1 % | 1.1 Main; max / xhigh | Anthropic, 28-09-2026 |
| Claude Haiku 5.5 | 46,4 % | 1.1 Main; config. no indicada | Anthropic, 07-10-2026 |
| GPT-6 Astra | 53,3 % | 1.1 Main; config. no indicada | Anthropic, 22-09-2026 |
| GPT-6 Sol (sic) | 49,3 % | 1.1 Main; config. no indicada | Anthropic, 28-09-2026 (la página escribe «GPT-6 Sol») |
| GPT-5.6 Sol | 47,5 % | 1.1 Main | Anthropic, 22-09-2026 |
| Claude Opus 5.5 | 52 % (tasa de aprobados 58 %) | 1.1 Main; max con fallback; Stirrup | Artificial Analysis, 12-10-2026 |
| GPT-6.1 Sol | 49 % | 1.1 Main; max | Artificial Analysis, 12-10-2026 |
| Claude Sonnet 5.5 | no visible | 1.1 Main; max con fallback (solo coste: 8,26 $/tarea) | Artificial Analysis, 12-10-2026 |
| GPT-6.2 Sol | no publicado en 1.1 | — | OpenAI: «dentro de 0,5 puntos de Astra» con max, sin cifra absoluta |
| Gemini 4 Neon | 46,2 % | **2.0** Main | Google DeepMind, 18-11-2026 |
| Claude Opus 5.5 | 47,3 % | **2.0** Main | Google DeepMind (tabla Neon), 18-11-2026 |
| GPT-6.2 Sol | 43,8 % | **2.0** Main | Google DeepMind (tabla Neon), 18-11-2026 |
| Gemini 4 Hydrogen | no publicado | — | Sin fila en la tabla de Hydrogen |

7. **Fuente y fecha de consulta:** cognition.com/blog/frontier-code (08-06-2026); artificialanalysis.ai/articles/frontiercode (12-10-2026); Anthropic (22-09, 28-09, 07-10-2026); Google DeepMind (18-11 y 12-11-2026); OpenAI (sin fecha).
8. **Limitaciones:** la cifra de 2.0 de Google (Opus 47,3) **no** es la de 1.1 de Anthropic (54,4); la tabla de Google no indica qué variante es «Main» en 2.0. El nombre del modelo cambia entre fuentes (GPT-6 Sol, GPT-6.1 Sol, GPT-6.2 Sol). No se pudo leer el leaderboard de Cognition, que las páginas agregadoras citan con cifras distintas.
9. **Consecuencias para FDN:** en 1.1 Main, Opus 5.5 supera a Sonnet 5.5 en max (54,4 frente a 46,2) y se acerca en xhigh (52,1). Para tareas de «código que se pueda fusionar», el esfuerzo y el control del alcance pesan tanto como el modelo; conviene especificar el esfuerzo y evitar que el agente lance revisiones en subagentes sin necesidad.

### 2.4 CursorBench

1. **Qué mide:** tareas ambiguas y de varios archivos tomadas de sesiones reales de Cursor, vinculadas al código comprometido mediante «Cursor Blame». El leaderboard muestra corrección, coste medio por tarea, tokens y pasos (cursor.com/evals). El blog habla de corrección, calidad de código, eficiencia y comportamiento en la interacción.
2. **Cómo se evalúa:** calificadores agénticos. El coste por tarea se calcula con los precios publicados de cada modelo. La página advierte de que las diferencias pequeñas pueden no ser estadísticamente significativas. Intentos, arnés y criterios exactos: no publicados en la página leída.
3. **Qué significa la puntuación:** porcentaje de corrección.
4. **Qué NO permite concluir:** comparar versiones 3.1, 4.0 y 4.1 entre sí. Es una suite del propio fabricante de la herramienta (Cursor), lo que conviene tener en cuenta al usarla para decidir. No hay intervalos de confianza publicados.
5. **Versión y configuración:** el esfuerzo va en el nombre del modelo (Max, Extra High, High, Medium, Low, Minimal). Versión vigente: 4.1 (changelog del 18-11-2026: «instrucciones modificadas… tiempo de agente aumentado»).
6. **Resultados por modelo (CursorBench 4.1, consulta 22-11-2026):**

| Modelo | Puntuación | Configuración | Coste medio por tarea |
|---|---|---|---|
| Gemini 4 Neon | 65,4 % | Extra High | 10,67 $ |
| Gemini 4 Neon | 63,7 % | High | 6,54 $ |
| Gemini 4 Neon | 57,7 % | Medium | 3,07 $ |
| Gemini 4 Hydrogen | 61,4 % | Extra High | 8,09 $ |
| Gemini 4 Hydrogen | 57,3 % | High | 4,57 $ |
| Claude Opus 5.5 | 58,1 % | Max | 11,88 $ |
| Claude Opus 5.5 | 56,7 % | Extra High | 6,54 $ |
| Claude Opus 5.5 | 54,5 % | High | 3,87 $ |
| Claude Sonnet 5.5 | 54,4 % | Max | 8,63 $ |
| Claude Sonnet 5.5 | 49,9 % | Extra High | 3,13 $ |
| Claude Sonnet 5.5 | 43,8 % | High | 1,41 $ |
| Claude Haiku 5.5 | 48,4 % | Max | 1,14 $ |
| Claude Haiku 5.5 | 45,2 % | Extra High | 0,56 $ |
| GPT-5.6 Sol | 40,9 % | Max | 7,60 $ |
| GPT-6.2 Sol | no publicado | — | No aparece en el leaderboard |

   Referencia de la versión 4.0 en la página de Anthropic (22-09 y 28-09-2026): Opus 5.5 57,8 % (tabla, max); Sonnet 5.5 55,5 %; Haiku 5.5 no publicado; GPT-5.6 Sol 41,7 %. Los valores 4.0 y 4.1 **no se mezclan**.

7. **Fuente y fecha de consulta:** cursor.com/evals (consulta 22-11-2026, changelog del 18-11-2026); cursor.com/blog/cursorbench (11-03-2026); Anthropic (22-09 y 28-09-2026).
8. **Limitaciones:** versiones distintas en las fuentes (3.1 en el blog, 4.0 y 4.1 en la web); el leaderboard se renderiza por JavaScript y solo se pudo leer su tabla de texto; la suite pertenece al fabricante de una de las herramientas evaluadas.
9. **Consecuencias para FDN:** Haiku 5.5 (Max, 48,4 %) cuesta unas siete veces menos que Sonnet 5.5 en Max (1,14 $ frente a 8,63 $ por tarea), con 6 puntos de diferencia. Es un dato útil para tareas acotadas. Opus 5.5 frente a Sonnet 5.5 en Max (58,1 frente a 54,4) es una diferencia pequeña y sin intervalo publicado: **POR VALIDAR** antes de decidir con ella.

### 2.5 SWE-bench (y «SWE-sweep»)

1. **Qué mide:** SWE-bench es la familia de benchmarks de issues de GitHub. El sitio oficial lista Verified, Multilingual, Multimodal, Lite y Full (swebench.com, lectura parcial). **«SWE-sweep» no aparece en swebench.com** ni en las fuentes de Anthropic u OpenAI; sí aparece en las tablas de Google DeepMind (Neon y Hydrogen). **Su definición no está publicada en las fuentes consultadas.**
2. **Cómo se evalúa:** no visible en swebench.com. Google distingue dos arneses para SWE-sweep: *provider harness* y *Mini-SWE harness*.
3. **Qué significa la puntuación:** porcentaje (Google).
4. **Qué NO permite concluir:** no permite equiparar SWE-sweep con SWE-bench Verified o Pro. Sin definición, tampoco se puede concluir nada sobre la capacidad de un modelo en parches a repositorios.
5. **Versión y configuración:** las tablas de Google no indican esfuerzo ni versión.
6. **Resultados por modelo (solo SWE-sweep, según Google):**

| Modelo | Puntuación | Arnés | Fuente y fecha |
|---|---|---|---|
| Gemini 4 Neon | 39,0 % | provider harness | Google DeepMind, 18-11-2026 |
| Gemini 4 Neon | 12,8 % | Mini-SWE harness | Google DeepMind, 18-11-2026 |
| Gemini 4 Hydrogen | 13,5 % | no indicado | Google DeepMind, 12-11-2026 |
| GPT-6.2 Sol | 8,3 % | provider harness | Google DeepMind, 18-11-2026 |
| GPT-6.2 Sol | 11,6 % | Mini-SWE harness | Google DeepMind, 18-11-2026 |
| Claude Opus 5.5 | 10,1 % | provider harness | Google DeepMind, 18-11-2026 |
| Claude Opus 5.5 | 3,6 % | Mini-SWE harness | Google DeepMind, 18-11-2026 |
| Claude Sonnet 5.5 | 3,1 % | no indicado | Google DeepMind (tabla Hydrogen), 12-11-2026 |
| GPT-6.1 Terra | 5,8 % | no indicado | Google DeepMind (tabla Hydrogen), 12-11-2026 |
| Claude Haiku 5.5 | no publicado | — | Sin fila |

   **SWE-bench Verified y Pro para Opus, Sonnet y Haiku 5.5:** **no publicado** en las páginas oficiales de Anthropic (no tienen fila SWE-bench). Las cifras de agregadores son contradictorias y se descartan (ver sección 0).

7. **Fuente y fecha de consulta:** Google DeepMind (18-11 y 12-11-2026); swebench.com (consulta 22-11-2026, lectura parcial); páginas de Anthropic.
8. **Limitaciones:** un único proveedor (Google) publica SWE-sweep, con arneses propios y sin definición pública verificada. Los valores de Opus 5.5 (10,1 %) y Neon (39,0 %) difieren en un orden de magnitud; no se puede saber si refleja capacidad o el arnés.
9. **Consecuencias para FDN:** **no asignar tareas por SWE-bench ni SWE-sweep** hasta tener la definición y el arnés. Para tareas de parches sobre repositorios reales, la referencia oficial disponible es FrontierCode (sección 2.3).

### 2.6 OSWorld

1. **Qué mide:** uso de un ordenador en tareas largas y reales: 108 tareas, 31 sitios web alojados por los autores, la mayoría de ellas de más de una hora para una persona (osworld-v2.xlang.ai). **Anthropic y Google usan «OSWorld 2.1»**, pero la página consultada describe la versión **2.0**: la diferencia entre 2.0 y 2.1 no está documentada en las fuentes leídas.
2. **Cómo se evalúa:** la métrica principal es la completación binaria a 500 pasos; también se publica una puntuación parcial. Arnés, intentos y esfuerzo: no visibles para nuestros modelos.
3. **Qué significa la puntuación:** Anthropic publica «partial»; Google publica «offline subset». No se conoce la definición exacta de «offline subset».
4. **Qué NO permite concluir:** comparar partial con offline subset; comparar 2.0 con 2.1; comparar Haiku con Sonnet a partir de cifras de métricas distintas.
5. **Versión y configuración:** Anthropic indica en una nota general que sus resultados de Opus 5.5 usan max salvo que se diga otra cosa; no se señala una excepción para OSWorld.
6. **Resultados por modelo:**

| Modelo | Puntuación | Métrica | Fuente y fecha |
|---|---|---|---|
| Claude Opus 5.5 | 81,8 % | partial, OSWorld 2.1 | Anthropic, 22-09-2026 |
| Claude Sonnet 5.5 | 80,1 % | partial, OSWorld 2.1 | Anthropic, 28-09-2026 |
| Claude Haiku 5.5 | 72,4 % | offline subset, OSWorld 2.1 | Anthropic, 07-10-2026 |
| Gemini 4 Hydrogen | 77,6 % | offline subset, OSWorld 2.1 | Google DeepMind, 12-11-2026 |
| Claude Sonnet 5.5 | 83,9 % | offline subset, OSWorld 2.1 | Google DeepMind (tabla Hydrogen), 12-11-2026 |
| GPT-6.2 Sol | no publicado | — | OpenAI sin cifras |
| Gemini 4 Neon | no publicado | — | Sin fila OSWorld en la tabla de Neon |

7. **Fuente y fecha de consulta:** osworld-v2.xlang.ai (consulta 22-11-2026); Anthropic (22-09, 28-09, 07-10-2026); Google DeepMind (12-11-2026).
8. **Limitaciones:** **Sonnet 5.5 aparece con dos cifras distintas (80,1 % partial en Anthropic; 83,9 % offline subset en Google)**; no son comparables y ninguna se contradice sin conocer la métrica. Sin tabla oficial de leaderboard consultable para estos modelos.
9. **Consecuencias para FDN:** no hay base para asignar por OSWorld entre Haiku y Sonnet (métricas distintas) ni entre Opus y Sonnet (diferencia de 1,7 puntos en partial, dentro del ruido). Para control de ordenador, OSWorld no es un criterio de asignación todavía.

### 2.7 AutomationBench

1. **Qué mide:** flujos de negocio que cruzan varias aplicaciones a través de APIs REST: 47 apps simuladas, seis dominios (ventas, marketing, operaciones, soporte, finanzas, RR. HH.) y más de 600 tareas de evaluación (zapier.com/benchmarks; arXiv 2604.18934, 21-04-2026).
2. **Cómo se evalúa:** el agente trabaja solo, sin preguntas aclaratorias; herramientas `search` (BM25 sobre esquemas de API, top 5) y `execute`; hasta 50 pasos. Calificación determinista por aserciones de estado final, sin juez LLM. Métrica principal: `task_completed_correctly`. Variación entre ejecuciones: típicamente por debajo del 1 %. Intentos: no visibles.
3. **Qué significa la puntuación:** porcentaje de tareas completadas correctamente (versión 1.0.6).
4. **Qué NO permite concluir:** comparar «AutomationBench 1.0.6» (Zapier, cifras de Google para Neon y de Anthropic) con «AutomationBench-AA» (Artificial Analysis, subconjunto privado de 657 tareas, que usa Google en la tabla de Hydrogen). **Son variantes distintas y Google presenta cifras de las dos.** En las evaluaciones de Anthropic (Opus 5.5, según la nota 2), las negativas del modelo cuentan como fallo, porque no hay modelos de respaldo; eso baja la cifra por debajo de lo que el modelo lograría en la práctica.
5. **Versión y configuración:** el leaderboard de Zapier indica el esfuerzo en el nombre (XHigh, High, Medium). Opus 5.5: cifra de la evaluación de acceso anticipado de Zapier. Sonnet 5.5 y Haiku 5.5: no aparecen en la página de Anthropic ni en la parte visible del top-10 de Zapier.
6. **Resultados por modelo:**

| Modelo | Puntuación | Variante y configuración | Fuente y fecha |
|---|---|---|---|
| Gemini 4 Neon | 56,32 % | 1.0.6; XHigh | Zapier, consulta 22-11-2026; Google, 18-11-2026 (56,3 %) |
| Gemini 4 Neon | 54,34 % | 1.0.6; High | Zapier, consulta 22-11-2026 |
| Gemini 4 Neon | 53,27 % | 1.0.6; Medium | Zapier, consulta 22-11-2026 |
| Gemini 4 Hydrogen | 51,14 % | 1.0.6; High | Zapier, consulta 22-11-2026 |
| Gemini 4 Hydrogen | 76,1 % | AutomationBench-AA (variante distinta) | Google, 12-11-2026 |
| Claude Sonnet 5.5 | 71,8 % | AutomationBench-AA (variante distinta) | Google (tabla Hydrogen), 12-11-2026 |
| GPT-6 Astra | 41,4 % | no indicado (cifra de Zapier, según Anthropic) | Anthropic, 22-09-2026 |
| Claude Opus 5.5 | 40,0 % | 1.0.6; acceso anticipado de Zapier | Anthropic, 22-09-2026, nota 2 |
| Claude Opus 5.5 | 42,5 % | versión no indicada | Google (tabla Neon), 18-11-2026 |
| GPT-6.2 Sol | 41,3 % | versión no indicada | Google (tabla Neon), 18-11-2026 |
| GPT-6.2 Sol | no visible | 1.0.6 | Zapier: informe de Sol devolvió 404 |
| Claude Haiku 5.5 | no publicado | — | Sin fila en Anthropic ni en Zapier (top-10 visible) |


7. **Fuente y fecha de consulta:** zapier.com/benchmarks (consulta 22-11-2026); arXiv 2604.18934; Anthropic (22-09-2026); Google DeepMind (12-11 y 18-11-2026).
8. **Limitaciones:** el organizador (Zapier) también ejecuta las evaluaciones de Opus 5.5 en su versión de acceso anticipado. **Opus 5.5 aparece con 40,0 % (Anthropic) y 42,5 % (Google) sin que la versión coincida.** La parte visible del top-10 no incluye a Anthropic ni a OpenAI.
9. **Consecuencias para FDN:** para flujos de automatización de negocio, la referencia más sólida es el leaderboard de Zapier, donde Gemini 4 Neon aparece arriba (≈56 %) y Opus 5.5 entre 40 y 42,5 %. **Los datos no bastan para asignar tareas**; se tratan como orientación.

### 2.8 Agents' Last Exam

1. **Qué mide:** tareas largas de valor económico real con resultados verificables, en industrias no físicas (categorías O*NET/SOC 2018; 55 subcampos en 13 grupos; más de 1000 tareas en v1, según el sitio 1500+). arXiv 2606.05405 y agents-last-exam.org.
2. **Cómo se evalúa:** el abstract indica que, en las configuraciones de arnés y modelo base más habituales, la media de aciertos completos en el nivel más difícil es inferior al 1 %. Arnés, intentos y esfuerzo: no visibles en la lectura.
3. **Qué significa la puntuación:** Google publica «Score» para v1.1. El resto de cifras (tasa de aprobados frente a puntuación) no están verificadas en una fuente oficial leída.
4. **Qué NO permite concluir:** el leaderboard oficial no tenía filas visibles en la lectura. Hay una **valoración de Epoch AI** (vista en un resultado de búsqueda, no leída en su página) que califica la v1.1 como «Flawed» y señala tareas con respuesta pública y calificadores que aceptan trabajo trivial: **POR VALIDAR**.
5. **Versión y configuración:** v1.1 (la versión de la tabla de Google). Anthropic no publica este benchmark. OpenAI excluye nueve tareas de Fable 5.2 que usaban un modelo de respaldo.
6. **Resultados por modelo (todos según Google DeepMind):**

| Modelo | Puntuación | Fuente y fecha |
|---|---|---|
| Gemini 4 Neon | 75,8 % (Score, v1.1) | Google, 18-11-2026 |
| GPT-6.2 Sol | 73,0 % | Google (tabla Neon), 18-11-2026 |
| Claude Opus 5.5 | 71,6 % | Google (tabla Neon), 18-11-2026 |
| Gemini 4 Hydrogen | 71,6 % | Google, 12-11-2026 |
| GPT-6.1 Terra | 69,8 % | Google (tabla Hydrogen), 12-11-2026 |
| Claude Sonnet 5.5 | 60,4 % | Google (tabla Hydrogen), 12-11-2026 |
| GPT-6.2 Astra | 5,2 pts por encima de GPT-6 Astra; 5,5 pts por encima de Fable 5.2 (sin cifra absoluta) | OpenAI, sin fecha |
| Claude Haiku 5.5 | no publicado | — |

7. **Fuente y fecha de consulta:** arxiv.org/abs/2606.05405 (consulta 22-11-2026); tablas de Google DeepMind (12-11 y 18-11-2026); openai.com (sin fecha).
8. **Limitaciones:** todas las cifras de modelos proceden de Google, que también publica su propio modelo (Neon) en la misma tabla. Un solo proveedor, sin intervalos. Score y tasa de aprobados no son lo mismo.
9. **Consecuencias para FDN:** Neon (75,8), Sol (73,0) y Opus (71,6) están a menos de 4,2 puntos sin intervalos publicados: **no hay base para jerarquizar**. Sonnet 5.5 (60,4) aparece por debajo de Opus, pero solo en la tabla de Google. No usar como criterio de asignación.

### 2.9 Humanity's Last Exam (HLE)

Hay dos variantes en uso: **HLE** (2 500 preguntas, con o sin herramientas, según la página) y **HLE-Diamond** (un subconjunto de 1000 preguntas, 500 de razonamiento y 500 de conocimiento; publicado el 22-09-2026 por agi.safe.ai).

1. **Qué mide:** preguntas académicas expertas de muy alto nivel. Artificial Analysis evalúa 2158 preguntas solo de texto.
2. **Cómo se evalúa:** HLE-Diamond (agi.safe.ai): esfuerzo de razonamiento alto, tope de 128k tokens de salida, sin herramientas en la tabla principal y una segunda tabla con herramientas web y de código. Artificial Analysis: pass@1 con un verificador LLM. Anthropic usa «con herramientas» y «sin herramientas» sin nombrar la versión.
3. **Qué significa la puntuación:** porcentaje de respuestas correctas.
4. **Qué NO permite concluir:** HLE completo frente a HLE-Diamond; con herramientas frente a sin ellas. **Las fuentes se contradicen para el mismo nombre:** Google da 67,9 % para Opus 5.5 y 71,3 % para Neon en HLE-Diamond, mientras que agi.safe.ai da 54,6 % y 65,2 % (sin herramientas). Ni Sonnet 5.5 ni Sol coinciden (53,3 % frente a 33,1 %; 64,0 % frente a 58,3 %). No se ha podido determinar la causa.
5. **Versión y configuración:** ver punto 2. Anthropic indica max en su tabla general. Google no indica esfuerzo en su tabla.
6. **Resultados por modelo:**

| Modelo | Puntuación | Variante y configuración | Fuente y fecha |
|---|---|---|---|
| Claude Opus 5.5 | 67,7 % | HLE, con herramientas | Anthropic, 22-09-2026 |
| Claude Sonnet 5.5 | 64,5 % | HLE, con herramientas | Anthropic, 28-09-2026 |
| Claude Sonnet 5.5 | 56,9 % | HLE, sin herramientas | Anthropic (página Haiku), 07-10-2026 |
| Claude Haiku 5.5 | 57,4 % | HLE, con herramientas | Anthropic, 07-10-2026 |
| Claude Haiku 5.5 | 45,9 % | HLE, sin herramientas | Anthropic, 07-10-2026 |
| Gemini 4 Neon | 71,3 % | HLE-Diamond; config. no indicada | Google, 18-11-2026 |
| Claude Opus 5.5 | 67,9 % | HLE-Diamond; config. no indicada | Google (tabla Neon), 18-11-2026 |
| GPT-6.2 Sol | 64,0 % | HLE-Diamond; config. no indicada | Google (tabla Neon), 18-11-2026 |
| Gemini 4 Hydrogen | 58,8 % | HLE-Diamond | Google, 12-11-2026 |
| Claude Sonnet 5.5 | 53,3 % | HLE-Diamond | Google (tabla Hydrogen), 12-11-2026 |
| Claude Opus 5.5 | 54,6 % (sin herramientas); 73,9 % (web y código) | HLE-Diamond; razonamiento alto | agi.safe.ai, 22-09-2026 |
| Gemini 4 Neon | 65,2 % (sin herramientas) | HLE-Diamond; razonamiento alto | agi.safe.ai, 22-09-2026 |
| GPT-6.2 Sol | 58,3 % (sin herramientas) | HLE-Diamond; razonamiento alto | agi.safe.ai, 22-09-2026 |
| Claude Sonnet 5.5 | 33,1 % (sin herramientas) | HLE-Diamond; razonamiento alto | agi.safe.ai, 22-09-2026 |
| Claude Haiku 5.5 | no publicado | — | Sin fila en HLE-Diamond |

7. **Fuente y fecha de consulta:** agi.safe.ai/blog/hle-diamond (consulta 22-11-2026); artificialanalysis.ai/evaluations/humanitys-last-exam (sin fecha; sin filas de nuestros modelos visibles); páginas de Anthropic y Google.
8. **Limitaciones:** contradicciones explicadas en el punto 4; las tablas de Google no declaran el esfuerzo; Artificial Analysis muestra a Fable 5.2 (74,3 %), no a los modelos de la lista.
9. **Consecuencias para FDN:** **no asignar por HLE** hasta resolver la contradicción entre Google y agi.safe.ai. Dentro de Anthropic, la diferencia Opus 5.5 frente a Sonnet 5.5 con herramientas es de 3,2 puntos (dentro de lo que cabe esperar del ruido).

## 3. Discrepancias explícitas entre fuentes

1. **Terminal-Bench 4.0, orden Opus/Sonnet:** autorreporte de Anthropic (Sonnet 70,6 > Opus 66,4) frente a Snorkel (Opus 64,8 > Sonnet 61,8). Esfuerzo distinto (xhigh frente a max).
2. **Terminal-Bench 4.1, etiqueta:** «resolution rate» (Snorkel) frente a «cheating-adjusted accuracy» (Google).
3. **Terminal-Bench, número de tareas revisadas en 4.0:** 19 frente a 20.
4. **Terminal-Bench 4.1, contenido del leaderboard:** el artículo de Snorkel del 09-11 (23 configuraciones, Opus arriba) frente al leaderboard del 22-11 (53 entradas, otro modelo arriba).
5. **FrontierCode, Opus 5.5:** 54,4 % (Anthropic, 1.1 Main, max) frente a 52 % (Artificial Analysis, 1.1 Main, otro arnés).
6. **FrontierCode, Sonnet 5.5:** 46,2 % (max) frente a 52,1 % (xhigh), dentro de la misma fuente.
7. **FrontierCode, versión 2.0 de Google** (Opus 47,3 %) frente a versión 1.1 de Anthropic (54,4 %): versiones distintas.
8. **CursorBench:** Opus 5.5 57,8 % (4.0, Anthropic) frente a 58,1 % (4.1, Cursor, max): versiones distintas.
9. **OSWorld, Sonnet 5.5:** 80,1 % (partial, Anthropic) frente a 83,9 % (offline subset, Google): métricas distintas.
10. **AutomationBench, Opus 5.5:** 40,0 % (Anthropic) frente a 42,5 % (Google).
11. **HLE-Diamond:** Opus 5.5 67,9 % (Google) frente a 54,6 % (agi.safe.ai, sin herramientas). Neon 71,3 % frente a 65,2 %. Sonnet 53,3 % frente a 33,1 %. Sol 64,0 % frente a 58,3 %.
12. **SWE-bench y SWE-sweep:** no hay forma de confirmar la definición de SWE-sweep en fuentes primarias.
13. **Nombre del modelo:** Google y Anthropic usan «GPT-6 Sol» o «GPT-6.1 Sol» en tablas que pueden referirse a GPT-6.2 Sol. Se han asignado solo cuando la fuente lo dice explícitamente.

## 4. Lectura provisional para asignar (revisada con datos verificados)

- **Terminal (4.0 y 4.1):** Opus 5.5 y Sonnet 5.5 están dentro del ruido en ambas versiones. El orden cambia según la fuente. **No hay base para «Sonnet ≥ Opus» en terminal.** Ni para «Opus claramente superior». La asignación debe decidirse por métricas reales del proyecto.
- **Haiku 5.5:** por debajo en terminal (39,2 % en TB 4.0, solo autorreporte; no aparece en el top-10 de 4.0 ni de 4.1). En CursorBench 4.1, Haiku Max (48,4 %) cuesta unas siete veces menos que Sonnet Max (54,4 %). Sigue siendo válida la recomendación de tareas acotadas.
- **Neon frente a Opus:** en TB 4.1 están empatados. En el resto de benchmarks con cifras de Google aparece por delante (CursorBench 4.1, AutomationBench 1.0.6, HLE-Diamond según Google), pero **casi todas esas cifras son autorreporte del proveedor** (salvo CursorBench, Zapier y Snorkel). **POR VALIDAR** antes de decidir.
- **Hydrogen y Sol:** en TB 4.1 quedan por debajo de Opus y Neon (57,0 y 61,5 frente a 65,8). Coherente con la lectura inicial.
- **GPT-6.2 Sol:** no tiene cifras de OpenAI en su anuncio. Sus cifras proceden de Google, Snorkel (TB 4.1), Cursor (no aparece) y Zapier (informe no disponible). **Cualquier asignación sobre Sol debe ser provisional.**

## 5. Método y límites de esta verificación

- Todas las cifras se leyeron el 2026-11-22. No se hizo push ni se tocó `main`.
- **No se leyeron:** las system cards (PDF de Anthropic, `deploymentsafety.openai.com` de OpenAI) ni las páginas de metodología de Google (`evals-methodology`). Ahí podría haber esfuerzo, intentos y arnés por modelo. Es el siguiente paso recomendado.
- **No se pudieron leer:** gráficos de imagen (OpenAI), tablas renderizadas por JavaScript (leaderboard de ALE, AA, SWE-bench) y leaderboards con filas parciales.
- Se usaron búsquedas web para localizar páginas; las cifras de agregadores no se usaron como dato.
