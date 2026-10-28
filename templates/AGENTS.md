# Agent Guidelines (AGENTS.md)

This project strictly follows the **.NET 10 Backend Best Practices** defined in the project skills:

👉 **Skill Entrypoint**: [`skills/desarrollo-backend-buenas-practicas/SKILL.md`](./skills/desarrollo-backend-buenas-practicas/SKILL.md) (or [`.agents/skills/desarrollo-backend-buenas-practicas/SKILL.md`](./.agents/skills/desarrollo-backend-buenas-practicas/SKILL.md))

**How to load it (any agent):** at the start of every coding session, read `SKILL.md` fully. Then read only the `references/*.md` file (and section) that matches the current task, as listed in its reference index. Do not load all references at once.

## Reference map

| Task | Reference |
| :--- | :--- |
| New files, folders, naming, size limits | `references/01-solution-structure.md` |
| Any C# code | `references/02-csharp-design.md` |
| Endpoint | `references/03-controllers.md` |
| Use case (request + handler) | `references/04-mediator-handlers.md` |
| Request / Response naming and mapping | `references/01-solution-structure.md` §1.2 |
| Repository, SQL, transactions, cache | `references/05-data-access-dapper.md` |
| Repository, LINQ, migrations (EF Core repos) | `references/15-data-access-ef-core.md` |
| Input validation | `references/06-validation.md` |
| Errors and responses | `references/07-errors-responses.md` |
| `Program.cs`, `appsettings`, DI, secrets | `references/08-configuration-di-secrets.md` |
| External HTTP integration | `references/09-http-integrations.md` |
| Logging and tests | `references/10-logging-tests.md` |
| Security review and dependency audit | `references/11-security.md` |
| Touching existing code | `references/12-tech-debt.md` |
| Any non-trivial task | `references/13-workflow-orchestration.md` |
| Delegating, compacting, graphify | `references/14-agent-efficiency.md` |
| Before delivering / reviewing a diff | `references/checklists.md` |

