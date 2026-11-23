#!/usr/bin/env node
// Coordinación entre sesiones/agentes IA mediante archivos versionados en `coordinacion/`.
// Un archivo por sesión, mensaje o reclamo: así dos sesiones nunca editan el mismo archivo y git no genera conflictos.
// Uso: node scripts/coord.mjs <comando> [--opción valor]   (ver `ayuda`)
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERRAMIENTAS = ["claude-code", "claude-desktop", "codex", "antigravity", "humano", "otra"];
export const TIPOS = ["info", "pregunta", "respuesta", "bloqueo", "traspaso"];
const ROOT = process.env.FME_COORD_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "coordinacion");
const dir = (n) => join(ROOT, n);
const ahora = () => new Date().toISOString();
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
    return `Sesión ${o.sesion} cerrada. ${comandos.liberar({ sesion: o.sesion })}\nRecuerda: bitácora en docs/bitacora/ y commit de coordinacion/.`;
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
    return out.join("\n");
  },
  ayuda() {
    return `Comandos (opciones con --nombre valor; --sesion puede venir de FME_SESION):
  registrar --herramienta <${HERRAMIENTAS.join("|")}> --nombre <slug> --tarea "<texto>" [--equipo <x>] [--rama <r>]
  avance    --texto "<qué hiciste>"
  enviar    --para <sesion|equipo:x|todos> --asunto "<..>" --texto "<..>" [--tipo ${TIPOS.join("|")}] [--responde_a <archivo>]
  buzon     [--todo] [--sinmarcar]
  reclamar  --ruta a,b --motivo "<..>"      liberar [--ruta a,b]
  cerrar    --resumen "<..>"
  estado`;
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
