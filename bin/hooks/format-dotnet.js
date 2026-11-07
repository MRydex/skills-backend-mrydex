#!/usr/bin/env node

/**
 * Hook PostToolUse de Claude Code (Edit | Write | MultiEdit) de skills-backend-mrydex.
 * Corre `dotnet format whitespace --folder` solo sobre el archivo .cs editado y solo si el repo ya
 * define su estilo con un `.editorconfig` (en la carpeta del archivo o arriba, hasta la raíz del repo).
 * `--folder` no carga la solución: es rápido y no necesita restore.
 * No ensucia el diff: si el archivo está versionado y en HEAD no estaba formateado, no lo toca
 * (formatearlo cambiaría líneas que nadie editó, §13.5). Si `dotnet` no está o falla, no hace nada.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OPTIONS = { stdio: 'ignore', windowsHide: true, timeout: 27000 };

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

// Carpeta con `.editorconfig` más cercana, sin pasar la raíz del repo (.git)
function editorconfigRoot(file) {
  let dir = path.dirname(file);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.editorconfig'))) return dir;
    if (fs.existsSync(path.join(dir, '.git'))) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const format = (root, relative, extra = []) =>
  spawnSync('dotnet', ['format', 'whitespace', root, '--folder', '--include', relative, ...extra], { ...OPTIONS, cwd: root });

// false solo si el archivo está en HEAD y esa versión no estaba formateada. La versión de HEAD se
// chequea en una copia temporal junto al archivo, así le aplica el mismo `.editorconfig`.
function wasFormatted(root, file) {
  const git = spawnSync('git', ['show', `HEAD:./${path.basename(file)}`], {
    cwd: path.dirname(file), encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 20 * 1024 * 1024,
  });
  if (git.status !== 0) return true;
  const temp = path.join(path.dirname(file), `.${path.basename(file, '.cs')}.${process.pid}.head.cs`);
  try {
    // git guarda LF; con autocrlf la copia de trabajo es CRLF y `end_of_line` la validaría en falso
    const crlf = fs.readFileSync(file, 'utf8').includes('\r\n');
    fs.writeFileSync(temp, crlf ? git.stdout.replace(/\r?\n/g, '\r\n') : git.stdout);
    return format(root, path.relative(root, temp), ['--verify-no-changes']).status === 0;
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

async function main() {
  const event = JSON.parse(await readStdin());
  const file = String(event.tool_input?.file_path ?? '');
  if (!/\.cs$/i.test(file)) return;
  const absolute = path.resolve(event.cwd ?? process.cwd(), file);
  const root = editorconfigRoot(absolute);
  if (!root || !wasFormatted(root, absolute)) return;
  format(root, path.relative(root, absolute));
}

main().catch(() => {});
