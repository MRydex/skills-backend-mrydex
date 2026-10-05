# Changelog

Cambios de la skill `desarrollo-backend-buenas-practicas` y del instalador `skills-backend-mrydex`.
Para actualizar en un proyecto: `npx github:MRydex/skills-backend-mrydex`.

## [Unreleased]

### Agregado
- El instalador instala global la skill `security-audit` de Cloudflare
  (`npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global`).
  Flag `--no-security-audit` para omitirla.
- `references/11-security.md` §11.5: cuándo usar la skill (modo guía en cada revisión, auditoría
  completa solo a pedido) y qué hacer con los hallazgos. Ítem nuevo en `checklists.md`.
- `references/14-agent-efficiency.md` §14.3.4.1: `/batch` de Claude Code para cambios grandes y
  paralelizables (un agente por unidad en su worktree, revisión del modelo fuerte antes de mergear).
- `references/02-csharp-design.md`: features de C# 13/14 (`field`, asignación null-condicional,
  `Lock`, `params` de colecciones, bloques `extension`), solo sobre `net10.0`.

### Seguridad
- El instalador ya no escribe a través de symlinks ni junctions dentro del repo (`CLAUDE.md`,
  `AGENTS.md`, `.cursorrules`, `.gitignore`, `skills/`, `.agents/`). Un repo ajeno podía usarlos para
  pisar o borrar archivos del usuario fuera del repo. Ahora se omiten con un aviso.

### Cambiado
- Stack base: **.NET 10 LTS** (`net10.0`), C# 14, paquetes `Microsoft.*` 10.x y EF Core 10. Repos
  que siguen en `net8.0` mantienen su TFM y sus paquetes 8.x; migrar solo con pedido explícito.
- OpenAPI con `Microsoft.AspNetCore.OpenApi` (OpenAPI 3.1) + Swagger UI; Swashbuckle solo donde ya existe.
- `references/15-data-access-ef-core.md`: EF Core 10 (`LeftJoin`, `ExecuteUpdateAsync` con lambda,
  filtros de consulta con nombre).

## [1.2.0] - 2026-10-02

### Agregado
- `references/15-data-access-ef-core.md`: EF Core 8 y LINQ para repos que ya usan `DbContext`
  (registro, Fluent API, consultas con `AsNoTracking` + proyección, N+1, `FromSql` seguro,
  `SaveChangesAsync` vía `IUnitOfWork`, `ExecuteUpdate`/`ExecuteDelete`, concurrencia, migraciones
  idempotentes, LINQ en memoria, tests). Bloque propio en `checklists.md` y en los archivos puente.

### Cambiado
- Sin datos de la empresa: nombres internos (paquetes, bases, servicios, repo de referencia,
  pipelines) reemplazados por placeholders (`Corp.*`, `ICorpLoggerHandler`, `MainDb`,
  `AddApplicationServices`). La deuda técnica ya no nombra el repo ni sus identificadores.

## [1.1.0] - 2026-10-02

### Cambiado
- `SKILL.md` queda como entrada liviana (Paso 0, 8 reglas, modo de operación, stack, índice, Do & Don't).
  Cada sección §1–§12 pasa a su propio archivo en `references/` (`01-solution-structure.md` …
  `12-tech-debt.md`), con el mismo número: los `§N` siguen siendo válidos.
- Checklists en `references/checklists.md`, ordenados por área con link a su referencia.
- Archivos puente (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`): cada regla apunta a su referencia;
  `AGENTS.md` suma un mapa tarea → referencia.
- `revisor-checklist-backend` revisa contra `references/checklists.md` y `references/11-security.md`.

## [1.0.0] - 2026-10-02

### Agregado
- Skill `desarrollo-backend-buenas-practicas` para APIs .NET 8 con Clean Architecture (`SKILL.md` §0–§12).
- Instalador `npx github:MRydex/skills-backend-mrydex`, portado de `skills-frontend-mrydex`:
  - Skill global en Claude Code y Antigravity; en un repo, también en `.agents/skills/` y `skills/`.
  - Archivos puente `CLAUDE.md`, `AGENTS.md` y `.cursorrules` con las reglas de .NET.
  - Graphify: instala el CLI, integra todos los agentes, Claude Code en modo estricto, hooks git y
    primer grafo.
  - Entradas de IA en el `.gitignore` del proyecto.
  - Plugin caveman en los agentes detectados.
  - Subagentes `investigador`, `ejecutor-backend` y `revisor-checklist-backend`, y bloque global
    marcado `skills-backend-mrydex` en `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` y
    `~/.gemini/GEMINI.md`.
- Referencias de proceso del agente, adaptadas de la skill de frontend:
  - `references/13-workflow-orchestration.md`: verificación con `dotnet build` / `dotnet test`,
    sin sobreingeniería en .NET, `.gitignore` de IA.
  - `references/14-agent-efficiency.md`: consulta de librerías por feed privado, NuGet local y
    Microsoft Learn.
- Auditoría de dependencias obligatoria (`SKILL.md` §11.4) con
  `dotnet list package --vulnerable --include-transitive`.
- Índice de referencias y checklist de proceso del agente en `SKILL.md`.
