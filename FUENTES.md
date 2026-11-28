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
| .NET, ASP.NET Core y C#: releases y docs de Microsoft | Versión objetivo (hoy .NET 10; .NET 11 STS desde 10/11/2026), APIs nuevas o deprecadas, cambios que rompen entre versiones | `SKILL.md`, `01` a `04`, `06` a `10`, `16`, `17`, `19`, `checklists.md` | 2026-11-27 |
| EF Core, Dapper y acceso a datos SQL | Versión objetivo (hoy EF Core 10; EF Core 11 exige .NET 11), APIs nuevas, cambios que rompen. Pendiente: versión vigente de Dapper (búsquedas contradictorias el 27/11) | `05`, `15`, `18` | 2026-11-27 |
| PostgreSQL y SQL Server: release notes y docs de índices y aislamiento | Features que cambian cómo se indexa o se bloquea (PG 18, SQL Server 2025). | `05`, `15`, `18` | 2026-11-27 |
| Release notes del driver: `dotnet/SqlClient` y Tech Community (SQL Server Blog) | Parches de las líneas 6.1 / 7.0 / 7.1, cambios de comportamiento en TLS (`HostNameInCertificate`), versiones de paquetes hermanos | `11` (§11.4, §11.8), `15`, `08` | 2026-11-27 |
| PostgreSQL: anuncios de seguridad y release notes menores (`postgresql.org/about/news`) | Versiones menores vigentes por línea, fin de vida de mayores (14 ya), pasos posteriores a cada parche, features del mayor nuevo (19) | `11` (§11.8), `05`, `18`, `checklists.md` | 2026-11-27 |
| Npgsql y `Npgsql.EntityFrameworkCore.PostgreSQL` (`npgsql.org` release notes) | Soporte de PG 19 y de .NET 11; avisos de seguridad propios | `05`, `15`, `11` (§11.8) | pendiente (no se pudo leer la página de release notes completa) |
| Paquetes NuGet nombrados en las referencias (mediator, validación, logging, tests, OpenAPI) | Versiones, licencias, reemplazos, deprecados | `04`, `06`, `09`, `10`, `12`, `17`, `20` | 2026-11-25 |
| Avisos de seguridad de .NET y de los paquetes NuGet nombrados (GHSA, CVE) | Versiones mínimas con parche (servicing mensual de .NET, SqlClient, Npgsql, SignalR): tabla de §11.8. Severidad y versión corregida por CVE: `release-notes/<versión>/cve.md` de `dotnet/core`. Pendiente: confirmar contra MSRC cuál de CVE-2026-118741 / CVE-2026-70175 es el aviso de Identity scaffolding | `11` (§11.8), `16`, `20` | 2026-11-27 |
| NuGet.org: auditoría, lock files, staging y campañas de paquetes maliciosos | NuGetAudit, publicación, avisos de Socket / The Hacker News sobre NuGet (paquetes, mecanismo e IoC). Pendiente: nombre de la clave de antigüedad mínima de publicación de NuGet (.NET 11) en `learn.microsoft.com`; no escribirla en la skill antes | `11` (§11.4), `20` | 2026-11-26 |
| [OWASP API Security Top 10](https://owasp.org/www-project-api-security/) | Si sale una edición posterior a 2023 | `11` | 2026-11-25 |
| [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | Solo la guía de seguridad (headers, CORS, cookies): cambios desde el último repaso | `11` (§11.2) | 2026-11-25 |
| Seguridad: feed `radar.cloudflare.com/zero-wire/rss`, cloudflare/security-audit-skill | Que el feed siga vivo, reglas nuevas | `11` | 2026-11-25 |
| Skills externas: cada repo de `EXTERNAL_SKILLS` en `bin/cli.js` (caveman, cloudflare/security-audit-skill, mukul975/Anthropic-Cybersecurity-Skills, SnailSploit/claude-red, DietrichGebert/ponytail, addyosmani/agent-skills) | Skills nuevas, renombradas o quitadas; cambios en cómo se instalan | `bin/cli.js`, `14` (§14.9), `README.md`, `templates/` | 2026-11-25 |
| Plugins de Claude Code: `caveman@caveman`, `claude-code-setup` y `claude-security` de anthropics/claude-plugins-official | Nombres, comandos, skills que traen (`UNUSED_SKILLS`) | `bin/cli.js`, `14`, `templates/` | 2026-11-25 |
| Herramientas: graphify (PyPI `graphifyy`), context7 (MCP), uv | Comandos de instalación, flags, cambios que rompen | `bin/cli.js`, `14`, `templates/` | 2026-11-25 |
| Docs de agentes: Claude Code (sub-agents, advisor), platform.claude.com (advisor tool, multiagent), guía de modelos de claude.dev, Codex, Cursor, OpenCode, Gemini CLI, Antigravity, Copilot | Formato de subagentes y de instrucciones por agente, modelos vigentes | `14`, `templates/`, `bin/cli.js` | 2026-11-25 |
| Pipelines y publicación: Azure DevOps YAML, Docker, NuGet | Tareas y versiones de imagen vigentes | `20` | 2026-11-25 |
| [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient) | Reglas nuevas en `CLAUDE.md` y `profiles/`, resultados de `benchmark/`. Solo sirve lo que el benchmark mide con efecto; descartados: hook `PreCompact`, presupuesto de tool calls, reglas de formato | `11` (§11.4), `14` | 2026-11-25 |
| Repo hermano `skills-frontend-mrydex` | Lo común (instalador, `14`, `templates/`, bloque global) igual en los dos | `bin/cli.js`, `14`, `templates/` | 2026-11-25 |
