// Valida .forgex/memory.jsonl: JSON por línea, tipos conocidos, sin duplicados y relaciones con extremos existentes.
// Uso: node scripts/check-memory.mjs [ruta]
import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2] ?? ".forgex/memory.jsonl";
if (!existsSync(file)) {
  console.error(`✘ No existe ${file}`);
  process.exit(1);
}
const errors = [];
const entities = new Set();
const relations = [];
readFileSync(file, "utf8").split("\n").forEach((line, i) => {
  if (!line.trim()) return;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    return errors.push(`línea ${i + 1}: JSON inválido`);
  }
  if (rec.type === "entity") {
    if (!rec.name || !rec.entityType || !Array.isArray(rec.observations)) errors.push(`línea ${i + 1}: entidad incompleta`);
    if (entities.has(rec.name)) errors.push(`línea ${i + 1}: entidad duplicada "${rec.name}"`);
    entities.add(rec.name);
  } else if (rec.type === "relation") {
    if (!rec.from || !rec.to || !rec.relationType) errors.push(`línea ${i + 1}: relación incompleta`);
    relations.push({ ...rec, line: i + 1 });
  } else {
    errors.push(`línea ${i + 1}: tipo desconocido "${rec.type}"`);
  }
});
for (const r of relations) {
  for (const end of [r.from, r.to]) if (!entities.has(end)) errors.push(`línea ${r.line}: la relación apunta a una entidad inexistente "${end}"`);
}
if (errors.length) {
  console.error(errors.map((e) => `✘ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✔ ${file}: ${entities.size} entidades, ${relations.length} relaciones`);
