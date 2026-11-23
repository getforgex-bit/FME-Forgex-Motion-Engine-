import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [mode, ...args] = process.argv.slice(2);
if (mode === 'run') {
  const [literal, input, output] = args;
  writeFileSync(output, readFileSync(input));
  console.log(JSON.stringify({
    literal,
    cwd: process.cwd(),
    explicit: process.env.FME_EXPLICIT ?? null,
    inherited: process.env.FME_WORKER_TEST_PARENT ?? null,
  }));
  console.error('stderr de prueba');
  process.exitCode = 7;
} else if (mode === 'root' || mode === 'child' || mode === 'grandchild') {
  const next = { root: 'child', child: 'grandchild' }[mode];
  if (next) {
    spawn(process.execPath, [fileURLToPath(import.meta.url), next], {
      shell: false,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    });
  }
  console.log(JSON.stringify({ mode, pid: process.pid }));
  // Límite propio para evitar procesos de prueba persistentes si falla la terminación.
  setTimeout(() => process.exit(0), 15_000);
} else {
  throw new Error('Modo de prueba desconocido: ' + mode);
}
