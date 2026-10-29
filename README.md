# skills-backend-mrydex

Skill de backend .NET 10 (ASP.NET Core + Clean Architecture) para agentes de IA: Claude Code, Codex,
Cursor, Windsurf, GitHub Copilot, Google Antigravity y cualquier agente compatible con Agent Skills.
Se instala directo desde GitHub.

Hermana de [skills-frontend-mrydex](https://github.com/MRydex/skills-frontend-mrydex): mismo
instalador y mismas reglas de trabajo del agente. Las dos conviven sin pisarse.

## Instalar y actualizar

Requisitos: Node.js 18+. Python 3.10+ para graphify (si falta, el instalador avisa y sigue).

```bash
# Interactivo (pregunta agente y destino). Mejor dentro del repo .NET
npx github:MRydex/skills-backend-mrydex

# Si da error:
npx --allow-git github:MRydex/skills-backend-mrydex

# Y luego nuevamente:
npx github:MRydex/skills-backend-mrydex

# Todos los agentes en el proyecto actual
npx github:MRydex/skills-backend-mrydex -a all -w -b

# Solo global, un agente
npx github:MRydex/skills-backend-mrydex -a claude -g
```

Para actualizar, correr el mismo comando. Borra los archivos viejos y copia la última versión.
Si `npx` usa una copia en caché, agregar `#main` al final.

Comando fijo en la terminal (opcional): `npm install -g github:MRydex/skills-backend-mrydex`,
después `skills-backend`.

## Dónde se instala

| Agente | Ubicación | Flag |
| :--- | :--- | :--- |
| Claude Code | `~/.claude/skills/desarrollo-backend-buenas-practicas` | `-a claude` |
| Antigravity | `~/.gemini/config/skills/` o `.agents/skills/` | `-a antigravity` |
| Cursor / Windsurf | `skills/` + `.cursorrules` | `-a cursor -b` |
| Codex | `~/.agents/skills/desarrollo-backend-buenas-practicas` + `AGENTS.md` | `-a codex` |
| Copilot | `skills/` + `AGENTS.md` | `-a universal -b` |
| Todos | Global + puentes en el repo | `-a all -w -b` |

Fuera de un repo git instala solo global. Dentro de un repo instala además en la raíz.

## Qué configura

- **graphify**: CLI y skill, integración en cada agente, hooks git `post-commit` / `post-checkout`
  y grafo inicial (`graphify update .`, sin costo de tokens). Claude Code queda en modo estricto:
  consulta el grafo antes de leer archivos, y corre `graphify` sin pedir aprobación.
- **Subagentes** `investigador`, `ejecutor-backend` y `revisor-checklist-backend` en el formato de
  cada agente. `investigador` es el mismo de frontend; los otros llevan sufijo para no pisarse.
  Bloque global en `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` y `~/.gemini/GEMINI.md`: cargar
  siempre la skill en repos .NET y delegar solo cuando baja el total de tokens.
- **caveman**: respuestas cortas (sin él salen 33% más largas).
- **Seguridad** (§11.6): [security-audit](https://github.com/cloudflare/security-audit-skill),
  9 skills de [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
  y 19 `offensive-*` de [claude-red](https://github.com/SnailSploit/claude-red), solo de APIs, auth y
  supply chain. Plugin `claude-security` en Claude Code.
- **Claude Code, extras** (cada uno solo si el usuario no lo configuró antes):
  - `permissions.deny` para que el agente no lea secretos (`~/.ssh`, `.env*`, `*.pem`, `*.key`...).
  - MCP [Context7](https://github.com/upstash/context7) (docs vigentes de librerías, gratis).
  - Subagentes con `effort` (`low` el revisor, `medium` el resto).
- **`.gitignore`**: agrega los archivos de IA y agentes.

## Opciones

```text
-a, --agent <nombre>   antigravity | claude | codex | cursor | universal | all
-g, --global           Instala en el home del usuario
-w, --workspace        Instala en la raíz del proyecto actual
-t, --target <ruta>    Ruta personalizada
-b, --bridge           Copia AGENTS.md, CLAUDE.md y .cursorrules
--dry-run              Muestra qué haría, sin escribir
--doctor               Chequea qué está instalado, sin escribir nada
-v, --version          Versión
-h, --help             Ayuda
```

## Contenido

El agente lee `SKILL.md` y solo la referencia que pide la tarea. Cada `§N` es el número del archivo
(`§5.2` está en `05-data-access-dapper.md`).

```text
skills/desarrollo-backend-buenas-practicas/
├── SKILL.md                           # Reglas clave, modo de operación, stack
└── references/
    ├── 01-solution-structure.md       # Capas, naming, límites de tamaño
    ├── 02-csharp-design.md            # Primary constructors, records, async
    ├── 03-controllers.md              # Controllers delgados, rutas, roles
    ├── 04-mediator-handlers.md        # Requests, handlers, mediator
    ├── 05-data-access-dapper.md       # DbSession, SQL parametrizado, cache
    ├── 06-validation.md               # FluentValidation + Guard
    ├── 07-errors-responses.md         # Excepciones, ProblemDetails
    ├── 08-configuration-di-secrets.md # Options, DI, Key Vault
    ├── 09-http-integrations.md        # HttpClient, Polly, timeouts
    ├── 10-logging-tests.md            # Logging, xUnit + Moq
    ├── 11-security.md                 # Red / Blue Team, dependencias
    ├── 12-tech-debt.md                # Deuda conocida: no copiar
    ├── 13-workflow-orchestration.md   # Explorar, planificar, verificar
    ├── 14-agent-efficiency.md         # Caveman, subagentes, graphify
    ├── 15-data-access-ef-core.md      # EF Core 10 y LINQ
    └── checklists.md                  # Checklists por área
```

## Publicar cambios

No hace falta npm publish.

1. Editar `skills/desarrollo-backend-buenas-practicas/`.
2. Opcional: `npm version minor` (sincroniza también el `version:` de `SKILL.md`).
3. `git push origin main --follow-tags`.

Quien vuelva a correr `npx` recibe los cambios.

## Licencia

MIT © [MRydex](https://github.com/MRydex)
