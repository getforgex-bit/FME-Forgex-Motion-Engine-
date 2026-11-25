// Generador de PROGRESO.md por hitos verificables (FDN-092, propuesta v2 §3.4–§3.5).
// Uso:
//   node scripts/progreso.mjs                      genera PROGRESO.md en la raíz
//   node scripts/progreso.mjs --check              aplica las reglas y sale con 1 si hay incumplimientos (no escribe)
//   opciones: --backlog <ruta>  --acceptance <ruta>  --salida <ruta>
// Sin dependencias. Solo lee; no edita BACKLOG.md ni pruebas-aceptacion.md.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAZOS = { 1: "Corto", 2: "Mediano", 3: "Largo" };
const CLASES = ["critico", "normal", "menor"];

/** Celdas de una fila de tabla markdown. */
export function celdas(linea) {
  return linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
}

/** Líneas de una sección `## titulo` (hasta la siguiente `## `), o null si no existe. */
export function seccion(txt, titulo) {
  const lineas = txt.replace(/\r\n/g, "\n").split("\n");
  const i = lineas.findIndex((l) => l.trim() === `## ${titulo}`);
  if (i < 0) return null;
  const salida = [];
  for (let k = i + 1; k < lineas.length && !/^## /.test(lineas[k]); k++) salida.push(lineas[k]);
  return salida;
}

/** Normaliza un id de tarea: «FDN-052» → «052», «FDN-032b» → «032b». */
export const normTarea = (s) => s.trim().toLowerCase().replace(/^fdn-/, "");
const esVacio = (s) => s === "" || s === "—" || s === "-";

/** Estado de hito a partir de su celda: cerrado | abierto | retirado. */
function estadoHito(celda) {
  const c = celda.trim().toLowerCase();
  if (c.startsWith("retirad")) return "retirado";
  if (c === "[x]" || c === "x" || c.startsWith("cerrad")) return "cerrado";
  return "abierto";
}

/** Extrae hitos (sección `## Hitos`), tareas (sección `## Resumen`) y criterios (pruebas-aceptacion). */
export function leerFuentes(backlogTxt, aceptacionTxt) {
  const hitos = [];
  for (const l of seccion(backlogTxt, "Hitos") ?? []) {
    const c = celdas(l);
    if (c.length < 8 || !/^H-/.test(c[0])) continue;
    hitos.push({
      id: c[0],
      plazo: Number(c[1]),
      parte: c[2],
      fase: c[3],
      clase: c[4].toLowerCase(),
      estado: estadoHito(c[5]),
      evidencia: c[6],
      aportan: c[7].split(",").map((s) => s.trim()).filter((s) => !esVacio(s)).map(normTarea),
    });
  }

  const tareas = [];
  for (const l of seccion(backlogTxt, "Resumen") ?? []) {
    const c = celdas(l);
    if (c.length < 5 || !/^FDN-/i.test(c[0])) continue;
    tareas.push({
      id: normTarea(c[0]),
      tarea: c[1],
      equipo: c[2].split("-")[0].toUpperCase(),
      estadoRaw: c[4],
      estado: c[4].split(/\s|\(/)[0].toUpperCase(),
    });
  }

  const criterios = [];
  for (const l of (aceptacionTxt ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const c = celdas(l);
    if (c.length < 4 || !/^\d+$/.test(c[0])) continue;
    if (c[3] !== "☑" && c[3] !== "☐") continue;
    criterios.push({ n: Number(c[0]), marcado: c[3] === "☑", texto: c[1] });
  }
  return { hitos, tareas, criterios };
}

/** Reglas del §3.4. Devuelve la lista de incumplimientos (vacía si todo cumple). */
export function verificar({ hitos, tareas, criterios }) {
  const v = [];
  const ids = new Set();
  for (const h of hitos) {
    if (ids.has(h.id)) v.push(`slug duplicado: ${h.id}`);
    ids.add(h.id);
    if (!CLASES.includes(h.clase)) v.push(`${h.id}: clase desconocida «${h.clase}»`);
    if (h.estado === "cerrado" && esVacio(h.evidencia)) v.push(`${h.id}: cerrado sin evidencia`);
    if (h.estado === "retirado" && esVacio(h.evidencia)) v.push(`${h.id}: retirado sin motivo`);
    if (h.clase === "menor" && /^H-(criterio|cierre)-/.test(h.id))
      v.push(`${h.id}: un hito menor no puede cerrar un criterio ni una fase`);
  }

  const tareasIds = new Set(tareas.map((t) => t.id));
  const aportadas = new Set();
  for (const h of hitos) for (const t of h.aportan) {
    aportadas.add(t);
    if (!tareasIds.has(t)) v.push(`${h.id}: aporta a la tarea inexistente FDN-${t.toUpperCase()}`);
  }
  for (const t of tareas) if (t.estado === "DONE" && !aportadas.has(t.id))
    v.push(`FDN-${t.id.toUpperCase()}: DONE sin ningún hito`);

  for (const c of criterios) {
    const h = hitos.find((x) => x.id === `H-criterio-${c.n}`);
    if (c.marcado && (!h || h.estado !== "cerrado"))
      v.push(`criterio ${c.n} ☑ sin hito H-criterio-${c.n} cerrado`);
    if (!c.marcado && h && h.estado === "cerrado")
      v.push(`H-criterio-${c.n} cerrado pero el criterio ${c.n} está ☐`);
  }
  return v;
}

/** Genera el documento y el resumen numérico. `previo` es el PROGRESO.md anterior (o null). */
export function generar({ hitos, tareas, criterios }, previo = null) {
  const vivos = hitos.filter((h) => h.estado !== "retirado");
  const cuenta = (lista) => ({ cerrados: lista.filter((h) => h.estado === "cerrado").length, total: lista.length });
  const pct = ({ cerrados, total }) => (total === 0 ? 0 : Math.round((cerrados / total) * 100));
  const porPlazo = {};
  for (const p of [1, 2, 3]) porPlazo[p] = cuenta(vivos.filter((h) => h.plazo === p));
  const general = cuenta(vivos.filter((h) => h.plazo === 1 || h.plazo === 2));
  const criteriosOk = criterios.filter((c) => c.marcado).length;
  const bloqueos = tareas.filter((t) => t.estado === "BLOCKED" && /humano/i.test(t.estadoRaw));

  let nuevos = null;
  if (previo !== null) {
    const anteriores = new Set(previo.match(/H-[A-Za-z0-9-]+/g) ?? []);
    nuevos = hitos.filter((h) => !anteriores.has(h.id)).length;
  }

  const L = [];
  L.push("# Progreso de FME  (generado por scripts/progreso.mjs; no editar a mano)", "");
  L.push(
    `**v0.1: ${general.cerrados}/${general.total} hitos (${pct(general)} %)** · Corto ${porPlazo[1].cerrados}/${porPlazo[1].total} · Mediano ${porPlazo[2].cerrados}/${porPlazo[2].total} · Largo: catálogo condicionado (${porPlazo[3].cerrados}/${porPlazo[3].total}, fuera del %)`,
  );
  L.push(`Criterios: ${criteriosOk}/${criterios.length} ☑ · Bloqueos humanos: ${bloqueos.length ? bloqueos.map((t) => `FDN-${t.id.toUpperCase()}`).join(", ") : "ninguno"}`);
  if (nuevos !== null) L.push(`+${nuevos} hitos nuevos desde la última generación.`);
  L.push("", "El % no tiene pesos: cuenta hitos vivos (no retirados) cerrados con evidencia.", "");

  for (const p of [1, 2, 3]) {
    const del = vivos.filter((h) => h.plazo === p);
    if (!del.length && p === 3) continue;
    const c = porPlazo[p];
    L.push(`## Plazo ${p} · ${PLAZOS[p]}  (${c.cerrados}/${c.total}${p === 3 ? ", condicionado" : ""})`, "");
    const partes = [...new Set(del.map((h) => h.parte))];
    for (const parte of partes) {
      L.push(`### Parte ${parte}`, "");
      const fases = [...new Set(del.filter((h) => h.parte === parte).map((h) => h.fase))];
      for (const fase of fases) {
        L.push(`#### Fase ${fase}`, "");
        for (const h of del.filter((x) => x.parte === parte && x.fase === fase)) {
          const marca = h.estado === "cerrado" ? "[x]" : h.estado === "retirado" ? "[-]" : "[ ]";
          const crit = h.clase === "critico" ? " **(crítico)**" : "";
          const tareasTxt = h.aportan.length ? ` ← ${h.aportan.map((t) => `FDN-${t.toUpperCase()}`).join(", ")}` : "";
          L.push(`- ${marca} ${h.id}${crit}${tareasTxt}`);
        }
        L.push("");
      }
    }
  }

  L.push("## Por equipo", "", "La vista por rol (B1/B2, C1/C2, A1/A2) queda pendiente: el BACKLOG no registra el rol de cada tarea (propuesta v2, hallazgo 12).", "");
  for (const equipo of [...new Set(tareas.map((t) => t.equipo))].sort()) {
    const del = tareas.filter((t) => t.equipo === equipo);
    const enCurso = del.filter((t) => t.estado === "IN_PROGRESS" || t.estado === "REVIEW");
    const hechas = del.filter((t) => t.estado === "DONE").length;
    const txt = enCurso.length ? enCurso.map((t) => `FDN-${t.id.toUpperCase()} (${t.estado})`).join(", ") : "en reposo";
    L.push(`- **${equipo}**: en curso ${txt} · integradas ${hechas}/${del.length}`);
  }
  L.push("");
  return { markdown: L.join("\n"), resumen: { general, porPlazo, criteriosOk, criteriosTotal: criterios.length, nuevos } };
}

function leerOpcional(ruta) {
  return existsSync(ruta) ? readFileSync(ruta, "utf8") : null;
}

function main(argv) {
  const opt = { backlog: resolve(RAIZ, "coordinacion/BACKLOG.md"), acceptance: resolve(RAIZ, "docs/pruebas-aceptacion.md"), salida: resolve(RAIZ, "PROGRESO.md"), check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") opt.check = true;
    else if (a === "--backlog") opt.backlog = resolve(argv[++i]);
    else if (a === "--acceptance") opt.acceptance = resolve(argv[++i]);
    else if (a === "--salida") opt.salida = resolve(argv[++i]);
    else {
      console.error(`Opción desconocida: ${a}`);
      return 2;
    }
  }
  const backlog = leerOpcional(opt.backlog);
  if (backlog === null) {
    console.error(`No existe el BACKLOG: ${opt.backlog}`);
    return 2;
  }
  const fuentes = leerFuentes(backlog, leerOpcional(opt.acceptance));
  if (fuentes.hitos.length === 0) {
    console.error('El BACKLOG no tiene una sección "## Hitos" con filas H-…');
    return 2;
  }
  const violaciones = verificar(fuentes);
  if (opt.check) {
    if (violaciones.length) {
      for (const x of violaciones) console.log(`✘ ${x}`);
      console.log(`${violaciones.length} incumplimiento(s).`);
      return 1;
    }
    console.log("✔ Trazabilidad conforme.");
    return 0;
  }
  const { markdown, resumen } = generar(fuentes, leerOpcional(opt.salida));
  writeFileSync(opt.salida, markdown);
  console.log(`PROGRESO.md escrito: v0.1 ${resumen.general.cerrados}/${resumen.general.total}, criterios ${resumen.criteriosOk}/${resumen.criteriosTotal}.`);
  if (violaciones.length) console.log(`Aviso: ${violaciones.length} incumplimiento(s); ejecuta con --check para verlos.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
