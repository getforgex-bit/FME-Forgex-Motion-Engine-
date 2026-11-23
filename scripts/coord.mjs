#!/usr/bin/env node
// Coordinación entre sesiones/agentes IA mediante archivos en la carpeta operativa compartida (ADR-0007).
// La carpeta es FME_COORD_DIR o, por defecto, `FME-ops` junto al checkout principal (la misma desde cualquier worktree).
// Un archivo por sesión, mensaje, evento o reclamo: así dos sesiones nunca editan el mismo archivo.
// Uso: node scripts/coord.mjs <comando> [--opción valor]   (ver `ayuda`)
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERRAMIENTAS = ["claude-code", "claude-desktop", "codex", "antigravity", "humano", "otra"];
export const TIPOS = ["info", "pregunta", "respuesta", "bloqueo", "traspaso", "evento", "solicitud"];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** Carpeta operativa: FME_COORD_DIR, o `<padre del .git común>/../FME-ops`, idéntica para todos los worktrees. */
export function resolverRaiz(env = process.env, cwd = SCRIPT_DIR) {
  if (env.FME_COORD_DIR) return resolve(env.FME_COORD_DIR);
  try {
    const comun = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
    return resolve(dirname(comun), "..", "FME-ops");
  } catch {
    return resolve(SCRIPT_DIR, "..", "..", "FME-ops");
  }
}
const ROOT = resolverRaiz();
const dir = (n) => join(ROOT, n);
// FME_AHORA permite fijar el reloj en los tests (ISO 8601).
const ahora = () => process.env.FME_AHORA ?? new Date().toISOString();
/** Minutos sin latido a partir de los cuales un equipo con trabajo activo es «sospechoso de caída» (ADR-0013). */
export const umbralCaidaMin = () => Number(process.env.FME_UMBRAL_CAIDA_MIN ?? 60);
const minutosDesde = (iso) => (Date.parse(ahora()) - Date.parse(iso)) / 60000;
const git = (args, cwd = SCRIPT_DIR) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};
/** Worktree (ruta) donde está desprotegida una rama, según `git worktree list --porcelain`. */
function worktreeDeRama(rama) {
  const out = git(["worktree", "list", "--porcelain"]);
  if (!out || !rama) return null;
  let ruta = null;
  for (const l of out.split(/\r?\n/)) {
    if (l.startsWith("worktree ")) ruta = l.slice(9);
    if (l === `branch refs/heads/${rama}`) return ruta;
  }
  return null;
}
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Frontmatter `clave: valor` + cuerpo. */
export function leer(file) {
  const txt = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, cuerpo: txt };
  const meta = {};
  for (const l of m[1].split("\n")) {
    const i = l.indexOf(":");
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return { meta, cuerpo: m[2] };
}
export function escribir(file, meta, cuerpo = "") {
  mkdirSync(dirname(file), { recursive: true });
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${String(v).replace(/\n/g, " ")}`).join("\n");
  writeFileSync(file, `---\n${fm}\n---\n${cuerpo}`);
}
const listar = (n) => (existsSync(dir(n)) ? readdirSync(dir(n)).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort() : []);
const requerir = (o, ...ks) => {
  for (const k of ks) if (!o[k]) throw new Error(`Falta --${k}`);
};
const normRuta = (r) => r.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
// Dos rutas chocan si una es igual o está dentro de la otra.
const chocan = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

function sesionFile(id) {
  const f = join(dir("sesiones"), `${id}.md`);
  if (!existsSync(f)) throw new Error(`La sesión "${id}" no está registrada (usa \`registrar\`).`);
  return f;
}
const cargarSesion = (id) => leer(sesionFile(id));
const guardarSesion = (id, meta, cuerpo) => escribir(sesionFile(id), meta, cuerpo);

