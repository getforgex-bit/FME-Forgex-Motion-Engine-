// Pruebas de scripts/probe-media.mjs. Uso: npm test  (node --test)
// Los medios se generan con ffmpeg (testsrc2) en un directorio temporal. Si ffmpeg no está, las pruebas que lo necesitan se omiten con aviso.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fraccion, probeMedia, ProbeError } from "./probe-media.mjs";

const dir = mkdtempSync(join(tmpdir(), "fme-probe-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

let ffmpegOk = true;
try {
  execFileSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" });
} catch {
  ffmpegOk = false;
}
const sinFfmpeg = ffmpegOk ? false : "ffmpeg no está en el PATH";

const generar = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

/** MP4 sin alpha: 320×240, 30 fps, 3 s → 90 fotogramas. */
const mp4 = join(dir, "sin-alpha.mp4");
/** MOV ProRes 4444 con alpha: 320×240, 30 fps, 3 s. */
const mov = join(dir, "con-alpha.mov");
/** MP4 a 30000/1001 fps, 3 s → 90 fotogramas, fps ≈ 29,97. */
const ntsc = join(dir, "ntsc.mp4");

test("fraccion convierte racionales y descarta valores vacíos", () => {
  assert.equal(fraccion("30/1"), 30);
  assert.ok(Math.abs(fraccion("30000/1001") - 29.97) < 0.01);
  assert.equal(fraccion("0/0"), null);
  assert.equal(fraccion(undefined), null);
  assert.equal(fraccion("x"), null);
});

test("MP4 sin alpha: fps, fotogramas, tamaño y hasAlpha=false", { skip: sinFfmpeg }, async () => {
  generar(["-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=3", "-c:v", "mpeg4", "-pix_fmt", "yuv420p", mp4]);
  const r = await probeMedia(mp4);
  assert.equal(r.fps, 30);
  assert.equal(r.frames, 90);
  assert.equal(r.width, 320);
  assert.equal(r.height, 240);
  assert.equal(r.pixFmt, "yuv420p");
  assert.equal(r.hasAlpha, false);
  assert.equal(r.audio, false);
  assert.ok(Math.abs(r.durationS - 3) < 0.05);
});

test("MOV ProRes 4444 con alpha: hasAlpha=true", { skip: sinFfmpeg }, async () => {
  generar(["-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=3", "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", mov]);
  const r = await probeMedia(mov);
  // El codificador ProRes 4444 de ffmpeg 9.0.2 guarda 12 bits aunque se pida 10: se acepta cualquiera de los dos formatos con alpha.
  assert.match(r.pixFmt, /^yuva444p1[02]le$/);
  assert.equal(r.hasAlpha, true);
  assert.equal(r.fps, 30);
  assert.equal(r.frames, 90);
});

test("fps fraccionario 30000/1001 se devuelve como ≈29,97 con 90 fotogramas", { skip: sinFfmpeg }, async () => {
  generar(["-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30000/1001:duration=3", "-c:v", "mpeg4", "-pix_fmt", "yuv420p", ntsc]);
  const r = await probeMedia(ntsc);
  assert.ok(Math.abs(r.fps - 29.97) < 0.01, `fps=${r.fps}`);
  assert.equal(r.frames, 90);
});

test("sin ffprobe devuelve un error estructurado FFPROBE_NO_DISPONIBLE", async () => {
  const fichero = join(dir, "dummy.bin");
  writeFileSync(fichero, "x");
  await assert.rejects(probeMedia(fichero, { ffprobe: join(dir, "no-existe", "ffprobe") }), (e) => {
    assert.ok(e instanceof ProbeError);
    assert.equal(e.code, "FFPROBE_NO_DISPONIBLE");
    return true;
  });
});

test("archivo inexistente devuelve ARCHIVO_NO_EXISTE", async () => {
  await assert.rejects(probeMedia(join(dir, "nada.mp4")), (e) => e.code === "ARCHIVO_NO_EXISTE");
});

test("fichero no multimedia devuelve FFPROBE_FALLO", async () => {
  const txt = join(dir, "texto.mp4");
  writeFileSync(txt, "esto no es un video");
  await assert.rejects(probeMedia(txt), (e) => e.code === "FFPROBE_FALLO");
});
