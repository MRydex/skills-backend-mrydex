# Changelog

Cambios de la skill `desarrollo-backend-buenas-practicas` y del instalador `skills-backend-mrydex`.
Para actualizar en un proyecto: `npx github:MRydex/skills-backend-mrydex`.

## [Unreleased]

### Instalador

- `-t <ruta>` ya no borra una carpeta con contenido que no es una instalación de la skill (ej. `-t .`).
- `--bridge` no pisa un `CLAUDE.md`, `AGENTS.md` o `.cursorrules` propio del proyecto.
- El bloque de `~/.claude/CLAUDE.md` con un marcador sin su par no se toca (antes podía borrar texto).
- README: árbol de referencias completo.

## [1.14.2] - 2026-10-29

### Skill `desarrollo-backend-buenas-practicas`

- Auditoría de calidad (§13.10, regla 10): suma las áreas Legibilidad y mantenimiento (CA1502 y
  CA1506 en el `.editorconfig`), Escalabilidad e Instrucciones de agentes (`/doctor prompt-audit`:
  reglas para modelos viejos, referencias rotas, contradicciones, `CLAUDE.md` de más de 200
  líneas). Eficiencia prioriza por impacto medido: sin micro-optimizaciones que empeoren la
  legibilidad.
- Chequeo antes de entregar (§13.7.1): forma más simple, aprobaría un staff engineer, qué se
  rompe primero y `tasks/lessons.md` actualizado.
- Bug con evidencia: directo a reproducir y a la causa raíz, sin pedir guía (§13.6).
- Lecciones con línea `Chequeo` para detectar el error antes (§13.8).

### Instalador

- `readClaudeSettings` único para leer `~/.claude/settings.json` (antes, 5 copias). `--doctor`
  ya no falla y los permisos de graphify ya no rompen la instalación si el archivo contiene `null`
  o un array.

## [1.14.1] - 2026-10-29

### Skill `desarrollo-backend-buenas-practicas`

- Auditar = control de calidad completo (§13.10, regla 10): calidad, eficiencia, dependencias,
  código duplicado y sin uso, con tabla de cobertura por área, candidatos verificados contra uso
  dinámico y correcciones en tandas con `dotnet test` en verde.
- "Auditá" a secas corre además la auditoría de seguridad completa (§11.6); solo seguridad corre
  solo §11.6; solo calidad suma la seguridad base.
- Auditoría de seguridad red + blue + network (§11.6): modelo de amenazas, TLS, superficie expuesta,
  servicio a servicio (mTLS), Azure, SignalR, rate limiting y logs; pruebas en vivo solo contra hosts
  autorizados.
- Auditoría de dependencias en la auditoría: corrige vulnerabilidades y reverifica con build, tests y
  la auditoría de nuevo (§11.4, §13.10).
- Unicidad garantizada por el índice `UNIQUE`, no por un chequeo previo (§5.2, §15.6).

### Instalador

- Skills de network y Blue Team (TLS, cabeceras, host header, cache poisoning, WebSocket, nmap,
  rate limiting, mTLS, logs, threat modeling) y `offensive-tls-attacks`, `offensive-network-attacks`,
  `offensive-cloud`.

## [1.14.0] - 2026-10-28

Actualizacion de version

### Skill `desarrollo-backend-buenas-practicas`

- Seguridad (§11.1, §11.2): quién actúa sale solo del token (nunca del body, la query ni la ruta); JWT
  con issuer, audiencia, vencimiento y clave de firma validados, `ValidAudiences` explícitas (incluida
  la del token que reenvía la app que embebe un microfrontend), nunca `ValidateAudience = false`.
- Hubs (§16.4): misma validación del token; audiencia de la app que embebe el microfrontend.
- Checklist de seguridad al día.

## [1.13.0] - 2026-10-27

Primera versión publicada con historial unificado.

### Skill `desarrollo-backend-buenas-practicas`

- `SKILL.md` liviano: Paso 0 (graphify), reglas que más se violan, modo de operación del agente,
  stack e índice de referencias.
- APIs .NET 10 LTS (C# 14) con Clean Architecture; repos en `net8.0` mantienen su TFM.
- Referencias `01`–`16` y `checklists.md`: estructura de la solución, diseño en C#, controllers,
  mediator y handlers, Dapper, validación con FluentValidation, errores con ProblemDetails,
  configuración y secretos, integraciones HTTP con Polly, logging y tests (xUnit + Moq), seguridad
  OWASP, deuda técnica, flujo de trabajo, eficiencia del agente, EF Core 10 y hubs de SignalR.
- Revisión según riesgo (trivial / medio / alto), auditoría de seguridad por áreas (§11.6) y
  auditoría de dependencias (`dotnet list package --vulnerable --include-transitive`).
- Delegación a subagentes solo cuando baja el total de tokens; compactar propuesto al ~30%.

### Instalador

- `npx github:MRydex/skills-backend-mrydex`: skill global (Claude Code, Codex, Antigravity) y en el
  repo; archivos puente `CLAUDE.md`, `AGENTS.md` y `.cursorrules`; entradas de IA en `.gitignore`.
- Graphify (CLI, integración por agente, modo estricto en Claude Code, hooks git y primer grafo), uv
  sin admin cuando falta Python, caveman, subagentes y bloque global en `CLAUDE.md` / `AGENTS.md` /
  `GEMINI.md`.
- Herramientas del agente: Headroom, plugins `claude-code-setup` y `claude-security`, MCP `context7`,
  `permissions.deny` de secretos, skills externas (`security-audit`, ponytail, agent-skills, skills
  de seguridad por área).
- Volver a correrlo actualiza todo lo que instala.
- `--doctor` (chequeo de solo lectura) y `--dry-run`.

### Seguridad

- El instalador no escribe a través de symlinks ni junctions dentro del repo.