// --- Relevo entre equipos (ADR-0013) ---
/** Estado de relevo de un equipo (`relevos/<equipo>.md`); vacío si nunca se declaró caído. */
function estadoRelevo(equipo) {
  mkdirSync(dir("relevos"), { recursive: true });
  const f = join(dir("relevos"), `${slug(equipo)}.md`);
  return existsSync(f) ? leer(f) : { meta: {}, cuerpo: "" };
}
const guardarRelevo = (equipo, meta, cuerpo) => escribir(join(dir("relevos"), `${slug(equipo)}.md`), meta, cuerpo);
/** Equipos conocidos con su latido más reciente y su estado: activo | sospechoso | caido | reincorporado | inactivo. */
export function estadoEquipos() {
  const sesiones = listar("sesiones").map((f) => leer(join(dir("sesiones"), f)).meta);
  const reclamos = listar("reclamos").map((f) => leer(join(dir("reclamos"), f)).meta);
  // Las sesiones `humano` no son equipos de agentes: no caen por cuota ni se relevan.
  const equipos = [...new Set(sesiones.filter((s) => s.herramienta !== "humano").map((s) => s.equipo).filter(Boolean))].sort();
  return equipos.map((equipo) => {
    const suyas = sesiones.filter((s) => s.equipo === equipo);
    const activas = suyas.filter((s) => s.estado !== "cerrada").map((s) => s.id);
    const nRecl = reclamos.filter((r) => suyas.some((s) => s.id === r.sesion)).length;
    const ultimo = suyas.map((s) => s.ultimo_latido).filter(Boolean).sort().at(-1) ?? null;
    const minutos = ultimo ? minutosDesde(ultimo) : null;
    const rel = estadoRelevo(equipo).meta.estado;
    let estado = activas.length || nRecl ? "activo" : "inactivo";
    if (estado === "activo" && minutos !== null && minutos >= umbralCaidaMin()) estado = "sospechoso";
    if (rel === "caido") estado = "caido";
    else if (rel === "reincorporado" && estado !== "sospechoso") estado = `${estado} (reincorporado)`;
    return { equipo, estado, ultimo, minutos, activas, reclamos: nRecl };
  });
}