## Golden Rules
1. **Thin controllers** (03): One action = receive the request, `await mediator.Send(request, cancellationToken)`, map to `ActionResult`. Never business logic, SQL, `try/catch` or validation in a controller. Every action has `[RoleAuthorization(...)]`.
2. **`CancellationToken` end to end** (03, 05): action → `mediator.Send` → handler → repository (`CommandDefinition`) → `HttpClient`. Never `CancellationToken.None` inside a request.
3. **Never SQL concatenated with input** (05, 15, 11): Always parameters or `Dapper.SqlBuilder`. Dynamic `ORDER BY` / column names only from a whitelist.
4. **Validate before touching data** (06): Every write request has its `AbstractValidator<TRequest>`; the handler calls `Guard.AgainstInvalidSpecification(validator, request)` first. Messages from `ErrorMessage`.
5. **Typed exceptions, `ProblemDetails` responses** (07): Never `BadRequest("text")`, empty `catch`, or `ex.Message` / stack trace to the client.
6. **Transactions only through `IUnitOfWork`** (05): Never open `SqlConnection` / `SqlTransaction` by hand in a handler.
7. **Never secrets in code or `appsettings*.json`** (08, 10): the value comes from Azure Key Vault. Never log tokens, connection strings, full CBU/CVU/CUIT or PII.
8. **No monolithic files, no crossed layers** (01): One class per file. Max 150 lines per controller or handler, 250 per repository, 300 per class.
9. **Security always** (11): Red Team review (§11.1) of every change. Dependency audit with `dotnet list package --vulnerable --include-transitive` when starting, after any package change and before delivering if the task touched packages; flag `High`/`Critical`, never bump a major version without asking (§11.4). Never disable protections. Report every vulnerability found, even out of scope. **When asked for security** ("audit this", "is it safe?"): run §11.6, which reviews every security area (each one OK / finding / N/A) and goes deeper with that area's skill (`offensive-*`, Anthropic-Cybersecurity-Skills, Cloudflare `security-audit`, `claude-security`) where there is a finding, the area is sensitive or the scope is large.
10. **Tests** (10): xUnit + Moq, `<Method>_When<Condition>_Should<Result>`. Before "done": `dotnet build` without new warnings; from medium risk, `dotnet test` of the UnitTest project green (§13.3). If it could not run, say so.
11. **Known tech debt** (12): Never copy it into new code, never fix it out of scope; report it in one line.
12. **No over-engineering** (13 §13.7.1): Simplest solution that solves today's request. No generic repository, AutoMapper, MediatR, `Result<T>`, layers or packages "just in case".
13. **AI files in `.gitignore`** (13 §13.9): exclude `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `graphify-out/`, `tasks/todo.md`... Ask before `git rm --cached`.
14. **Delegate only when it saves tokens**: orchestrate yourself; delegate to subagents `investigador` (searches/reads over 3+ files, logs, `dotnet build` / `dotnet test` output, docs), `ejecutor-backend` (mechanical edits across 8+ files; below that, delegating cost more in a measured test) and `revisor-checklist-backend` (large diffs) only if what you would read is 3x or more what you need to know. Small tasks, decisions and final review: do them yourself (§14.3.4).

## Agent Efficiency (always on)
Details in `references/14-agent-efficiency.md`.
0. **Adapt to the agent and models in use**: This file applies to any agent (Codex, Antigravity, Copilot, Cursor, Gemini CLI, Claude Code...). Model and tool names in the skill are examples: detect which agent and models you have and use the equivalent. Rules never change, only syntax (§14.7).
1. **Caveman mode**: Terse replies, no filler. Technical terms, code and errors exact. Normal prose for security warnings, irreversible actions, code, commits, PRs and docs.
2. **Ask before researching libraries**: If another agent session is open and knows the library (`Corp.*` private feed or public NuGet), ask it first. Then code in the repo that already uses it, then docs MCP / XML docs in `~/.nuget/packages`, then web.
3. **Orchestrate (advisor strategy)**: The selected (main) model plans, decides and always reviews. Delegate to cheaper models (e.g. Sonnet/Haiku, mini, Flash) only when it saves tokens (rule 14), in parallel when independent. If the agent cannot spawn subagents, the main model does the whole task itself. Executors never guess: when stuck they return `NECESITA_ADVISOR: <question>`. Briefs carry only the compact skill rules that apply (§14.3.5). Before compacting, add the 5-line session summary (goal, findings, done, next, files) to the `tasks/todo.md` Log (§14.4).
4. **Ask upfront**: Before non-trivial work, ask all questions that change the result in one turn, with a recommended option (endpoint contract, required role, target table/SP, cache yes/no). Read-only requests stay read-only. Classify: small if it can be resumed from the request plus `git diff` (work inline); large otherwise (`tasks/todo.md` with L1 = verbatim request, Specs, Tasks with risk, Log; one task at a time; commits of ~400 lines). Review by risk: trivial (no behavior change: text, comments, formatting, mechanical rename) = diff + `dotnet build` + §11.1 questions, medium (everything else) = + `ponytail-review` (+ `dotnet test` if there is a test project), high (auth/JWT/permissions, secrets, SQL DDL/migrations, data deletion, `Program.cs` pipeline, `.csproj` packages) = + independent reviewer + deep offensive review with the area's skill (§13.2, §13.3, §11.6). Delegate only for a named reason: big exploration, parallel writers, context backstop, verifier of a high-risk task; when in doubt, work inline (§14.3.4).
5. **Auto-compact**: At the end of each phase, save state to `tasks/todo.md` and suggest the user compact or summarize the context (or start a new chat from `tasks/todo.md`).
6. **Graphify startup (mandatory, first action of every session, before searching, reading or editing)**: run `graphify --help`, `graphify hook status` and `graphify update .`. Command not found → `pip install graphifyy && graphify install --platform <agent>`. `warning: skill is from graphify X, package is Y` → `pip install --upgrade graphifyy && graphify install --platform <agent>`. Hooks not installed → `graphify hook install` + `graphify <agent> install`. Then the first search on the code is always `graphify query "<question>"`; it shows where to look for far fewer tokens than grep or reading files. Skip it only when the user named the exact file and line. After editing files, before the final answer: `graphify update .`.
7. **Agent tools (always)**: ponytail (minimal code, `ponytail-review` on the diff for every non-trivial change, §13.3); agent-skills by phase. Headroom starts on its own in Copilot CLI and in Codex on macOS/Linux; Codex on Windows, Cursor and VS Code Copilot are launched with `headroom wrap <agent>`. Claude Code also: claude-code-setup. If one is missing, install it and say so in one line (§14.8).
