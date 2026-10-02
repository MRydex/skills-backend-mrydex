# Agent Guidelines (AGENTS.md)

This project strictly follows the **.NET 8 Backend Best Practices** defined in the project skills:

👉 **Skill Entrypoint**: [`skills/desarrollo-backend-buenas-practicas/SKILL.md`](./skills/desarrollo-backend-buenas-practicas/SKILL.md) (or [`.agents/skills/desarrollo-backend-buenas-practicas/SKILL.md`](./.agents/skills/desarrollo-backend-buenas-practicas/SKILL.md))

**How to load it (any agent):** at the start of every coding session, read `SKILL.md` fully. Then read only the `references/*.md` file (and section) that matches the current task, as listed in its reference index. Do not load all references at once.

## Reference map

| Task | Reference |
| :--- | :--- |
| New files, folders, naming, size limits | `references/01-solution-structure.md` |
| Any C# code | `references/02-csharp-design.md` |
| Endpoint | `references/03-controllers.md` |
| Use case (request + handler) | `references/04-mediator-handlers.md` |
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
9. **Security always** (11): Red Team review (§11.1) of every change. Dependency audit with `dotnet list package --vulnerable --include-transitive` when starting, after any package change and before delivering; flag `High`/`Critical`, never bump a major version without asking (§11.4). Never disable protections. Report every vulnerability found, even out of scope.
10. **Tests** (10): xUnit + Moq, `<Method>_When<Condition>_Should<Result>`. Before "done": `dotnet build` without new warnings + `dotnet test` of the UnitTest project green. If it could not run, say so.
11. **Known tech debt** (12): Never copy it into new code, never fix it out of scope; report it in one line.
12. **No over-engineering** (13 §13.7.1): Simplest solution that solves today's request. No generic repository, AutoMapper, MediatR, `Result<T>`, layers or packages "just in case".
13. **AI files in `.gitignore`** (13 §13.9): exclude `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `graphify-out/`, `tasks/todo.md`... Ask before `git rm --cached`.
14. **Delegate only when it saves tokens** (14 §14.3.4): subagents `investigador` (searches/reads over 3+ files, logs, docs), `ejecutor-backend` (mechanical edits across 8+ files) and `revisor-checklist-backend` (large diffs). Small tasks, decisions and final review: do them yourself.

## Agent Efficiency (always on)
Details in `references/14-agent-efficiency.md`.
0. **Adapt to the agent and models in use** (§14.7): Model and tool names in the skill are examples: detect which agent and models you have and use the equivalent. Rules never change, only syntax.
1. **Caveman mode** (§14.1): Terse replies, no filler. Technical terms, code and errors exact. Normal prose for security warnings, irreversible actions, code, commits, PRs and docs.
2. **Ask before researching libraries** (§14.2): another open agent session first, then code in the repo, then docs MCP / XML docs in `~/.nuget/packages`, then web.
3. **Orchestrate with cheap subagents** (§14.3): The strongest available model plans, delegates and always reviews. Cheaper models execute, in parallel when independent. If the agent cannot spawn subagents with another model, switch models per phase. Executors never guess: when stuck they return `NECESITA_ADVISOR: <question>`.
4. **Ask upfront** (§13.6): ask all questions that change the result in one turn, with a recommended option.
5. **Auto-compact** (§14.4): at the end of each phase, save state to `tasks/todo.md` and compact or summarize the context.
6. **Graphify startup** (§14.5, mandatory, first action of every session): run `graphify --help`, `graphify hook status` and `graphify update .`. Command not found → `pip install graphifyy && graphify install --platform <agent>`. Version warning → `pip install --upgrade graphifyy && graphify install --platform <agent>`. Hooks not installed → `graphify hook install` + `graphify <agent> install`. The first search on the code is always `graphify query "<question>"`. After editing any file: `graphify update .`.