export const comandos = {
  /** Registra una sesión y devuelve su id. */
  registrar(o) {
    requerir(o, "herramienta", "nombre", "tarea");
    if (!HERRAMIENTAS.includes(o.herramienta)) throw new Error(`--herramienta debe ser una de: ${HERRAMIENTAS.join(", ")}`);
    const id = `${o.herramienta}-${slug(o.nombre)}`;
    if (existsSync(join(dir("sesiones"), `${id}.md`))) throw new Error(`Ya existe la sesión "${id}". Elige otro --nombre.`);
    const t = ahora();
    escribir(join(dir("sesiones"), `${id}.md`), {
      id, herramienta: o.herramienta, equipo: o.equipo ?? "general", tarea: o.tarea, rama: o.rama ?? "",
      estado: "activa", inicio: t, ultimo_latido: t, buzon_leido_hasta: t,
    }, `\n## Avance\n- ${t} · Sesión registrada.\n`);
    return `Sesión registrada: ${id}\nExporta FME_SESION=${id} para no repetir --sesion.`;
  },
  /** Añade una línea al registro de avance de la sesión y renueva su latido. */
  avance(o) {
    requerir(o, "sesion", "texto");
    const { meta, cuerpo } = cargarSesion(o.sesion);
    const t = ahora();
    guardarSesion(o.sesion, { ...meta, ultimo_latido: t }, `${cuerpo.replace(/\n*$/, "\n")}- ${t} · ${o.texto}\n`);
    return `Avance anotado en ${o.sesion}.`;
  },
  /** Envía un mensaje a una sesión, a un equipo (`equipo:<x>`) o a `todos`. */
  enviar(o) {
    requerir(o, "de", "para", "asunto", "texto");
    sesionFile(o.de);
    const tipo = o.tipo ?? "info";
    if (!TIPOS.includes(tipo)) throw new Error(`--tipo debe ser uno de: ${TIPOS.join(", ")}`);
    if (o.para !== "todos" && !o.para.startsWith("equipo:")) sesionFile(o.para);
    const t = ahora();
    const nombre = `${t.replace(/[-:.]/g, "")}-${slug(o.de)}-a-${slug(o.para)}.md`;
    escribir(join(dir("buzon"), nombre), { de: o.de, para: o.para, tipo, asunto: o.asunto, fecha: t, ...(o.responde_a ? { responde_a: o.responde_a } : {}) }, `\n${o.texto}\n`);
    return `Mensaje enviado: ${nombre}`;
  },
  /** Muestra los mensajes dirigidos a la sesión (o a su equipo / a todos) desde la última lectura. */
  buzon(o) {
    requerir(o, "sesion");
    const { meta, cuerpo } = cargarSesion(o.sesion);
    const desde = o.todo ? "" : meta.buzon_leido_hasta;
    const mios = [];
    for (const f of listar("buzon")) {
      const m = leer(join(dir("buzon"), f));
      const dest = m.meta.para;
      const paraMi = dest === o.sesion || dest === "todos" || dest === `equipo:${meta.equipo}`;
      if (paraMi && m.meta.de !== o.sesion && m.meta.fecha > desde) mios.push({ f, ...m });
    }
    if (!o.todo && !o.sinmarcar) guardarSesion(o.sesion, { ...meta, ultimo_latido: ahora(), buzon_leido_hasta: ahora() }, cuerpo);
    if (!mios.length) return "Sin mensajes nuevos.";
    return mios.map((m) => `# ${m.f}\n[${m.meta.tipo}] ${m.meta.de} → ${m.meta.para} · ${m.meta.asunto}\n${m.cuerpo.trim()}`).join("\n\n");
  },
  /** Reclama rutas para editarlas en exclusiva; falla si otra sesión activa ya tiene una ruta solapada. */
  reclamar(o) {
    requerir(o, "sesion", "ruta", "motivo");
    sesionFile(o.sesion);
    const rutas = o.ruta.split(",").map(normRuta).filter(Boolean);
    for (const f of listar("reclamos")) {
      const r = leer(join(dir("reclamos"), f));
      if (r.meta.sesion === o.sesion) continue;
      for (const a of r.meta.rutas.split(",")) for (const b of rutas)
        if (chocan(a, b)) throw new Error(`Conflicto: "${b}" choca con "${a}", reclamada por ${r.meta.sesion} (${r.meta.motivo}). Escríbele con \`enviar\` o elige otra ruta.`);
    }
    const t = ahora();
    const nombre = `${slug(o.sesion)}-${slug(rutas[0])}.md`;
    escribir(join(dir("reclamos"), nombre), { sesion: o.sesion, rutas: rutas.join(","), motivo: o.motivo, desde: t });
    return `Reclamo creado: ${nombre} (${rutas.join(", ")})`;
  },
  /** Libera los reclamos de una sesión (todos, o solo los de `--ruta`). */
  liberar(o) {
    requerir(o, "sesion");
    const rutas = o.ruta ? o.ruta.split(",").map(normRuta) : null;
    let n = 0;
    for (const f of listar("reclamos")) {
      const r = leer(join(dir("reclamos"), f));
      if (r.meta.sesion !== o.sesion) continue;
      if (rutas && !r.meta.rutas.split(",").some((x) => rutas.includes(x))) continue;
      unlinkSync(join(dir("reclamos"), f));
      n++;
    }
    return `${n} reclamo(s) liberado(s).`;
  },
  /** Cierra la sesión: estado `cerrada`, resumen y liberación de sus reclamos. */
  cerrar(o) {
    requerir(o, "sesion", "resumen");
    const { meta, cuerpo } = cargarSesion(o.sesion);
    const t = ahora();
    guardarSesion(o.sesion, { ...meta, estado: "cerrada", ultimo_latido: t }, `${cuerpo.replace(/\n*$/, "\n")}- ${t} · CIERRE: ${o.resumen}\n`);
    return `Sesión ${o.sesion} cerrada. ${comandos.liberar({ sesion: o.sesion })}\nRecuerda: bitácora en docs/bitacora/ y evento de cierre para A0.`;
  },
  /** Tablero: sesiones, reclamos y mensajes pendientes. */
  estado() {
    const sesiones = listar("sesiones").map((f) => leer(join(dir("sesiones"), f)).meta);
    const activas = sesiones.filter((s) => s.estado !== "cerrada");
    const out = ["## Sesiones activas", activas.length ? "id | equipo | estado | tarea | último latido" : "(ninguna)"];
    for (const s of activas) out.push(`${s.id} | ${s.equipo} | ${s.estado} | ${s.tarea} | ${s.ultimo_latido}`);
    out.push("", "## Reclamos");
    const reclamos = listar("reclamos").map((f) => leer(join(dir("reclamos"), f)).meta);
    if (!reclamos.length) out.push("(ninguno)");
    for (const r of reclamos) out.push(`${r.rutas} ← ${r.sesion} (${r.motivo})`);
    out.push("", "## Sin leer");
    for (const s of activas) {
      const n = listar("buzon").map((f) => leer(join(dir("buzon"), f)).meta)
        .filter((m) => (m.para === s.id || m.para === "todos" || m.para === `equipo:${s.equipo}`) && m.de !== s.id && m.fecha > s.buzon_leido_hasta).length;
      if (n) out.push(`${s.id}: ${n}`);
    }
    out.push(`\n${sesiones.length - activas.length} sesión(es) cerrada(s).`);
    out.push("", "## Equipos (ADR-0013)", comandos.equipos());
    return out.join("\n");
  },
  /** Estado de cada equipo: activo, sospechoso (sin latido ≥ umbral con trabajo activo) o caído/reincorporado (ADR-0013). */
  equipos() {
    const filas = estadoEquipos();
    if (!filas.length) return "(sin equipos)";
    const out = [`equipo | estado | último latido | min sin latido | sesiones activas | reclamos   (umbral ${umbralCaidaMin()} min)`];
    for (const e of filas) out.push(`${e.equipo} | ${e.estado} | ${e.ultimo ?? "—"} | ${e.minutos === null ? "—" : Math.round(e.minutos)} | ${e.activas.join(", ") || "—"} | ${e.reclamos}`);
    const sosp = filas.filter((e) => e.estado === "sospechoso");
    if (sosp.length) out.push("", `⚠ Sospechosos de caída: ${sosp.map((e) => e.equipo).join(", ")}. Solo el usuario puede declararlos caídos (caida --cita).`);
    return out.join("\n");
  },
  /** Declara caído un equipo (solo con la cita literal del usuario) y guarda el acta de su estado. No toca sus worktrees ni ramas. */
  caida(o) {
    requerir(o, "sesion", "equipo", "cita");
    sesionFile(o.sesion);
    const actual = estadoRelevo(o.equipo);
    if (actual.meta.estado === "caido") throw new Error(`El equipo "${o.equipo}" ya está declarado caído (${actual.meta.desde}).`);
    const t = ahora();
    const sello = t.replace(/[-:.]/g, "");
    const sesiones = listar("sesiones").map((f) => leer(join(dir("sesiones"), f)).meta).filter((s) => s.equipo === o.equipo && s.estado !== "cerrada");
    const reclamos = listar("reclamos").map((f) => ({ f, ...leer(join(dir("reclamos"), f)).meta })).filter((r) => sesiones.some((s) => s.id === r.sesion));
    const lineas = [`# Acta de caída: equipo ${o.equipo}`, "", `- Declarada: ${t} por ${o.sesion}`, `- Autoriza el usuario: «${o.cita}»`, "", "## Sesiones activas"];
    for (const s of sesiones) {
      const punta = s.rama ? git(["rev-parse", "--short", `refs/heads/${s.rama}`]) : null;
      const wt = worktreeDeRama(s.rama);
      const sucio = wt ? git(["status", "--porcelain"], wt) : null;
      let parche = "";
      if (sucio) {
        const diff = git(["diff", "HEAD"], wt);
        if (diff) {
          parche = `${sello}-${slug(s.id)}.patch`;
          writeFileSync(join(dir("relevos"), parche), `${diff}\n`);
        }
      }
      lineas.push(`- ${s.id} · tarea: ${s.tarea} · rama: ${s.rama || "—"} · punta: ${punta ?? "desconocida"} · worktree: ${wt ?? "desconocido"} · último latido: ${s.ultimo_latido}`
        + (sucio ? ` · **cambios sin commit**: ${sucio.split(/\r?\n/).length} archivo(s)${parche ? ` (parche: ${parche})` : " (solo sin seguimiento)"}` : " · limpio"));
    }
    if (!sesiones.length) lineas.push("(ninguna)");
    lineas.push("", "## Reclamos", ...(reclamos.length ? reclamos.map((r) => `- ${r.rutas} ← ${r.sesion} (${r.motivo})`) : ["(ninguno)"]));
    const acta = `${sello}-${slug(o.equipo)}-caida.md`;
    escribir(join(dir("relevos"), acta), { tipo: "acta-caida", equipo: o.equipo, fecha: t, por: o.sesion }, `\n${lineas.join("\n")}\n`);
    escribir(join(dir("relevos"), `${slug(o.equipo)}.md`), { equipo: o.equipo, estado: "caido", desde: t, acta, cita: o.cita }, "\n## Relevos\n");
    comandos.enviar({ de: o.sesion, para: "todos", tipo: "info", asunto: `Equipo ${o.equipo} declarado CAÍDO`, texto: `Acta: FME-ops/relevos/${acta}. No toméis sus tareas sin un traspaso de A0 (ADR-0013). Cita del usuario: «${o.cita}».` });
    return `Equipo ${o.equipo} declarado caído. Acta: ${acta}`;
  },
  /** Asigna una tarea del equipo caído a un relevista (con la aprobación literal del usuario): libera sus reclamos y envía el traspaso. */
  relevar(o) {
    requerir(o, "sesion", "tarea", "de", "a", "cita");
    sesionFile(o.sesion);
    const rel = estadoRelevo(o.de);
    if (rel.meta.estado !== "caido") throw new Error(`El equipo "${o.de}" no está declarado caído: usa primero \`caida\`.`);
    if (o.de === o.a) throw new Error("El relevista debe ser otro equipo.");
    const sesiones = listar("sesiones").map((f) => leer(join(dir("sesiones"), f)).meta).filter((s) => s.equipo === o.de);
    const conTarea = sesiones.filter((s) => (s.tarea ?? "").includes(o.tarea) && s.rama);
    const rama = o.rama ?? conTarea.at(-1)?.rama ?? "";
    const punta = rama ? git(["rev-parse", "--short", `refs/heads/${rama}`]) : null;
    let liberados = 0;
    for (const f of listar("reclamos")) {
      const r = leer(join(dir("reclamos"), f)).meta;
      if (sesiones.some((s) => s.id === r.sesion) && (r.motivo ?? "").includes(o.tarea)) { unlinkSync(join(dir("reclamos"), f)); liberados++; }
    }
    const nueva = rama ? `${rama}-relevo-${slug(o.a)}` : `fdn/${o.tarea}-relevo-${slug(o.a)}`;
    const t = ahora();
    const linea = `- ${t} · ${o.tarea}: ${o.de} → ${o.a} · rama origen: ${rama || "—"} @ ${punta ?? "desconocida"} · rama nueva: ${nueva} · reclamos liberados: ${liberados} · aprueba el usuario: «${o.cita}»`;
    guardarRelevo(o.de, rel.meta, `${rel.cuerpo.replace(/\n*$/, "\n")}${linea}\n`);
    comandos.enviar({ de: o.sesion, para: `equipo:${o.a}`, tipo: "traspaso", asunto: `RELEVO ${o.tarea} (de ${o.de})`,
      texto: `Tomáis ${o.tarea}, que era de ${o.de} (caído). Rama de origen: ${rama || "—"} @ ${punta ?? "desconocida"}. Cread \`git switch -c ${nueva} ${punta ?? "develop"}\` (no toquéis su rama ni su worktree). Acta con el estado y los posibles parches: FME-ops/relevos/${rel.meta.acta}. Ficha: BACKLOG.md. Termináis vosotros la tarea hasta DONE (ADR-0013 §5).` });
    return `${o.tarea} relevada de ${o.de} a ${o.a}. Rama sugerida: ${nueva}. Reclamos liberados: ${liberados}.`;
  },
  /** Reincorpora un equipo caído: genera la nota con lo ocurrido en su ausencia y se la envía como traspaso. */
  reincorporar(o) {
    requerir(o, "sesion", "equipo");
    sesionFile(o.sesion);
    const rel = estadoRelevo(o.equipo);
    if (rel.meta.estado !== "caido") throw new Error(`El equipo "${o.equipo}" no está caído.`);
    const t = ahora();
    const relevos = rel.cuerpo.split(/\r?\n/).filter((l) => l.startsWith("- "));
    const integrado = git(["log", "--first-parent", "--format=- %h %s", `--since=${rel.meta.desde}`, "develop"]);
    const nota = [
      `# Nota de reincorporación: equipo ${o.equipo}`, "",
      `- Caída declarada: ${rel.meta.desde} · Reincorporación: ${t}`,
      `- Acta de cuando caísteis: FME-ops/relevos/${rel.meta.acta}`, "",
      "## Tareas relevadas (las termina el relevista; no las continuéis)", ...(relevos.length ? relevos : ["(ninguna)"]), "",
      "## Integrado en develop desde la caída", integrado || "(nada)", "",
      "## Qué hacer ahora",
      "1. Compara tu worktree con el acta: misma punta de rama y los mismos cambios sin commit. Si difieren, avisa a A0 antes de tocar nada.",
      "2. Haz `git merge develop` en tus ramas de tareas NO relevadas antes de seguir.",
      "3. No continúes las tareas relevadas: si tienes trabajo propio sin commit sobre ellas, envíaselo al relevista como `solicitud` (parche o rama).",
      "4. Lee `git show develop:coordinacion/CURRENT_SPRINT.md` y toma tareas READY de tu equipo.",
    ].join("\n");
    const archivo = `${t.replace(/[-:.]/g, "")}-${slug(o.equipo)}-reincorporacion.md`;
    escribir(join(dir("relevos"), archivo), { tipo: "nota-reincorporacion", equipo: o.equipo, fecha: t }, `\n${nota}\n`);
    guardarRelevo(o.equipo, { ...rel.meta, estado: "reincorporado", reincorporado: t, nota: archivo }, rel.cuerpo);
    comandos.enviar({ de: o.sesion, para: `equipo:${o.equipo}`, tipo: "traspaso", asunto: "Reincorporación: lee la nota antes de seguir", texto: `Nota: FME-ops/relevos/${archivo}\n\n${nota}` });
    return `Equipo ${o.equipo} reincorporado. Nota: ${archivo}`;
  },
  /** Muestra la carpeta operativa en uso. */
  raiz() {
    return ROOT;
  },
  ayuda() {
    return `Comandos (opciones con --nombre valor; --sesion puede venir de FME_SESION):
  registrar --herramienta <${HERRAMIENTAS.join("|")}> --nombre <slug> --tarea "<texto>" [--equipo <x>] [--rama <r>]
  avance    --texto "<qué hiciste>"
  enviar    --para <sesion|equipo:x|todos> --asunto "<..>" --texto "<..>" [--tipo ${TIPOS.join("|")}] [--responde_a <archivo>]
  buzon     [--todo] [--sinmarcar]
  reclamar  --ruta a,b --motivo "<..>"      liberar [--ruta a,b]
  cerrar    --resumen "<..>"
  estado    (tablero)        raiz  (muestra la carpeta operativa)
Relevo entre equipos (ADR-0013; solo el integrador, con la cita literal del usuario):
  equipos                                         estado de cada equipo (sospechoso si no hay latido en ≥ FME_UMBRAL_CAIDA_MIN, 60 por defecto)
  caida        --equipo <x> --cita "<usuario>"   declara caído y guarda el acta (no toca worktrees)
  relevar      --tarea FDN-xxx --de <x> --a <y> --cita "<usuario>" [--rama <r>]
  reincorporar --equipo <x>                       genera la nota de reincorporación y la envía`;
  },
};

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`Argumento inesperado: ${argv[i]}`);
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) o[k] = true;
    else { o[k] = v; i++; }
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [cmd = "ayuda", ...resto] = process.argv.slice(2);
    if (!comandos[cmd]) throw new Error(`Comando desconocido "${cmd}". Usa \`ayuda\`.`);
    const o = parseArgs(resto);
    const s = o.sesion ?? process.env.FME_SESION;
    if (s && cmd !== "registrar") {
      if (cmd === "enviar") o.de ??= s; else o.sesion ??= s;
    }
    console.log(comandos[cmd](o));
  } catch (e) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
}
