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
| .NET, ASP.NET Core y C#: releases y docs de Microsoft | Versión objetivo (hoy .NET 10), APIs nuevas o deprecadas, cambios que rompen entre versiones | `SKILL.md`, `01` a `04`, `06` a `10`, `16`, `17`, `19`, `checklists.md` | sin fecha |
| EF Core, Dapper y acceso a datos SQL | Versión objetivo (hoy EF Core 10), APIs nuevas, cambios que rompen | `05`, `15`, `18` | sin fecha |
| Paquetes NuGet nombrados en las referencias (mediator, validación, logging, tests, OpenAPI) | Versiones, licencias, reemplazos, deprecados | `04`, `06`, `10`, `17`, `20` | sin fecha |
| Avisos de seguridad de .NET y de los paquetes NuGet nombrados (GHSA, CVE) | Versiones mínimas con parche | `11`, `20` | sin fecha |
| [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | Solo la guía de seguridad (headers, CORS, cookies): cambios desde el último repaso | `11` (§11.2) | 2026-11-11 |
| Seguridad: feed `radar.cloudflare.com/zero-wire/rss`, cloudflare/security-audit-skill | Que el feed siga vivo, reglas nuevas | `11` | sin fecha |
| Skills externas: cada repo de `EXTERNAL_SKILLS` en `bin/cli.js` (caveman, cloudflare/security-audit-skill, mukul975/Anthropic-Cybersecurity-Skills, SnailSploit/claude-red, DietrichGebert/ponytail, addyosmani/agent-skills) | Skills nuevas, renombradas o quitadas; cambios en cómo se instalan | `bin/cli.js`, `14` (§14.9), `README.md`, `templates/` | sin fecha |
| Plugins de Claude Code: `caveman@caveman`, `claude-code-setup` y `claude-security` de anthropics/claude-plugins-official | Nombres, comandos, skills que traen (`UNUSED_SKILLS`) | `bin/cli.js`, `14`, `templates/` | sin fecha |
| Herramientas: graphify (PyPI `graphifyy`), context7 (MCP), uv | Comandos de instalación, flags, cambios que rompen | `bin/cli.js`, `14`, `templates/` | sin fecha |
| Docs de agentes: Claude Code (sub-agents, advisor), platform.claude.com (advisor tool, multiagent), guía de modelos de claude.dev, Codex, Cursor, OpenCode, Gemini CLI, Antigravity, Copilot | Formato de subagentes y de instrucciones por agente, modelos vigentes | `14`, `templates/`, `bin/cli.js` | sin fecha |
| Pipelines y publicación: Azure DevOps YAML, Docker, NuGet | Tareas y versiones de imagen vigentes | `20` | sin fecha |
| Repo hermano `skills-frontend-mrydex` | Lo común (instalador, `14`, `templates/`, bloque global) igual en los dos | `bin/cli.js`, `14`, `templates/` | sin fecha |
