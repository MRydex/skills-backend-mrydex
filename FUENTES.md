# Fuentes a repasar en "revisar y actualizar" (skills-backend-mrydex)

Cuando el pedido es revisar, actualizar o poner al día la skill o el instalador, se repasan **todas** las filas,
no solo las que el pedido nombra.

Por cada fila:

1. Mirar qué cambió en la fuente desde la fecha de "Último repaso".
2. Volcar a la referencia solo lo que falta y sirve en una API .NET. Como texto, sin instalar nada nuevo.
3. Anotar el cambio en `CHANGELOG.md`.
4. Poner la fecha de hoy en "Último repaso".

Al terminar, decir qué filas se repasaron y cuáles no, con el motivo. Si aparece una fuente nueva, sumar su fila acá.

| Fuente | Qué mirar | Dónde impacta | Último repaso |
|---|---|---|---|
| .NET, ASP.NET Core y C#: releases y docs de Microsoft | Versión objetivo (hoy .NET 10; .NET 11 STS desde 10/11/2026), APIs nuevas o deprecadas, cambios que rompen entre versiones | `SKILL.md`, `01` a `04`, `06` a `10`, `16`, `17`, `19`, `checklists.md` | 2026-11-28 |
| EF Core, Dapper y acceso a datos SQL | Versión objetivo (hoy EF Core 10; EF Core 11 exige .NET 11), APIs nuevas, cambios que rompen. Dapper: 2.1.100 (20/11/2026; `net10.0`, `net8.0`, `netstandard2.0`, `net461`), Dapper.AOT 1.1.0 estable; leer la versión de `api.nuget.org/v3-flatcontainer/dapper/index.json` | `05`, `15`, `18` | 2026-11-28 |
| PostgreSQL y SQL Server: release notes y docs de índices y aislamiento | Features que cambian cómo se indexa o se bloquea (PG 18, SQL Server 2025). | `05`, `15`, `18` | 2026-11-28 |
| Release notes del driver: `dotnet/SqlClient` y Tech Community (SQL Server Blog) | Parches de las líneas 6.1 / 7.0 / 7.1 y mayor 8.0 (26/11/2026), cambios de comportamiento en TLS (`HostNameInCertificate`), versiones de paquetes hermanos | `11` (§11.4, §11.8), `15`, `08` | 2026-11-28 |
| PostgreSQL: anuncios de seguridad y release notes menores (`postgresql.org/about/news`) | Versiones menores vigentes por línea, fin de vida de mayores (14 ya), pasos posteriores a cada parche, features del mayor nuevo (19) | `11` (§11.8), `05`, `18`, `checklists.md` | 2026-11-28 |
| Npgsql y `Npgsql.EntityFrameworkCore.PostgreSQL` (`npgsql.org` release notes) | Soporte de PG 19 (al 28/11 las release notes de 11.0 no lo nombran) y de .NET 11 (11.0.0: provider de EF solo `net11.0`); parches por línea (8.0.9, 9.0.5, 10.0.4, 11.0.0); avisos de seguridad propios (ninguno en 2026) | `05`, `15`, `11` (§11.8) | 2026-11-28 |
| Paquetes NuGet nombrados en las referencias (mediator, validación, logging, tests, OpenAPI) | Versiones, licencias, reemplazos, deprecados | `04`, `06`, `09`, `10`, `12`, `17`, `20` | 2026-11-28 |
| Avisos de seguridad de .NET y de los paquetes NuGet nombrados (GHSA, CVE) | Versiones mínimas con parche (servicing mensual de .NET, SqlClient, Npgsql, SignalR): tabla de §11.8. Severidad y versión corregida por CVE: `release-notes/<versión>/cve.md` de `dotnet/core`. También los issues de `dotnet/announcements` (uno por CVE) | `11` (§11.8), `16`, `20` | 2026-11-28 |
| NuGet.org: auditoría, lock files, staging y campañas de paquetes maliciosos | NuGetAudit, publicación, avisos de Socket / The Hacker News sobre NuGet (paquetes, mecanismo e IoC). Antigüedad mínima de publicación: `minPublishAgeHours` (spec `NuGet/Home` `accepted/2026/package-update-cooldown.md`). Pendiente: versión de NuGet / SDK que lo trae y si restore empieza a verificarlo | `11` (§11.4), `20` | 2026-11-28 |
| [OWASP API Security Top 10](https://owasp.org/www-project-api-security/) | Si sale una edición posterior a 2023 | `11` | 2026-11-28 |
| [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | Solo la guía de seguridad (headers, CORS, cookies): cambios desde el último repaso | `11` (§11.2) | 2026-11-28 |
| Seguridad: feed `radar.cloudflare.com/zero-wire/rss`, cloudflare/security-audit-skill | Que el feed siga vivo, reglas nuevas | `11` | 2026-11-28 |
| Skills externas: cada repo de `EXTERNAL_SKILLS` en `bin/cli.js` (caveman, cloudflare/security-audit-skill, mukul975/Anthropic-Cybersecurity-Skills, SnailSploit/claude-red, DietrichGebert/ponytail, addyosmani/agent-skills) | Skills nuevas, renombradas o quitadas; cambios en cómo se instalan | `bin/cli.js`, `14` (§14.9), `README.md`, `templates/` | 2026-11-28 |
| Plugins de Claude Code: `caveman@caveman`, `claude-code-setup` y `claude-security` de anthropics/claude-plugins-official | Nombres, comandos, skills que traen (`UNUSED_SKILLS`) | `bin/cli.js`, `14`, `templates/` | 2026-11-28 |
| Herramientas: graphify (PyPI `graphifyy`), context7 (MCP), uv | Comandos de instalación, flags, cambios que rompen | `bin/cli.js`, `14`, `templates/` | 2026-11-28 |
| Docs de agentes: Claude Code (sub-agents, advisor), platform.claude.com (advisor tool, multiagent), guía de modelos de claude.dev, Codex, Cursor, OpenCode, Gemini CLI, Antigravity, Copilot | Formato de subagentes y de instrucciones por agente, modelos vigentes | `14`, `templates/`, `bin/cli.js` | 2026-11-28 |
| Pipelines y publicación: Azure DevOps YAML, Docker, NuGet | Tareas y versiones de imagen vigentes | `20` | 2026-11-28 |
| [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient) | Reglas nuevas en `CLAUDE.md` y `profiles/`, resultados de `benchmark/`. Solo sirve lo que el benchmark mide con efecto; descartados: hook `PreCompact`, presupuesto de tool calls, reglas de formato | `11` (§11.4), `14` | 2026-11-28 |
| Repo hermano `skills-frontend-mrydex` | Lo común (instalador, `14`, `templates/`, bloque global) igual en los dos | `bin/cli.js`, `14`, `templates/` | 2026-11-28 |
