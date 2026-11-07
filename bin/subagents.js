/**
 * Subagentes del equipo para cada agente de IA, generados desde una sola definición.
 * Formatos verificados en la documentación oficial de cada agente (ver §14.3.2 de la skill).
 *
 * El orquestador delega en ellos solo cuando baja el total de tokens (§14.3.4):
 * búsquedas/lecturas grandes y ediciones mecánicas en 8+ archivos. Lo chico lo hace él.
 */

const fs = require('fs');
const path = require('path');

// `investigador` es el mismo que instala skills-frontend-mrydex (genérico, sin stack): si ambos
// instaladores corren, el archivo queda idéntico. `ejecutor` y `revisor-checklist` llevan sufijo
// `-backend` para no pisar los de frontend, que siguen otra skill.
const ROLES = [
  {
    name: 'investigador',
    readonly: true,
    // Modelo intermedio: en la prueba real Haiku no encontró el mecanismo principal de una búsqueda amplia
    cheap: false,
    description:
      'Use when searching or reading would pull a lot into the main context (3+ files, big files, logs, build output, web docs). Read-only. Returns a short caveman file:line list (plus a short flow summary for "how does X work", or the decisive lines for logs, builds and docs). Skip for 1-2 known files.',
    instructions: `Localizá código y devolvé solo \`archivo:línea — qué hay ahí\`, en modo caveman (frases cortas, sin relleno).

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`. Recién después grep/lectura.
2. Nunca edites archivos. Nunca propongas cambios.
3. Respuesta: lista \`archivo:línea — qué hay ahí\`. Si la pregunta es cómo funciona algo, sumá el flujo en pocas líneas. Para logs, builds o docs web: las líneas decisivas citadas exactas y un resumen corto que responda la pregunta. Si no encontrás algo, decilo en una línea.
4. Si la pregunta es ambigua, devolvé \`NECESITA_ADVISOR: <duda>\`.`,
  },
  {
    name: 'ejecutor-backend',
    readonly: false,
    cheap: false,
    description:
      'Use in .NET backend repos (*.sln / *.csproj) to implement a concrete brief from the main model when it saves tokens (mechanical edits with a clear pattern across 8+ files, independent units run in parallel, or the next tasks/todo.md task handed to a fresh context). Returns a short caveman report: files changed, decisions the brief left open, problems. Skip small edits the main model can do inline.',
    instructions: `Implementá exactamente el brief que te pasa el modelo principal. Nada más.

1. Seguí las reglas compactas del brief (\`tasks/brief-<tarea>.md\`). Abrí una referencia de la skill \`desarrollo-backend-buenas-practicas\` solo si el brief la cita.
2. Antes de buscar código: \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`.
3. No amplíes el alcance. No agregues abstracciones, paquetes ni capas que el brief no pide. Tests solo si el brief los pide (xUnit + Moq, \`references/10-logging-tests.md\`).
4. Si el brief es ambiguo o te trabás, no adivines: devolvé \`NECESITA_ADVISOR: <duda>\`.
5. Al terminar, corré \`graphify update .\`, \`dotnet build\` y, si el brief lo pide, \`dotnet test\` del proyecto UnitTest.
6. Respuesta final en modo caveman: archivos tocados, resultado de build/test, decisiones que tomaste y el brief no fijaba, y cualquier problema.`,
  },
  {
    name: 'revisor-checklist-backend',
    readonly: true,
    cheap: true,
    description:
      'Use in .NET backend repos after large code changes (3+ files) to check the diff against the desarrollo-backend-buenas-practicas checklists (controllers, handlers, Dapper, EF Core, validation, errors, security, no over-engineering). Read-only. Returns one line per finding. Pass the verbatim request (L1), the specs and the diff scope. Ends with a verdict: LISTO / CORREGIR Y LISTO / REHACER. Not a substitute for the final review by the main model.',
    instructions: `Revisá el diff que te pasa el orquestador (o \`git diff\` si podés correrlo) contra \`references/checklists.md\` y la revisión Red Team §11.1 de \`references/11-security.md\` de la skill \`desarrollo-backend-buenas-practicas\`.

1. Una línea por hallazgo: \`archivo:línea: [ALTO|MEDIO|BAJO] problema. arreglo.\` Sin elogios, sin resumen.
2. Solo reglas de la skill y lo que piden el pedido y las specs que te pasen. Nada de gustos personales ni formato.
3. Nunca edites archivos.
4. Si no hay hallazgos: \`Sin hallazgos.\` No inventes problemas para tener algo que reportar.
5. No escribiste este código: juzgalo contra el pedido y las specs que te pasen, no contra lo que el autor quiso hacer.
6. Última línea, el veredicto: \`LISTO\`, \`CORREGIR Y LISTO\` (solo MEDIO/BAJO) o \`REHACER\` (algún ALTO).`,
  },
  {
    name: 'migrador-dotnet',
    readonly: false,
    cheap: false,
    description:
      'Use only when the user asks to upgrade the target framework of .NET projects (netcoreapp2.x/3.1, net5/6/8 to net10) or their packages. Goes project by project from the leaves of the dependency graph, keeps dotnet build and dotnet test green and lists the breaking changes found. Not for regular feature work.',
    instructions: `Migrá siguiendo \`references/19-migracion-dotnet.md\` de la skill \`desarrollo-backend-buenas-practicas\`. Nada fuera de la migración pedida.

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`. Inventariá el \`TargetFramework\` de cada \`.csproj\` y el orden de dependencias (hojas primero).
2. Un proyecto por vez: \`TargetFramework\`, paquetes alineados, APIs obsoletas y los breaking changes de §19.
3. Después de cada proyecto: \`dotnet build\` y \`dotnet test\` si hay proyecto de tests. Si queda rojo y no sabés por qué, frená y devolvé \`NECESITA_ADVISOR: <error exacto>\`.
4. No mezcles refactors con la migración. No cambies contratos de la API (JSON, rutas, códigos de estado) salvo que el breaking change lo obligue: si pasa, reportalo.
5. Commits: si el brief autoriza commitear, un commit por proyecto con build y tests verdes (punto de vuelta atrás de §19). Si no, migrá un solo proyecto, frená y devolvé el control para que se commitee antes del siguiente.
6. Al terminar, \`graphify update .\`. Respuesta caveman: proyectos migrados, versión origen y destino, breaking changes, resultado de build/test y pendientes.`,
  },
  {
    name: 'auditor-sql',
    readonly: true,
    cheap: false,
    description:
      'Use to review SQL access in .NET repos: stored procedures, .sql scripts, raw ADO.NET or Dapper queries (injection, transactions, N+1, parameters, timeouts). Read-only. Returns one line per finding and a verdict. Skip if the change does not touch data access.',
    instructions: `Revisá el acceso a datos del diff o de las rutas que te pasen. Nunca edites archivos.

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`.
2. Reglas: skill \`desarrollo-backend-buenas-practicas\` §05 (Dapper), §15 (EF Core) y §18 (stored procedures), y la revisión de seguridad de §11. Aplicá solo las de la tecnología que el proyecto usa.
3. Buscá: SQL armado concatenando texto, parámetros sin tipo o \`AddWithValue\`, SQL dinámico sin \`sp_executesql\`, transacciones que no cubren todas las escrituras, N+1, falta de \`CancellationToken\` o timeout, \`SET NOCOUNT ON\` y manejo de errores en los SP, permisos más amplios que \`EXECUTE\`.
4. Una línea por hallazgo: \`archivo:línea: [ALTO|MEDIO|BAJO] problema. arreglo.\` Sin hallazgos: \`Sin hallazgos.\`
5. Última línea, el veredicto: \`LISTO\`, \`CORREGIR Y LISTO\` (solo MEDIO/BAJO) o \`REHACER\` (algún ALTO).`,
  },
  {
    name: 'generador-tests-backend',
    readonly: false,
    cheap: false,
    description:
      'Use in .NET repos to write missing xUnit + Moq unit tests for existing handlers, validators and services, when the user asks for tests or coverage. Follows the existing test project conventions, runs dotnet test and reports. Does not change production code.',
    instructions: `Escribí tests unitarios para el código que te indica el brief, siguiendo \`references/10-logging-tests.md\` de la skill \`desarrollo-backend-buenas-practicas\`.

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`. Leé un test existente y copiá su estilo (nombres, carpetas, builders, aserciones).
2. Si no hay proyecto de tests, no lo crees: devolvé \`NECESITA_ADVISOR: no hay proyecto de tests\`.
3. Cubrí el camino feliz, los errores de validación y los casos borde que el código ya maneja. Un test por comportamiento.
4. No cambies código de producción. Si algo no se puede testear sin cambiarlo, reportalo.
5. Corré \`dotnet test\` del proyecto de tests. Si el mismo test sigue rojo después de 3 intentos de corrección, frená y devolvé \`NECESITA_ADVISOR: <error exacto y qué probaste>\` (§13.3). Un test que falla por un bug real del código no se ajusta para que pase: reportá el bug.
6. Al terminar, \`graphify update .\`. Respuesta caveman: tests agregados, resultado de \`dotnet test\` y bugs encontrados.`,
  },
  {
    name: 'operador-pipeline',
    readonly: false,
    cheap: false,
    description:
      'Use in .NET repos to create or fix Azure DevOps YAML pipelines, Dockerfiles or the pack and publish of an internal NuGet package, when the user asks. Follows the pipelines the repo already has. Never writes secrets. Returns a short report.',
    instructions: `Creá o arreglá el pipeline, el Dockerfile o la publicación NuGet que pide el brief, siguiendo \`references/20-librerias-nuget-ci.md\` de la skill \`desarrollo-backend-buenas-practicas\`.

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`. Si el repo ya tiene pipelines, copiá su estructura (un YAML por ambiente o stages) en vez de inventar otra.
2. Nunca escribas secretos, tokens ni connection strings: usá variable groups, Key Vault o variables secretas del pipeline.
3. Build, test y publish con los pasos de §20. No agregues etapas, herramientas ni ambientes que el brief no pide.
4. Verificá lo que se pueda en local (\`dotnet build\`, \`dotnet pack\`, \`docker build\` si Docker está instalado) y decí qué no se pudo probar.
5. Al terminar, \`graphify update .\`. Respuesta caveman: archivos tocados, qué se verificó y qué falta probar en el servidor de CI.`,
  },
  // Compartidos con skills-frontend-mrydex: mismo nombre y mismo texto en los dos paquetes
  // (cada instalador pisa el archivo del otro). Si cambiás uno, cambiá el otro.
  {
    name: 'auditor-contrato-api',
    readonly: true,
    cheap: false,
    description:
      'Use when the API contract between a .NET backend and an Angular front may have drifted: after changing controllers, DTOs or front Request/Response models, or before wiring a new endpoint. Read-only. Compares OpenAPI/DTOs with the front models and returns one line per mismatch. Skip if there is no API consumed by a front.',
    instructions: `Compará el contrato de la API con lo que espera el front. Nunca edites archivos.

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`.
2. Fuentes: el OpenAPI (documento generado o \`swagger.json\` del repo) o los controllers y DTOs; en el front, los modelos Request/Response, los servicios y los \`httpResource\`. Si solo tenés un lado, devolvé \`NECESITA_ADVISOR: ruta del otro repo\`.
3. Revisá: rutas y verbos; nombres y casing de campos; tipos (número o texto, enums como texto o número); nullability; fechas (ISO UTC o local sin offset: tiene que coincidir con el interceptor de fechas del front si existe; \`DateOnly\` viaja como texto \`yyyy-MM-dd\`, nunca como \`Date\` del front); paginado; códigos de estado y forma del error (ProblemDetails); campos que el front lee y la API ya no manda.
4. Reglas: skill \`desarrollo-backend-buenas-practicas\` §17 y skill \`desarrollo-buenas-practicas\` §02 (Request/Response y mapeo). Aplicá solo lo que el proyecto usa.
5. Una línea por hallazgo: \`archivo:línea: [ALTO|MEDIO|BAJO] diferencia. arreglo.\` ALTO = rompe en runtime. Sin hallazgos: \`Sin hallazgos.\``,
  },
  {
    name: 'revisor-auth',
    readonly: true,
    cheap: false,
    description:
      'Use after changes to authentication or authorization (JWT, OIDC, identity provider, guards, auth interceptors, token storage, CORS, LDAP) or when auditing auth. Read-only. Works on .NET backends and Angular fronts. Returns one line per finding and a verdict.',
    instructions: `Revisá la autenticación y la autorización del diff o de las rutas que te pasen. Nunca edites archivos.

1. Primero \`graphify query "<pregunta>"\` si existe \`graphify-out/graph.json\`.
2. Backend (skill \`desarrollo-backend-buenas-practicas\` §11): validación del token (issuer, audience, lifetime, firma, ClockSkew), política fallback, autorización por endpoint, CORS con orígenes explícitos, secretos fuera del repo; si hay IdP propio, PKCE y redirect URIs exactas; si hay LDAP, filtros escapados.
3. Front (skill \`desarrollo-buenas-practicas\` §15): code flow con PKCE, token solo hacia la API propia, dónde se guarda el token, URL de retorno validada (mismo origen), guards solo como UX, nada sensible en logs.
4. Solo lo que el proyecto usa: no pidas una librería o un flujo que no está.
5. Una línea por hallazgo: \`archivo:línea: [ALTO|MEDIO|BAJO] problema. arreglo.\` Sin hallazgos: \`Sin hallazgos.\`
6. Última línea, el veredicto: \`LISTO\`, \`CORREGIR Y LISTO\` (solo MEDIO/BAJO) o \`REHACER\` (algún ALTO).`,
  },
];

// Los subagentes de solo lectura no tienen la herramienta Skill: se les dice dónde buscarla.
// Mismo texto en skills-frontend-mrydex y skills-backend-mrydex.
const SKILL_PATH_HINT = 'Las rutas `references/...` y los § son de la skill que se nombra: leela en `.claude/skills/`, `.agents/skills/` o `skills/` del repo, o en `~/.claude/skills/` / `~/.agents/skills/` (la primera que exista).';
for (const role of ROLES) {
  if (role.instructions.includes('skill `')) role.instructions += `\n\n${SKILL_PATH_HINT}`;
}

const markdown = (frontmatter, body) => `---\n${frontmatter.join('\n')}\n---\n\n${body}\n`;

// Un escritor por agente: carpeta global, nombre de archivo y contenido en su formato.
// `requires` = carpeta que indica que el agente está instalado en la máquina.
const TARGETS = [
  {
    label: 'Claude Code',
    requires: '.claude',
    dir: ['.claude', 'agents'],
    file: (r) => `${r.name}.md`,
    render: (r) =>
      markdown(
        [
          `name: ${r.name}`,
          `description: ${r.description}`,
          `model: ${r.cheap ? 'haiku' : 'sonnet'}`,
          `effort: ${r.cheap ? 'low' : 'medium'}`,
          ...(r.readonly ? ['tools: Read, Grep, Glob, Bash'] : []),
        ],
        r.instructions,
      ),
  },
  {
    label: 'Codex',
    requires: '.codex',
    dir: ['.codex', 'agents'],
    file: (r) => `${r.name.replace(/-/g, '_')}.toml`,
    // Sin `model`: hereda el del usuario y abarata con menos razonamiento (los ids cambian seguido)
    render: (r) =>
      [
        `name = "${r.name.replace(/-/g, '_')}"`,
        `description = "${r.description.replace(/"/g, '\\"')}"`,
        `model_reasoning_effort = "${r.cheap ? 'low' : 'medium'}"`,
        `sandbox_mode = "${r.readonly ? 'read-only' : 'workspace-write'}"`,
        `developer_instructions = """\n${r.instructions}\n"""`,
        '',
      ].join('\n'),
  },
  {
    label: 'Cursor',
    requires: '.cursor',
    dir: ['.cursor', 'agents'],
    file: (r) => `${r.name}.md`,
    render: (r) =>
      markdown(
        [`name: ${r.name}`, `description: ${r.description}`, 'model: inherit', `readonly: ${r.readonly}`],
        r.instructions,
      ),
  },
  {
    label: 'Gemini CLI',
    requires: '.gemini',
    dir: ['.gemini', 'agents'],
    file: (r) => `${r.name}.md`,
    render: (r) =>
      markdown(
        [`name: ${r.name}`, `description: ${r.description}`, `model: ${r.cheap ? 'flash' : 'inherit'}`],
        r.instructions,
      ),
  },
  {
    label: 'Antigravity',
    requires: path.join('.gemini', 'config'),
    dir: ['.gemini', 'config', 'agents'],
    file: (r) => `${r.name}.md`,
    render: (r) =>
      markdown(
        [`name: ${r.name}`, `description: ${r.description}`, `model: ${r.cheap ? 'flash' : 'inherit'}`, 'subagent: true'],
        r.instructions,
      ),
  },
  {
    label: 'Copilot (VS Code)',
    requires: '.copilot',
    dir: ['.copilot', 'agents'],
    file: (r) => `${r.name}.agent.md`,
    render: (r) =>
      markdown(
        [
          `name: ${r.name}`,
          `description: ${r.description}`,
          ...(r.readonly ? ["tools: ['search/codebase', 'search/usages', 'web/fetch']"] : []),
        ],
        r.instructions,
      ),
  },
];

const BLOCK_START = '<!-- skills-backend-mrydex:start -->';
const BLOCK_END = '<!-- skills-backend-mrydex:end -->';

// Instrucciones globales de usuario: cargar siempre la skill de backend y, en Claude Code y Codex
// (no delegan solos), pedir la delegación en forma explícita. El bloque es autosuficiente: sirve
// aunque no esté instalado el bloque de skills-frontend-mrydex (que repite la sección de graphify).
const DELEGATION_BLOCK = `${BLOCK_START}
## Backend skill (always)

In any repo with \`*.sln\`, \`*.csproj\` or \`Program.cs\` (.NET backend: C#, SQL, appsettings, pipelines, tests), load the \`desarrollo-backend-buenas-practicas\` skill **before your first tool call**, for **every** request: questions, explanations, reviews, debugging and code changes. Even if the request is vague or does not mention .NET. If it is not available as a skill, read its \`SKILL.md\`.

## Graphify first (always, any repo)

Before the first search or file read in a git repo: run \`graphify update .\` (no LLM, no cost), then \`graphify query "<question>"\`. The graph shows where to look for far fewer tokens than Grep/Glob/Read; skip it only when I name the exact file and line. If graphify is missing: \`pip install graphifyy && graphify install\` (outside Claude Code add \`--platform <agent>\`). If it creates \`.gitattributes\` or \`graphify-out/\`, add them to \`.gitignore\`. **After editing any file, run \`graphify update .\` before your final answer.** If something fails, tell me the exact error.

## Agent tools (always)

Installed by skills-backend-mrydex. Use them in every session; if one is missing, install it and tell me in one line (exact error if it fails):

- **ponytail**: write only the code the task needs. Prefer the platform and standard library over new dependencies or abstractions. Before the final answer on a non-trivial code change (\`desarrollo-backend-buenas-practicas\` §13.3), run \`ponytail-review\` on the diff.
- **agent-skills**: use the skill that matches the phase (spec, plan, build, review, ship). In .NET repos tests are part of the work (xUnit + Moq, \`desarrollo-backend-buenas-practicas\` §10.2): any "no test files" rule from the frontend block does not apply here.
- **External skills by area**: besides this skill's rules, load the external skill that matches the area of the task (table in \`desarrollo-backend-buenas-practicas\` §14.9). On conflict, the repo rule wins.
- **claude-code-setup** (Claude Code): in a repo without Claude Code setup, run \`claude-automation-recommender\` once and propose its result.
- **Headroom**: Headroom is wired durably (\`headroom init -g\`) in Claude Code, Copilot CLI and Codex on macOS/Linux; its hooks start the proxy on 127.0.0.1:8787. Codex on Windows, Cursor and VS Code Copilot: start them with \`headroom wrap <agent>\`.
- **Security**: for a vulnerability scan of the code, use the \`claude-security\` plugin (Claude Code); for focused web/API/NuGet checks, the matching Anthropic-Cybersecurity-Skills or claude-red \`offensive-*\` skill. Use \`offensive-*\` only to harden the project's own code against that attack surface (\`desarrollo-backend-buenas-practicas\` §11.6), never against third-party systems.

## Delegation to subagents (explicit, standing user request)

You orchestrate. I explicitly authorize and ask you to delegate to subagents, without waiting for me to ask, **only when it lowers total token usage**:

- Finding where something is when the location is unknown, or reads over 3+ files, big files, logs, \`dotnet build\` / \`dotnet test\` output or web docs: \`investigador\`. Questions like "how does X work in this API" start here.
- Mechanical edits across 8+ files once the approach is decided: \`ejecutor-backend\` (\`ejecutor_backend\` in Codex). Orient with \`graphify query\`, write a short brief (files, pattern, one example), hand it off, then review the diff. For fewer files, edit yourself: in a measured test (3 files), delegating cost 38% more.
- Checking a large diff against the checklists: \`revisor-checklist-backend\` (\`revisor_checklist_backend\` in Codex, cheap).
- Upgrading the target framework or packages, only when I ask for it: \`migrador-dotnet\`, project by project.
- Changes to stored procedures, \`.sql\` scripts, ADO.NET or Dapper queries: \`auditor-sql\`.
- API contract drift with the front (after changing controllers or DTOs): \`auditor-contrato-api\`.
- Changes to auth (JWT, OIDC, identity provider, CORS, LDAP): \`revisor-auth\`.
- Writing missing unit tests when I ask for tests or coverage: \`generador-tests-backend\`.
- Creating or fixing pipelines, Dockerfiles or NuGet publishing: \`operador-pipeline\`.
- Launch independent pieces in parallel.
- Codebase-wide change that splits into 5+ independent units (migrations, a new rule applied to every feature): propose \`/batch <instruction>\` in Claude Code (one background subagent per unit, each in its own worktree; verify with \`dotnet build\` and \`dotnet test\`).
- Rule of thumb: delegate if what you would read is 3x or more what you need to know.
- Name the reason in the brief: big exploration, parallel writers, context backstop, or verifier (a high-risk task, a large diff (3+ files) against the checklist, or a change that matches \`auditor-sql\`, \`revisor-auth\` or \`auditor-contrato-api\` above). No named reason, or in doubt: do it yourself.

Do it yourself when: 1-2 known files, small edits, the brief would cost as much as the work, the task needs conversation context, plain answers, decisions and the final review.
${BLOCK_END}`;

const DELEGATION_FILES = [
  { label: 'Claude Code', requires: '.claude', file: ['.claude', 'CLAUDE.md'] },
  { label: 'Codex', requires: '.codex', file: ['.codex', 'AGENTS.md'] },
  { label: 'Gemini CLI', requires: '.gemini', file: ['.gemini', 'GEMINI.md'] },
];

// Escribe config global del usuario sin riesgo de dejarla a medias: copia la versión previa a
// `<archivo>.bak` y reemplaza con rename (atómico), así un corte deja el archivo viejo o el nuevo.
// Un symlink (dotfiles) se sigue hasta el archivo real: el rename no lo reemplaza por una copia.
function writeFileSafe(linkPath, content) {
  const filePath = fs.existsSync(linkPath) ? fs.realpathSync(linkPath) : linkPath;
  if (fs.existsSync(filePath)) {
    if (fs.readFileSync(filePath, 'utf8') === content) return;
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, filePath);
}

// Inserta o reemplaza el bloque marcado. El resto del archivo no se toca.
function upsertBlock(filePath, block) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  if (start !== -1 && end > start) {
    writeFileSafe(filePath, current.slice(0, start) + block + current.slice(end + BLOCK_END.length));
    return;
  }
  // Un marcador sin su par (editado a mano): reemplazar borraría texto del usuario
  if (start !== -1 || end !== -1) {
    console.log(`  ⚠ ${filePath}: bloque de la skill incompleto, no se actualizó`);
    return;
  }
  let separator = '';
  if (current) separator = current.endsWith('\n') ? '\n' : '\n\n';
  writeFileSafe(filePath, `${current}${separator}${block}\n`);
}

// Lee ~/.claude/settings.json: {} si no existe, null si no es un objeto JSON válido.
function readClaudeSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : null;
  } catch {
    return null;
  }
}

