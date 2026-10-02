# Skills-backend-mrydex 🚀

> **Skill universal de backend .NET 8 (ASP.NET Core + Clean Architecture) para Agentes de IA.**  
> Compatible con **Google Antigravity**, **Claude Code**, **Cursor**, **Windsurf**, **GitHub Copilot**, **Codex** y cualquier agente que soporte el estándar de Agent Skills o archivos de contexto.  
> **Distribuido directamente vía GitHub sin intermediarios.**

Hermana de [skills-frontend-mrydex](https://github.com/MRydex/skills-frontend-mrydex): mismo instalador,
mismas reglas de trabajo del agente (caveman, graphify, subagentes, autocompactación), convenciones
de código para .NET.

---

## 📦 Instalación y Actualización desde Cualquier PC

Requisito: Node.js 18+ (para `npx`). Python 3.10+ para graphify (si falta, el instalador avisa y sigue).

### 1. Instalación Rápida (Recomendada)
Ejecuta en tu terminal desde cualquier directorio o, mejor, dentro del repo .NET:
```bash
# Modo interactivo (te preguntará qué agente usas y dónde instalarlo):
npx github:MRydex/skills-backend-mrydex
```

### 2. Comandos Directos por Agente

```bash
# Para Google Antigravity (instalación global):
npx github:MRydex/skills-backend-mrydex --agent antigravity --global

# Para Claude Code (instalación global):
npx github:MRydex/skills-backend-mrydex --agent claude --global

# Para el Proyecto Actual (configura todos los agentes a la vez con puentes AGENTS/CLAUDE/Cursor):
npx github:MRydex/skills-backend-mrydex --agent all --workspace --bridge
```

### 3. Instalación Global con NPM
Si prefieres tener el comando `skills-backend` siempre disponible en tu terminal:
```bash
npm install -g github:MRydex/skills-backend-mrydex

# Luego solo ejecutas:
skills-backend
```

---

## 🔄 ¿Cómo Actualizar cuando hayan cambios en el repositorio?

El comando es **exactamente el mismo**. El instalador detecta si el skill ya está instalado, elimina
archivos viejos y copia la última versión:

```bash
npx github:MRydex/skills-backend-mrydex

# Si npx usa una copia en caché, especifica la rama:
npx github:MRydex/skills-backend-mrydex#main
```

Si lo habías instalado con `npm install -g`:
```bash
npm install -g github:MRydex/skills-backend-mrydex
skills-backend
```

---

## 🤖 Compatibilidad Multi-Agente

| Agente de IA | Ubicación de Instalación | Comando Rápido |
| :--- | :--- | :--- |
| **Google Antigravity** | `~/.gemini/config/skills/desarrollo-backend-buenas-practicas` o `.agents/skills/` | `npx github:MRydex/skills-backend-mrydex -a antigravity -g` |
| **Claude Code** | `~/.claude/skills/desarrollo-backend-buenas-practicas` | `npx github:MRydex/skills-backend-mrydex -a claude -g` |
| **Cursor / Windsurf** | `skills/` + `.cursorrules` en la raíz del proyecto | `npx github:MRydex/skills-backend-mrydex -a cursor -b` |
| **GitHub Copilot / Codex** | `skills/` + `AGENTS.md` en la raíz del proyecto | `npx github:MRydex/skills-backend-mrydex -a universal -b` |
| **Todos los agentes** | Configura entornos globales y puentes locales a la vez | `npx github:MRydex/skills-backend-mrydex -a all -w -b` |

### Qué deja configurado el instalador

Al instalar en un proyecto, el instalador deja todo listo para cualquier agente, sin depender de que
el agente siga las instrucciones:

1. Instala o actualiza graphify (`pip install --upgrade graphifyy`, con fallback a `python -m pip`,
   `py -m pip` y `uv`) y su skill global.
2. Integra graphify en todos los agentes: Claude Code, Cursor, Codex, Gemini CLI, Copilot en VS Code y
   Antigravity. Claude Code queda en **modo estricto**: bloquea la primera lectura de archivos hasta
   que se consulte el grafo.
3. Instala los hooks git `post-commit` y `post-checkout`, que actualizan el grafo en cada commit.
4. Agrega todos los archivos de IA y agentes al `.gitignore`.
5. Subagentes `investigador`, `ejecutor-backend` y `revisor-checklist-backend` en el formato de cada
   agente instalado (Claude Code, Codex, Cursor, Gemini CLI, Antigravity, Copilot). `investigador` es
   el mismo de la skill de frontend; los otros dos llevan sufijo para no pisar los de frontend. En
   Claude Code y Codex, que no delegan solos, agrega un bloque a `~/.claude/CLAUDE.md` /
   `~/.codex/AGENTS.md` que pide delegar **solo cuando baja el total de tokens**. El mismo bloque
   (también en `~/.gemini/GEMINI.md`) pide cargar siempre la skill en cualquier repo .NET.
6. En Claude Code permite `graphify` sin aprobación (`Bash(graphify:*)`, `PowerShell(graphify:*)`).
7. Instala el plugin **caveman** con su instalador oficial en los agentes detectados y, dentro de un
   repo, sus reglas siempre activas (`--with-init`). En Claude Code lo activa en
   `~/.claude/settings.json`. Medido: sin el plugin las respuestas salen 33% más largas.
   `--no-caveman` lo saltea.
8. Arma el grafo con `graphify update .` (solo código, sin LLM, sin costo de tokens).

Fuera de un repo git se instala **solo global** (skill + CLI de graphify), sin tocar la carpeta actual.
Dentro de un repo (o una subcarpeta) instala además en la raíz del repo. Para saltear graphify:
`--no-graphify`.

Si ya tenés instalada la skill de frontend, se pueden usar las dos: cada una escribe su propio bloque
marcado (`skills-frontend-mrydex:*` / `skills-backend-mrydex:*`) y no pisa el de la otra.

---

## 🛠️ Opciones y Flags del CLI

```bash
skills-backend [opciones]

Opciones:
  -a, --agent <nombre>    antigravity | claude | cursor | universal | all
  -g, --global            Instalación global en el directorio home del usuario
  -w, --workspace         Instalación en la raíz del proyecto actual
  -t, --target <ruta>     Ruta personalizada donde copiar los archivos del skill
  -b, --bridge            Copia archivos puente (AGENTS.md, CLAUDE.md, .cursorrules)
  --no-caveman            No instala el plugin caveman
  --no-graphify           No instala ni configura graphify
  --dry-run               Muestra qué se instalaría sin escribir cambios en disco
  -v, --version           Muestra la versión instalada
  -h, --help              Muestra la ayuda
```

---

## 📂 Estructura Modular del Skill

```text
skills/desarrollo-backend-buenas-practicas/
├── SKILL.md                          # Paso 0, 8 reglas, modo de operación, stack (§0), índice, Do & Don't
└── references/
    ├── 01-solution-structure.md      # Capas, dónde va cada cosa, naming, límites de tamaño
    ├── 02-csharp-design.md           # Primary constructors, records, nullable, async, fechas, decimal
    ├── 03-controllers.md             # Controllers delgados, rutas, roles, ProducesResponseType
    ├── 04-mediator-handlers.md       # Requests record, handlers internal, mediator del equipo
    ├── 05-data-access-dapper.md      # DbSession / UnitOfWork, SQL parametrizado, SP, bulk, cache
    ├── 06-validation.md              # FluentValidation + Guard, paginado, rangos
    ├── 07-errors-responses.md        # Excepciones tipadas, IExceptionHandler, ProblemDetails
    ├── 08-configuration-di-secrets.md# Options + ValidateOnStart, DI por capa, Key Vault
    ├── 09-http-integrations.md       # Typed HttpClient, Polly, timeouts, certificados
    ├── 10-logging-tests.md           # ICorpLoggerHandler, datos prohibidos, xUnit + Moq
    ├── 11-security.md                # Red Team / Blue Team, reglas fijas, auditoría de dependencias
    ├── 12-tech-debt.md               # Deuda conocida: no copiar, no arreglar sin pedido
    ├── 13-workflow-orchestration.md  # Explorar, planificar, verificar, commits, alcance, lecciones, .gitignore
    ├── 14-agent-efficiency.md        # Caveman, advisor multi-agente, autocompact, graphify, adaptación
    ├── 15-data-access-ef-core.md     # EF Core 8 y LINQ: consultas, escrituras, migraciones (repos con DbContext)
    └── checklists.md                 # Checklists por área + proceso del agente
```

**Progressive disclosure:** el agente lee `SKILL.md` (~190 líneas) y solo la referencia que pide la
tarea. Los `§N` de la skill coinciden con el número del archivo (`§5.2` → `05-data-access-dapper.md`).

---

## 👩‍💻 Para el Desarrollador: Cómo Publicar Cambios

No hace falta cuenta en npmjs.com ni `npm publish`:

1. Modificá lo que necesites en `skills/desarrollo-backend-buenas-practicas/`.
2. *(Opcional)* Subí la versión (también sincroniza el `version:` de `SKILL.md`):
   ```bash
   npm version minor
   ```
3. Subí a GitHub:
   ```bash
   git push origin main --follow-tags
   ```

Cualquiera que vuelva a correr `npx github:MRydex/skills-backend-mrydex` obtiene los cambios.

---

## 📄 Licencia

MIT © [MRydex](https://github.com/MRydex)
