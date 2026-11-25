#!/usr/bin/env node
import { run } from './cli.ts';

const code = await run(process.argv.slice(2), {
  stdout: (t) => void process.stdout.write(t),
  stderr: (t) => void process.stderr.write(t),
});
process.exitCode = code;