// Claude Code pide aprobación en cada `graphify`; se permite solo ese comando.
const GRAPHIFY_PERMISSIONS = ['Bash(graphify:*)', 'PowerShell(graphify:*)'];

function allowGraphifyInClaude(homeDir, log) {
  const settingsPath = path.join(homeDir, '.claude', 'settings.json');
  const settings = readClaudeSettings(settingsPath);
  if (!settings) {
    log('~/.claude/settings.json no es JSON válido: no se agregaron permisos de graphify');
    return;
  }
  settings.permissions ??= {};
  settings.permissions.allow ??= [];
  const missing = GRAPHIFY_PERMISSIONS.filter((rule) => !settings.permissions.allow.includes(rule));
  if (missing.length === 0) return;
  settings.permissions.allow.push(...missing);
  writeFileSafe(settingsPath, `${JSON.stringify(settings, null, 2)}
`);
  log(`Claude Code: graphify permitido sin aprobación (${missing.join(', ')})`);
}

/**
 * Instala los subagentes y el pedido de delegación en cada agente presente en el home.
 * @param {{ homeDir: string, isDryRun: boolean, only?: string, log: (msg: string) => void }} options
 */
function installSubagents({ homeDir, isDryRun, only, log }) {
  const installed = [];
  for (const target of TARGETS) {
    if (only && target.label !== only) continue;
    if (!fs.existsSync(path.join(homeDir, target.requires))) continue;

    const dir = path.join(homeDir, ...target.dir);
    if (!isDryRun) {
      fs.mkdirSync(dir, { recursive: true });
      for (const role of ROLES) fs.writeFileSync(path.join(dir, target.file(role)), target.render(role));
    }
    installed.push(target.label);
  }

  for (const entry of DELEGATION_FILES) {
    if (only && entry.label !== only) continue;
    if (!fs.existsSync(path.join(homeDir, entry.requires))) continue;
    if (!isDryRun) upsertBlock(path.join(homeDir, ...entry.file), DELEGATION_BLOCK);
  }

  const claudeSelected = !only || only === 'Claude Code';
  if (claudeSelected && fs.existsSync(path.join(homeDir, '.claude')) && !isDryRun) allowGraphifyInClaude(homeDir, log);

  if (installed.length > 0) {
    log(`Subagentes ${ROLES.map((role) => role.name).join(' / ')}: ${installed.join(', ')}`);
  }
}

module.exports = { installSubagents, readClaudeSettings, writeFileSafe };
